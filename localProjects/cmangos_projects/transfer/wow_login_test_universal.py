#!/usr/bin/env python3
"""
Universal WoW Login Test Bot for CMaNGOS — Classic (1.12.1), TBC (2.4.3), WotLK (3.3.5a).
Tests character login without a game client to detect server crashes.

Usage:
    python3 wow_login_test_universal.py --expansion classic --username SAMUEL --password TEST123 --guid 1801
    python3 wow_login_test_universal.py --expansion tbc --username SAMUEL --password TEST123 --guid 1801
    python3 wow_login_test_universal.py --expansion wotlk --username SAMUEL --password TEST123 --guid 1802

Returns exit code 0 on successful login, 1 on failure/crash.
"""

import socket
import struct
import hashlib
import hmac
import os
import sys
import time
import zlib
import argparse
import traceback

# ============================================================================
# Expansion Configs
# ============================================================================
EXPANSION_CONFIG = {
    'classic': {
        'build': 5875,
        'version': (1, 12, 1),
        'auth_port': 3724,
        'world_port': 8085,
        'crypt': 'vanilla',        # simple XOR with session key
        'auth_proof_extra': 4,     # LoginFlags(4) after M2 = 26 total
        'auth_session': 'vanilla', # build + unk2 + account + clientSeed + digest + addon
        'auth_challenge_size': 4,  # just uint32 server_seed
        'equip_slots': 20,
        'equip_bytes_per_slot': 5, # displayId(4) + invType(1)
        'char_enum_customize_flags_bytes': 0,
    },
    'tbc': {
        'build': 8606,
        'version': (2, 4, 3),
        'auth_port': 3725,
        'world_port': 8086,
        'crypt': 'tbc',
        'auth_proof_extra': 10,    # accountFlags(4) + surveyId(4) + unkFlags(2) = 32 total
        'auth_session': 'vanilla', # same format as classic
        'auth_challenge_size': 4,
        'equip_slots': 20,
        'equip_bytes_per_slot': 9, # displayId(4) + invType(1) + enchantAura(4)
        'char_enum_customize_flags_bytes': 0,
    },
    'wotlk': {
        'build': 12340,
        'version': (3, 3, 5),
        'auth_port': 3726,
        'world_port': 8087,
        'crypt': 'wotlk',         # HMAC-SHA1 + ARC4
        'auth_proof_extra': 10,    # accountFlags(4) + surveyId(4) + unkFlags(2) = 32 total
        'auth_session': 'wotlk',  # extra fields: loginServerType, regionId, etc.
        'auth_challenge_size': 40, # unk(4) + seed(4) + 32 bytes seeds
        'equip_slots': 23,
        'equip_bytes_per_slot': 9, # displayId(4) + invType(1) + enchantAura(4)
        'char_enum_customize_flags_bytes': 4,
    },
    'azerothcore': {
        'build': 12340,
        'version': (3, 3, 5),
        'auth_port': 3727,
        'world_port': 8088,
        'crypt': 'wotlk',
        'auth_proof_extra': 10,
        'auth_session': 'wotlk',
        'auth_challenge_size': 40,
        'equip_slots': 23,
        'equip_bytes_per_slot': 9,
        'char_enum_customize_flags_bytes': 4,
    },
}

# Auth opcodes (realmd) — same across all expansions
CMD_AUTH_LOGON_CHALLENGE = 0x00
CMD_AUTH_LOGON_PROOF = 0x01
CMD_REALM_LIST = 0x10

# World opcodes — same across Classic/TBC/WotLK for these basic ones
SMSG_AUTH_CHALLENGE = 0x01EC
CMSG_AUTH_SESSION = 0x01ED
SMSG_AUTH_RESPONSE = 0x01EE
CMSG_CHAR_ENUM = 0x0037
SMSG_CHAR_ENUM = 0x003B
CMSG_PLAYER_LOGIN = 0x003D
SMSG_CHARACTER_LOGIN_FAILED = 0x0041
SMSG_LOGIN_VERIFY_WORLD = 0x0236
CMSG_LOGOUT_REQUEST = 0x004B

# Auth result
AUTH_OK = 0x0C

# SRP6 constants
N = int("894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7", 16)
g = 7

# WotLK HMAC seeds (only used for WotLK)
SERVER_ENCRYPT_KEY = bytes([0xCC, 0x98, 0xAE, 0x04, 0xE8, 0x97, 0xEA, 0xCA,
                            0x12, 0xDD, 0xC0, 0x93, 0x42, 0x91, 0x53, 0x57])
SERVER_DECRYPT_KEY = bytes([0xC2, 0xB3, 0x72, 0x3C, 0xC6, 0xAE, 0xD9, 0xB5,
                            0x34, 0x3C, 0x53, 0xEE, 0x2F, 0x43, 0x67, 0xCE])


# ============================================================================
# ARC4 cipher (for WotLK only)
# ============================================================================
class ARC4:
    def __init__(self, key: bytes):
        self.S = list(range(256))
        j = 0
        for i in range(256):
            j = (j + self.S[i] + key[i % len(key)]) & 0xFF
            self.S[i], self.S[j] = self.S[j], self.S[i]
        self.i = 0
        self.j = 0

    def process(self, data: bytes) -> bytes:
        out = bytearray(len(data))
        for n in range(len(data)):
            self.i = (self.i + 1) & 0xFF
            self.j = (self.j + self.S[self.i]) & 0xFF
            self.S[self.i], self.S[self.j] = self.S[self.j], self.S[self.i]
            out[n] = data[n] ^ self.S[(self.S[self.i] + self.S[self.j]) & 0xFF]
        return bytes(out)


# ============================================================================
# World Packet Encryption
# ============================================================================
class VanillaCrypt:
    """
    Classic header encryption. Uses session key (40 bytes) directly.
    Server encrypt (EncryptSend): x = (data[t] ^ key[_send_i]) + _send_j
    Server decrypt (DecryptRecv): x = (data[t] - _recv_j) ^ key[_recv_i]

    Bot perspective (reverse):
    - Decrypt incoming (server used EncryptSend) → use DecryptRecv-like algorithm
    - Encrypt outgoing (server uses DecryptRecv)  → use EncryptSend-like algorithm
    """

    def __init__(self):
        self.initialized = False
        self._key = None
        # For decrypting server packets (reverse of server's EncryptSend)
        self._recv_i = 0
        self._recv_j = 0
        # For encrypting client packets (reverse of server's DecryptRecv)
        self._send_i = 0
        self._send_j = 0

    def init(self, session_key: bytes):
        self._key = session_key  # 40 bytes
        self._recv_i = self._recv_j = 0
        self._send_i = self._send_j = 0
        self.initialized = True

    def decrypt(self, data: bytes) -> bytes:
        """Decrypt server→client header (4 bytes). Reverse of server's EncryptSend."""
        out = bytearray(len(data))
        for t in range(len(data)):
            idx = self._recv_i % len(self._key)
            x = ((data[t] - self._recv_j) & 0xFF) ^ self._key[idx]
            self._recv_i += 1
            self._recv_j = data[t]
            out[t] = x
        return bytes(out)

    def encrypt(self, data: bytes) -> bytes:
        """Encrypt client→server header (6 bytes). Reverse of server's DecryptRecv."""
        out = bytearray(len(data))
        for t in range(len(data)):
            idx = self._send_i % len(self._key)
            x = ((data[t] ^ self._key[idx]) + self._send_j) & 0xFF
            self._send_i += 1
            out[t] = self._send_j = x
        return bytes(out)


# TBC HMAC seed for key derivation (from CMaNGOS TBC AuthCrypt.cpp)
TBC_CRYPT_SEED = bytes([0x38, 0xA7, 0x83, 0x15, 0xF8, 0x92, 0x25, 0x30,
                        0x71, 0x98, 0x67, 0xB1, 0x8C, 0x04, 0xE2, 0xAA])


class TbcCrypt:
    """
    TBC header encryption. Same XOR algorithm as Classic, but key is derived
    via HMAC-SHA1(seed, session_key) → 20 bytes instead of raw 40-byte key.
    """

    def __init__(self):
        self.initialized = False
        self._key = None
        self._recv_i = 0
        self._recv_j = 0
        self._send_i = 0
        self._send_j = 0

    def init(self, session_key: bytes):
        self._key = hmac.new(TBC_CRYPT_SEED, session_key, hashlib.sha1).digest()  # 20 bytes
        self._recv_i = self._recv_j = 0
        self._send_i = self._send_j = 0
        self.initialized = True

    def decrypt(self, data: bytes) -> bytes:
        """Decrypt server→client header (4 bytes). Reverse of server's EncryptSend."""
        out = bytearray(len(data))
        for t in range(len(data)):
            idx = self._recv_i % len(self._key)
            x = ((data[t] - self._recv_j) & 0xFF) ^ self._key[idx]
            self._recv_i += 1
            self._recv_j = data[t]
            out[t] = x
        return bytes(out)

    def encrypt(self, data: bytes) -> bytes:
        """Encrypt client→server header (6 bytes). Reverse of server's DecryptRecv."""
        out = bytearray(len(data))
        for t in range(len(data)):
            idx = self._send_i % len(self._key)
            x = ((data[t] ^ self._key[idx]) + self._send_j) & 0xFF
            self._send_i += 1
            out[t] = self._send_j = x
        return bytes(out)


class WotlkCrypt:
    """WotLK encryption: HMAC-SHA1 seeds + ARC4."""

    def __init__(self):
        self.initialized = False

    def init(self, session_key: bytes):
        decrypt_hmac = hmac.new(SERVER_ENCRYPT_KEY, session_key, hashlib.sha1).digest()
        encrypt_hmac = hmac.new(SERVER_DECRYPT_KEY, session_key, hashlib.sha1).digest()
        self._decrypt = ARC4(decrypt_hmac)
        self._encrypt = ARC4(encrypt_hmac)
        self._decrypt.process(b'\x00' * 1024)
        self._encrypt.process(b'\x00' * 1024)
        self.initialized = True

    def decrypt(self, data: bytes) -> bytes:
        return self._decrypt.process(data)

    def encrypt(self, data: bytes) -> bytes:
        return self._encrypt.process(data)


# ============================================================================
# Helpers
# ============================================================================
def le_bytes_to_int(data: bytes) -> int:
    return int.from_bytes(data, 'little')


def bn_to_le_bytes(n: int, min_size: int = 0) -> bytes:
    if n == 0:
        return b'\x00' * max(1, min_size)
    num_bytes = (n.bit_length() + 7) // 8
    length = max(min_size, num_bytes)
    return n.to_bytes(length, 'little')


def recv_exact(sock: socket.socket, n: int) -> bytes:
    buf = b''
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("Connection closed by remote")
        buf += chunk
    return buf


# ============================================================================
# Phase 1: Realmd Authentication (SRP6) — same for all expansions
# ============================================================================
class RealmAuth:
    def __init__(self, host: str, port: int, username: str, password: str, config: dict):
        self.host = host
        self.port = port
        self.username = username.upper()
        self.password = password.upper()
        self.config = config
        self.sock = None
        self.session_key = None

    def _connect(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.settimeout(10)
        self.sock.connect((self.host, self.port))
        print(f"[AUTH] Connected to {self.host}:{self.port}")

    def _close(self):
        if self.sock:
            self.sock.close()
            self.sock = None

    def _send_challenge(self):
        build = self.config['build']
        ver = self.config['version']
        username_bytes = self.username.encode('ascii')

        body = b'WoW\x00'
        body += struct.pack('<BBBh', ver[0], ver[1], ver[2], build)
        body += b'68x\x00'        # platform "x86" reversed
        body += b'niW\x00'        # os "Win" reversed
        body += b'SUne'            # locale "enUS" reversed
        body += struct.pack('<I', 0)
        body += struct.pack('<I', 0x7F000001)
        body += struct.pack('<B', len(username_bytes))
        body += username_bytes

        header = struct.pack('<BBH', CMD_AUTH_LOGON_CHALLENGE, 0x03, len(body))
        self.sock.send(header + body)
        print(f"[AUTH] Sent LOGON_CHALLENGE (build={build})")

    def _recv_challenge(self):
        resp = recv_exact(self.sock, 3)
        cmd, unk, error = struct.unpack('<BBB', resp)
        if error != 0:
            raise RuntimeError(f"Auth challenge error: {error:#04x}")

        data = recv_exact(self.sock, 32 + 1 + 1 + 1 + 32 + 32 + 16)
        B_bytes = data[0:32]
        g_len = data[32]
        g_val = data[33]
        N_len = data[34]
        N_bytes = data[35:67]
        s_bytes = data[67:99]

        sec_flags = recv_exact(self.sock, 1)[0]
        if sec_flags & 0x01:
            recv_exact(self.sock, 20)
        if sec_flags & 0x02:
            recv_exact(self.sock, 12)
        if sec_flags & 0x04:
            recv_exact(self.sock, 1)

        print(f"[AUTH] Challenge OK (security_flags={sec_flags:#04x})")
        return B_bytes, g_val, N_bytes, s_bytes

    def _send_proof(self, B_bytes, g_val, N_bytes, s_bytes):
        B_int = le_bytes_to_int(B_bytes)
        N_int = le_bytes_to_int(N_bytes)

        inner_hash = hashlib.sha1(f"{self.username}:{self.password}".encode('ascii')).digest()
        x_hash = hashlib.sha1(s_bytes + inner_hash).digest()
        x = le_bytes_to_int(x_hash)

        a = le_bytes_to_int(os.urandom(19))
        A_int = pow(g_val, a, N_int)
        A_bytes = bn_to_le_bytes(A_int, 32)

        u = le_bytes_to_int(hashlib.sha1(A_bytes + B_bytes).digest())

        gx = pow(g_val, x, N_int)
        S_int = pow((B_int - 3 * gx) % N_int, a + u * x, N_int)
        S_bytes = bn_to_le_bytes(S_int, 32)

        even = bytes(S_bytes[i * 2] for i in range(16))
        odd = bytes(S_bytes[i * 2 + 1] for i in range(16))
        sha_even = hashlib.sha1(even).digest()
        sha_odd = hashlib.sha1(odd).digest()
        K = bytearray(40)
        for i in range(20):
            K[i * 2] = sha_even[i]
            K[i * 2 + 1] = sha_odd[i]
        K = bytes(K)
        self.session_key = K

        N_hash = hashlib.sha1(bn_to_le_bytes(N_int, 32)).digest()
        g_hash = hashlib.sha1(bytes([g_val])).digest()
        xor_hash = bytes(a ^ b for a, b in zip(N_hash, g_hash))
        user_hash = hashlib.sha1(self.username.encode('ascii')).digest()
        M1 = hashlib.sha1(xor_hash + user_hash + s_bytes + A_bytes + B_bytes + K).digest()

        pkt = struct.pack('<B', CMD_AUTH_LOGON_PROOF)
        pkt += A_bytes
        pkt += M1
        pkt += b'\x00' * 20
        pkt += struct.pack('<BB', 0, 0)
        self.sock.send(pkt)
        print(f"[AUTH] Sent LOGON_PROOF")

        resp = recv_exact(self.sock, 2)
        cmd, error = struct.unpack('<BB', resp)
        if error != 0:
            # Classic error = 2 bytes total, TBC/WotLK error = 4 bytes total
            if self.config['build'] >= 8606:
                recv_exact(self.sock, 2)
            raise RuntimeError(f"Auth proof error: {error:#04x}")

        # Success response differs by expansion
        extra = self.config['auth_proof_extra']
        data = recv_exact(self.sock, 20 + extra)  # M2(20) + expansion-specific
        M2 = data[0:20]

        M2_expected = hashlib.sha1(A_bytes + M1 + K).digest()
        if M2 != M2_expected:
            print(f"[AUTH] WARNING: M2 mismatch!")

        print(f"[AUTH] Proof OK, session key established ({len(K)} bytes)")
        return True

    def _get_realm_list(self):
        self.sock.send(struct.pack('<BI', CMD_REALM_LIST, 0))
        header = recv_exact(self.sock, 3)
        cmd, size = struct.unpack('<BH', header)
        data = recv_exact(self.sock, size)

        if self.config['build'] <= 6141:
            # Classic 1.12.x: uint32 unk + uint8 count
            unk = struct.unpack_from('<I', data, 0)[0]
            count = data[4]
            offset = 5
        else:
            # TBC/WotLK: uint32 unk + uint16 count
            unk, count = struct.unpack_from('<IH', data, 0)
            offset = 6

        print(f"[AUTH] {count} realm(s)")
        realms = []

        for i in range(count):
            if offset >= len(data) - 2:
                break

            if self.config['build'] <= 6141:
                # Classic: uint32 type + uint8 flags
                rtype = struct.unpack_from('<I', data, offset)[0]
                offset += 4
                flags = data[offset]
                offset += 1
            else:
                # TBC/WotLK: uint8 type + uint8 locked + uint8 flags
                rtype, locked, flags = struct.unpack_from('<BBB', data, offset)
                offset += 3

            name_end = data.index(0, offset)
            name = data[offset:name_end].decode('ascii')
            offset = name_end + 1

            addr_end = data.index(0, offset)
            address = data[offset:addr_end].decode('ascii')
            offset = addr_end + 1

            pop, nchars, tz, rid = struct.unpack_from('<fBBB', data, offset)
            offset += 7

            if self.config['build'] > 6141 and (flags & 0x04):
                offset += 5

            realms.append({
                'name': name,
                'address': address,
                'nchars': nchars,
                'realm_id': rid,
            })
            print(f"[AUTH]   '{name}' @ {address}, {nchars} char(s), realm_id={rid}")

        return realms

    def authenticate(self):
        self._connect()
        try:
            self._send_challenge()
            B_bytes, g_val, N_bytes, s_bytes = self._recv_challenge()
            self._send_proof(B_bytes, g_val, N_bytes, s_bytes)
            realms = self._get_realm_list()
            return self.session_key, realms
        finally:
            self._close()


# ============================================================================
# Phase 2: World Server Login
# ============================================================================
class WorldLogin:
    def __init__(self, host: str, port: int, username: str, session_key: bytes, config: dict, realm_id: int = 0):
        self.host = host
        self.port = port
        self.username = username.upper()
        self.session_key = session_key
        self.config = config
        self.realm_id = realm_id
        self.sock = None

        if config['crypt'] == 'wotlk':
            self.crypt = WotlkCrypt()
        elif config['crypt'] == 'tbc':
            self.crypt = TbcCrypt()
        else:
            self.crypt = VanillaCrypt()

    def _connect(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.settimeout(15)
        self.sock.connect((self.host, self.port))
        print(f"[WORLD] Connected to {self.host}:{self.port}")

    def _close(self):
        if self.sock:
            self.sock.close()
            self.sock = None

    def _recv_packet_raw(self):
        """Receive unencrypted server packet (4-byte header)."""
        hdr = recv_exact(self.sock, 4)
        size = struct.unpack('>H', hdr[0:2])[0]
        opcode = struct.unpack('<H', hdr[2:4])[0]
        payload = recv_exact(self.sock, size - 2) if size > 2 else b''
        return opcode, payload

    def _recv_packet(self):
        """Receive encrypted server packet."""
        enc = recv_exact(self.sock, 4)
        dec = bytearray(self.crypt.decrypt(enc))

        if self.config['crypt'] == 'wotlk' and (dec[0] & 0x80):
            # WotLK large packet: 3-byte size
            extra = recv_exact(self.sock, 1)
            extra_dec = self.crypt.decrypt(extra)
            size = ((dec[0] & 0x7F) << 16) | (dec[1] << 8) | dec[2]
            opcode = struct.unpack('<H', bytes([dec[3], extra_dec[0]]))[0]
        else:
            size = (dec[0] << 8) | dec[1]
            opcode = struct.unpack('<H', bytes(dec[2:4]))[0]

        payload_size = size - 2
        payload = recv_exact(self.sock, payload_size) if payload_size > 0 else b''
        return opcode, payload

    def _send_packet_raw(self, opcode: int, payload: bytes = b''):
        """Send unencrypted client packet (6-byte header)."""
        size = len(payload) + 4
        header = struct.pack('>H', size) + struct.pack('<I', opcode)
        self.sock.send(header + payload)

    def _send_packet(self, opcode: int, payload: bytes = b''):
        """Send encrypted client packet (6-byte header)."""
        size = len(payload) + 4
        header = struct.pack('>H', size) + struct.pack('<I', opcode)
        enc_header = self.crypt.encrypt(header)
        self.sock.send(enc_header + payload)

    def _handle_auth_challenge(self) -> int:
        opcode, payload = self._recv_packet_raw()
        if opcode != SMSG_AUTH_CHALLENGE:
            raise RuntimeError(f"Expected SMSG_AUTH_CHALLENGE, got 0x{opcode:04X}")

        if self.config['crypt'] == 'wotlk':
            # WotLK: unk(4) + server_seed(4) + seeds(32)
            server_seed = struct.unpack('<I', payload[4:8])[0]
        else:
            # Classic/TBC: just server_seed(4)
            server_seed = struct.unpack('<I', payload[0:4])[0]

        print(f"[WORLD] Auth challenge: seed=0x{server_seed:08X}, payload={len(payload)}B")
        return server_seed

    def _send_auth_session(self, server_seed: int):
        build = self.config['build']
        client_seed = struct.unpack('<I', os.urandom(4))[0]

        # Digest: SHA1(account + uint32(0) + uint32(clientSeed) + uint32(serverSeed) + K)
        digest = hashlib.sha1(
            self.username.encode('ascii') +
            struct.pack('<I', 0) +
            struct.pack('<I', client_seed) +
            struct.pack('<I', server_seed) +
            self.session_key
        ).digest()

        # Addon data (compressed) — needed for all expansions
        addon_raw = struct.pack('<I', 4)
        for name in [b'Blizzard_BindingUI', b'Blizzard_InspectUI',
                     b'Blizzard_MacroUI', b'Blizzard_RaidUI']:
            addon_raw += name + b'\x00'
            addon_raw += struct.pack('<B', 1)
            addon_raw += struct.pack('<I', 0x4C1C776D)
            addon_raw += struct.pack('<I', 0)
        addon_compressed = zlib.compress(addon_raw)

        if self.config['auth_session'] == 'wotlk':
            # WotLK: extra fields before digest
            payload = struct.pack('<I', build)
            payload += struct.pack('<I', 0)                            # unk2
            payload += self.username.encode('ascii') + b'\x00'
            payload += struct.pack('<I', 0)                            # loginServerType
            payload += struct.pack('<I', client_seed)
            payload += struct.pack('<I', 0)                            # regionId
            payload += struct.pack('<I', 0)                            # battleGroupId
            payload += struct.pack('<I', self.realm_id)                # realmId
            payload += struct.pack('<Q', 0)                            # dosResponse
            payload += digest
            payload += struct.pack('<I', len(addon_raw))
            payload += addon_compressed
        else:
            # Classic/TBC: simpler format
            payload = struct.pack('<I', build)
            payload += struct.pack('<I', 0)                            # unk2
            payload += self.username.encode('ascii') + b'\x00'
            payload += struct.pack('<I', client_seed)
            payload += digest
            payload += struct.pack('<I', len(addon_raw))
            payload += addon_compressed

        self._send_packet_raw(CMSG_AUTH_SESSION, payload)
        print(f"[WORLD] Sent AUTH_SESSION (build={build})")

        # Initialize crypto after sending auth session
        self.crypt.init(self.session_key)
        print(f"[WORLD] Encryption initialized ({self.config['crypt']})")

    def _recv_auth_response(self) -> bool:
        # May receive other packets first (e.g. SMSG_ADDON_INFO in Classic)
        for _ in range(20):
            opcode, payload = self._recv_packet()
            if opcode == SMSG_AUTH_RESPONSE:
                break
        else:
            raise RuntimeError("Never received SMSG_AUTH_RESPONSE")

        result = payload[0]
        if result == AUTH_OK:
            print(f"[WORLD] Auth response: OK")
            return True
        elif result == 0x1B:
            print(f"[WORLD] Auth response: QUEUED")
            return False
        else:
            raise RuntimeError(f"Auth response error: 0x{result:02X}")

    def _send_char_enum(self) -> list:
        self._send_packet(CMSG_CHAR_ENUM)
        print(f"[WORLD] Sent CHAR_ENUM")

        for _ in range(50):
            opcode, payload = self._recv_packet()
            if opcode == SMSG_CHAR_ENUM:
                break
        else:
            raise RuntimeError("Never received SMSG_CHAR_ENUM")

        num_chars = payload[0]
        print(f"[WORLD] {num_chars} character(s)")

        equip_slots = self.config['equip_slots']
        bytes_per_slot = self.config['equip_bytes_per_slot']
        customize_flags_bytes = self.config['char_enum_customize_flags_bytes']

        offset = 1
        characters = []
        for _ in range(num_chars):
            if offset + 8 > len(payload):
                break
            guid = struct.unpack_from('<Q', payload, offset)[0]
            offset += 8

            try:
                name_end = payload.index(0, offset)
            except ValueError:
                break
            name = payload[offset:name_end].decode('utf-8', errors='replace')
            offset = name_end + 1

            if offset + 9 > len(payload):
                break
            race, cls, gender = struct.unpack_from('<BBB', payload, offset)
            offset += 3
            offset += 5  # skin, face, hairStyle, hairColor, facialHair
            level = payload[offset]
            offset += 1

            # zone(4) + map(4) + xyz(12) + guild(4) + charFlags(4)
            # + customizeFlags(expansion-specific) + firstLogin(1) + pet(12) + equipment
            skip = 4 + 4 + 12 + 4 + 4 + customize_flags_bytes + 1 + 12 + (equip_slots * bytes_per_slot)
            offset += skip

            characters.append({'guid': guid, 'name': name, 'level': level,
                                'race': race, 'class': cls})
            print(f"[WORLD]   '{name}' GUID={guid} Lv{level} Race={race} Class={cls}")

        return characters

    def _player_login(self, guid: int):
        self._send_packet(CMSG_PLAYER_LOGIN, struct.pack('<Q', guid))
        print(f"[WORLD] Sent PLAYER_LOGIN (GUID={guid})")

    def _wait_for_result(self, timeout: float = 20.0) -> str:
        self.sock.settimeout(2.0)
        deadline = time.time() + timeout

        while time.time() < deadline:
            try:
                opcode, payload = self._recv_packet()

                if opcode == SMSG_LOGIN_VERIFY_WORLD:
                    map_id = struct.unpack_from('<I', payload, 0)[0]
                    x, y, z = struct.unpack_from('<fff', payload, 4)
                    print(f"[WORLD] LOGIN SUCCESS! Map={map_id} Pos=({x:.1f}, {y:.1f}, {z:.1f})")
                    return "SUCCESS"

                if opcode == SMSG_CHARACTER_LOGIN_FAILED:
                    reason = payload[0] if payload else 0xFF
                    print(f"[WORLD] LOGIN FAILED: reason=0x{reason:02X}")
                    return "FAILED"

            except socket.timeout:
                continue
            except ConnectionError:
                print(f"[WORLD] Connection lost (server likely crashed)")
                return "CRASH"
            except OSError as e:
                print(f"[WORLD] Socket error: {e}")
                return "CRASH"

        print(f"[WORLD] Timeout after {timeout}s")
        return "TIMEOUT"

    def login_character(self, guid: int) -> str:
        self._connect()
        try:
            server_seed = self._handle_auth_challenge()
            self._send_auth_session(server_seed)

            if not self._recv_auth_response():
                return "QUEUE"

            characters = self._send_char_enum()

            found = any(c['guid'] == guid for c in characters)
            if not found:
                print(f"[WORLD] GUID={guid} not found in character list!")
                return "NOT_FOUND"

            self._player_login(guid)
            result = self._wait_for_result()

            if result == "SUCCESS":
                try:
                    self._send_packet(CMSG_LOGOUT_REQUEST)
                    time.sleep(0.5)
                except Exception:
                    pass

            return result
        except Exception as e:
            print(f"[WORLD] Exception: {e}")
            traceback.print_exc()
            return "ERROR"
        finally:
            self._close()


# ============================================================================
# Main
# ============================================================================
def main():
    parser = argparse.ArgumentParser(description='Universal WoW Login Test Bot')
    parser.add_argument('--expansion', required=True, choices=['classic', 'tbc', 'wotlk', 'azerothcore'],
                        help='Target expansion')
    parser.add_argument('--auth-host', default='127.0.0.1')
    parser.add_argument('--auth-port', type=int, default=None)
    parser.add_argument('--world-host', default='127.0.0.1')
    parser.add_argument('--world-port', type=int, default=None)
    parser.add_argument('--realm-id', type=int, default=None,
                        help='Override WotLK/AzerothCore realm id sent in AUTH_SESSION')
    parser.add_argument('--username', required=True)
    parser.add_argument('--password', required=True)
    parser.add_argument('--guid', type=int, required=True)
    args = parser.parse_args()

    config = EXPANSION_CONFIG[args.expansion]
    auth_port = args.auth_port or config['auth_port']
    world_port = args.world_port or config['world_port']

    print("=" * 60)
    print(f"WoW Login Test Bot — {args.expansion.upper()} (build {config['build']})")
    print(f"Auth:  {args.auth_host}:{auth_port}")
    print(f"World: {args.world_host}:{world_port}")
    print(f"User:  {args.username}")
    print(f"GUID:  {args.guid}")
    print(f"Crypt: {config['crypt']}")
    print("=" * 60)

    # Phase 1: Auth
    print("\n--- Phase 1: Authentication ---")
    auth = RealmAuth(args.auth_host, auth_port, args.username, args.password, config)
    try:
        session_key, realms = auth.authenticate()
    except Exception as e:
        print(f"\n[FATAL] Auth failed: {e}")
        traceback.print_exc()
        return 1

    realm_id = args.realm_id
    if realm_id is None:
        realm_id = realms[0]['realm_id'] if realms else 0
    print(f"[AUTH] Selected realm_id={realm_id}")

    # Phase 2: World Login
    print("\n--- Phase 2: World Login ---")
    world = WorldLogin(args.world_host, world_port, args.username, session_key, config, realm_id=realm_id)
    result = world.login_character(args.guid)

    print(f"\n{'=' * 60}")
    print(f"RESULT: {result}")
    print(f"{'=' * 60}")

    return 0 if result == "SUCCESS" else 1


if __name__ == '__main__':
    sys.exit(main())
