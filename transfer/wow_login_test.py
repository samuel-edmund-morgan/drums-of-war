#!/usr/bin/env python3
"""
WoW 3.3.5a (build 12340) Login Test Bot for CMaNGOS WotLK.
Tests character login without a game client to detect server crashes.

Usage:
    python3 wow_login_test.py --username SAMUEL --password TEST123 --guid 1802 \
        --auth-host 127.0.0.1 --auth-port 3726 --world-host 127.0.0.1 --world-port 8087

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
# Constants
# ============================================================================

# Auth opcodes (realmd)
CMD_AUTH_LOGON_CHALLENGE = 0x00
CMD_AUTH_LOGON_PROOF = 0x01
CMD_REALM_LIST = 0x10

# World opcodes
SMSG_AUTH_CHALLENGE = 0x01EC
CMSG_AUTH_SESSION = 0x01ED
SMSG_AUTH_RESPONSE = 0x01EE
CMSG_CHAR_ENUM = 0x0037
SMSG_CHAR_ENUM = 0x003B
CMSG_PLAYER_LOGIN = 0x003D
SMSG_CHARACTER_LOGIN_FAILED = 0x0041
SMSG_LOGIN_VERIFY_WORLD = 0x0236
CMSG_LOGOUT_REQUEST = 0x004B
SMSG_LOGOUT_RESPONSE = 0x004C
SMSG_LOGOUT_COMPLETE = 0x004D

# Auth results
AUTH_OK = 0x0C

# SRP6 constants (from CMaNGOS SRP6.cpp)
N = int("894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7", 16)
g = 7

# WotLK AuthCrypt HMAC seeds (from CMaNGOS mangos-wotlk AuthCrypt.cpp)
SERVER_ENCRYPT_KEY = bytes([0xCC, 0x98, 0xAE, 0x04, 0xE8, 0x97, 0xEA, 0xCA,
                            0x12, 0xDD, 0xC0, 0x93, 0x42, 0x91, 0x53, 0x57])
SERVER_DECRYPT_KEY = bytes([0xC2, 0xB3, 0x72, 0x3C, 0xC6, 0xAE, 0xD9, 0xB5,
                            0x34, 0x3C, 0x53, 0xEE, 0x2F, 0x43, 0x67, 0xCE])

WOW_BUILD = 12340


# ============================================================================
# ARC4 (RC4) cipher — pure Python
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
# WotLK World Packet Header Encryption (HMAC-SHA1 + ARC4)
# ============================================================================
class WorldCrypt:
    """
    From AuthCrypt.cpp (mangos-wotlk):
    - _serverEncrypt = SARC4 with HMAC-SHA1(ServerEncryptionKey, K)  -> server encrypts outgoing
    - _clientDecrypt = SARC4 with HMAC-SHA1(ServerDecryptionKey, K)  -> server decrypts incoming

    For the CLIENT (bot), we reverse:
    - decrypt incoming = use _serverEncrypt key (same key server uses to encrypt)
    - encrypt outgoing = use _clientDecrypt key (same key server uses to decrypt)
    """

    def __init__(self):
        self.initialized = False
        self._decrypt = None
        self._encrypt = None

    def init(self, session_key: bytes):
        # Server uses ServerEncryptionKey to encrypt outgoing → client uses same to decrypt
        decrypt_hmac = hmac.new(SERVER_ENCRYPT_KEY, session_key, hashlib.sha1).digest()
        # Server uses ServerDecryptionKey to decrypt incoming → client uses same to encrypt
        encrypt_hmac = hmac.new(SERVER_DECRYPT_KEY, session_key, hashlib.sha1).digest()

        self._decrypt = ARC4(decrypt_hmac)
        self._encrypt = ARC4(encrypt_hmac)

        # Drop first 1024 bytes
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


def int_to_le_bytes(n: int, length: int) -> bytes:
    return n.to_bytes(length, 'little')


def bn_to_le_bytes(n: int, min_size: int = 0) -> bytes:
    """Convert integer to LE bytes (matches BigNumber::AsByteArray)."""
    if n == 0:
        return b'\x00' * max(1, min_size)
    num_bytes = (n.bit_length() + 7) // 8
    length = max(min_size, num_bytes)
    return n.to_bytes(length, 'little')


def recv_exact(sock: socket.socket, n: int) -> bytes:
    """Receive exactly n bytes."""
    buf = b''
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("Connection closed by remote")
        buf += chunk
    return buf


# ============================================================================
# Phase 1: Realmd Authentication (SRP6)
# ============================================================================
class RealmAuth:
    def __init__(self, host: str, port: int, username: str, password: str):
        self.host = host
        self.port = port
        self.username = username.upper()
        self.password = password.upper()
        self.sock = None
        self.session_key = None  # K, 40 bytes LE

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
        username_bytes = self.username.encode('ascii')
        # Build challenge body
        body = b'WoW\x00'              # gamename (not reversed — raw bytes)
        body += struct.pack('<BBBh', 3, 3, 5, WOW_BUILD)
        body += b'68x\x00'             # platform "x86" reversed
        body += b'niW\x00'             # os "Win" reversed
        body += b'SUne'                # country "enUS" reversed
        body += struct.pack('<I', 0)   # timezone_bias
        body += struct.pack('<I', 0x7F000001)  # IP 127.0.0.1
        body += struct.pack('<B', len(username_bytes))
        body += username_bytes

        header = struct.pack('<BBH', CMD_AUTH_LOGON_CHALLENGE, 0x03, len(body))
        self.sock.send(header + body)
        print(f"[AUTH] Sent LOGON_CHALLENGE for '{self.username}'")

    def _recv_challenge(self):
        resp = recv_exact(self.sock, 3)
        cmd, unk, error = struct.unpack('<BBB', resp)

        if error != 0:
            raise RuntimeError(f"Auth challenge error: {error:#04x}")

        # B(32) + g_len(1) + g(1) + N_len(1) + N(32) + s(32) + versionChallenge(16)
        data = recv_exact(self.sock, 32 + 1 + 1 + 1 + 32 + 32 + 16)
        B_bytes = data[0:32]
        g_len = data[32]
        g_val = data[33]
        N_len = data[34]
        N_bytes = data[35:67]
        s_bytes = data[67:99]

        # Security flags
        sec_flags = recv_exact(self.sock, 1)[0]
        if sec_flags & 0x01:
            recv_exact(self.sock, 20)  # PIN
        if sec_flags & 0x02:
            recv_exact(self.sock, 12)  # matrix
        if sec_flags & 0x04:
            recv_exact(self.sock, 1)   # authenticator

        print(f"[AUTH] Challenge OK (security_flags={sec_flags:#04x})")
        return B_bytes, g_val, N_bytes, s_bytes

    def _send_proof(self, B_bytes, g_val, N_bytes, s_bytes):
        B_int = le_bytes_to_int(B_bytes)
        N_int = le_bytes_to_int(N_bytes)

        # x = SHA1(s || SHA1(USER:PASS)) as LE int
        inner_hash = hashlib.sha1(f"{self.username}:{self.password}".encode('ascii')).digest()
        x_hash = hashlib.sha1(s_bytes + inner_hash).digest()
        x = le_bytes_to_int(x_hash)

        # a = random private ephemeral
        a = le_bytes_to_int(os.urandom(19))
        A_int = pow(g_val, a, N_int)
        A_bytes = bn_to_le_bytes(A_int, 32)

        # u = SHA1(A || B)
        u = le_bytes_to_int(hashlib.sha1(A_bytes + B_bytes).digest())

        # S = (B - 3*g^x)^(a + u*x) mod N
        gx = pow(g_val, x, N_int)
        S_int = pow((B_int - 3 * gx) % N_int, a + u * x, N_int)
        S_bytes = bn_to_le_bytes(S_int, 32)

        # K = interleaved SHA1 of even/odd bytes of S
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

        # M1 = SHA1(xor_hash || user_hash || s || A || B || K)
        N_hash = hashlib.sha1(bn_to_le_bytes(N_int, 32)).digest()
        g_hash = hashlib.sha1(bytes([g_val])).digest()
        xor_hash = bytes(a ^ b for a, b in zip(N_hash, g_hash))
        user_hash = hashlib.sha1(self.username.encode('ascii')).digest()
        M1 = hashlib.sha1(xor_hash + user_hash + s_bytes + A_bytes + B_bytes + K).digest()

        # Send proof
        pkt = struct.pack('<B', CMD_AUTH_LOGON_PROOF)
        pkt += A_bytes          # 32 bytes
        pkt += M1               # 20 bytes
        pkt += b'\x00' * 20     # crc_hash (not verified by CMaNGOS)
        pkt += struct.pack('<BB', 0, 0)  # number_of_keys, securityFlags
        self.sock.send(pkt)
        print(f"[AUTH] Sent LOGON_PROOF")

        # Receive response
        resp = recv_exact(self.sock, 2)
        cmd, error = struct.unpack('<BB', resp)
        if error != 0:
            recv_exact(self.sock, 2)
            raise RuntimeError(f"Auth proof error: {error:#04x}")

        # Success: M2(20) + accountFlags(4) + surveyId(4) + unkFlags(2)
        data = recv_exact(self.sock, 20 + 4 + 4 + 2)
        M2 = data[0:20]

        # Verify M2
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

        unk, count = struct.unpack('<IH', data[0:6])
        print(f"[AUTH] {count} realm(s)")

        offset = 6
        for i in range(count):
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

            if flags & 0x04:
                offset += 5  # version info

            print(f"[AUTH]   '{name}' @ {address}, {nchars} char(s)")

    def authenticate(self) -> bytes:
        """Run full auth and return session key K."""
        self._connect()
        try:
            self._send_challenge()
            B_bytes, g_val, N_bytes, s_bytes = self._recv_challenge()
            self._send_proof(B_bytes, g_val, N_bytes, s_bytes)
            self._get_realm_list()
            return self.session_key
        finally:
            self._close()


# ============================================================================
# Phase 2: World Server Login
# ============================================================================
class WorldLogin:
    def __init__(self, host: str, port: int, username: str, session_key: bytes):
        self.host = host
        self.port = port
        self.username = username.upper()
        self.session_key = session_key
        self.sock = None
        self.crypt = WorldCrypt()

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
        """Receive encrypted server packet (4 or 5 byte header)."""
        enc = recv_exact(self.sock, 4)
        dec = bytearray(self.crypt.decrypt(enc))

        if dec[0] & 0x80:
            # Large packet: 3-byte size
            extra = recv_exact(self.sock, 1)
            extra_dec = self.crypt.decrypt(extra)
            size = ((dec[0] & 0x7F) << 16) | (dec[1] << 8) | dec[2]
            opcode = struct.unpack('<H', bytes([dec[3], extra_dec[0]]))[0]
        else:
            # Normal: 2-byte size
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
        """Receive SMSG_AUTH_CHALLENGE, return server_seed."""
        opcode, payload = self._recv_packet_raw()
        if opcode != SMSG_AUTH_CHALLENGE:
            raise RuntimeError(f"Expected SMSG_AUTH_CHALLENGE (0x{SMSG_AUTH_CHALLENGE:04X}), "
                               f"got 0x{opcode:04X}")

        # WotLK: uint32(1) + uint32(server_seed) + 16B + 16B = 40 bytes
        if len(payload) < 8:
            raise RuntimeError(f"Auth challenge payload too short: {len(payload)}")

        unk = struct.unpack('<I', payload[0:4])[0]
        server_seed = struct.unpack('<I', payload[4:8])[0]
        print(f"[WORLD] Auth challenge: seed=0x{server_seed:08X}, payload={len(payload)}B")
        return server_seed

    def _send_auth_session(self, server_seed: int):
        """Send CMSG_AUTH_SESSION."""
        client_seed = struct.unpack('<I', os.urandom(4))[0]

        # Digest: SHA1(account + uint32(0) + uint32(clientSeed) + uint32(serverSeed) + K)
        digest = hashlib.sha1(
            self.username.encode('ascii') +
            struct.pack('<I', 0) +
            struct.pack('<I', client_seed) +
            struct.pack('<I', server_seed) +
            self.session_key
        ).digest()

        # Addon data: uint32 decompressed_size + zlib(uint32 count + per-addon entries)
        # Include the 4 fingerprint addons the anticheat expects
        addon_raw = struct.pack('<I', 4)  # 4 addons
        for name in [b'Blizzard_BindingUI', b'Blizzard_InspectUI',
                     b'Blizzard_MacroUI', b'Blizzard_RaidUI']:
            addon_raw += name + b'\x00'        # null-terminated name
            addon_raw += struct.pack('<B', 1)  # flags/enabled
            addon_raw += struct.pack('<I', 0x4C1C776D)  # correct modulus CRC
            addon_raw += struct.pack('<I', 0)  # urlcrc
        addon_compressed = zlib.compress(addon_raw)

        # WotLK CMSG_AUTH_SESSION payload (matches HandleAuthSession in WorldSocket.cpp):
        # uint32 ClientBuild, uint32 unk2, string account,
        # uint32 loginServerType, uint32 clientSeed,
        # uint32 regionId, uint32 battleGroupId, uint32 realmId,
        # uint64 dosResponse, digest[20], uint32 decompressed_size, zlib_data...
        payload = struct.pack('<I', WOW_BUILD)
        payload += struct.pack('<I', 0)                                    # unk2
        payload += self.username.encode('ascii') + b'\x00'                 # account
        payload += struct.pack('<I', 0)                                    # loginServerType
        payload += struct.pack('<I', client_seed)                          # clientSeed
        payload += struct.pack('<I', 0)                                    # regionId
        payload += struct.pack('<I', 0)                                    # battleGroupId
        payload += struct.pack('<I', 0)                                    # realmId
        payload += struct.pack('<Q', 0)                                    # dosResponse
        payload += digest                                                  # 20 bytes
        payload += struct.pack('<I', len(addon_raw))                       # decompressed size
        payload += addon_compressed                                        # zlib compressed addon data

        self._send_packet_raw(CMSG_AUTH_SESSION, payload)
        print(f"[WORLD] Sent AUTH_SESSION (build={WOW_BUILD})")

        # Initialize crypto NOW (before receiving response)
        self.crypt.init(self.session_key)
        print(f"[WORLD] Encryption initialized")

    def _recv_auth_response(self) -> bool:
        """Receive SMSG_AUTH_RESPONSE."""
        opcode, payload = self._recv_packet()
        if opcode != SMSG_AUTH_RESPONSE:
            raise RuntimeError(f"Expected SMSG_AUTH_RESPONSE (0x{SMSG_AUTH_RESPONSE:04X}), "
                               f"got 0x{opcode:04X}, {len(payload)}B payload")

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
        """Send CMSG_CHAR_ENUM and receive character list."""
        self._send_packet(CMSG_CHAR_ENUM)
        print(f"[WORLD] Sent CHAR_ENUM")

        # Read packets until we get SMSG_CHAR_ENUM
        for _ in range(50):
            opcode, payload = self._recv_packet()
            if opcode == SMSG_CHAR_ENUM:
                break
            # Ignore other setup packets (addon info, etc.)
        else:
            raise RuntimeError("Never received SMSG_CHAR_ENUM")

        num_chars = payload[0]
        print(f"[WORLD] {num_chars} character(s)")

        offset = 1
        characters = []
        for _ in range(num_chars):
            if offset + 8 > len(payload):
                break
            guid = struct.unpack_from('<Q', payload, offset)[0]
            offset += 8

            # Name (null-terminated)
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

            # zone(4) + map(4) + x(4) + y(4) + z(4) + guild(4) + charFlags(4) + customizeFlags(4)
            # + firstLogin(1) + petDisplayId(4) + petLevel(4) + petFamily(4)
            # + equipment(23 * 9)
            skip = 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 1 + 4 + 4 + 4 + (23 * 9)
            offset += skip

            characters.append({'guid': guid, 'name': name, 'level': level,
                                'race': race, 'class': cls})
            print(f"[WORLD]   '{name}' GUID={guid} Lv{level} Race={race} Class={cls}")

        return characters

    def _player_login(self, guid: int):
        """Send CMSG_PLAYER_LOGIN."""
        self._send_packet(CMSG_PLAYER_LOGIN, struct.pack('<Q', guid))
        print(f"[WORLD] Sent PLAYER_LOGIN (GUID={guid})")

    def _wait_for_result(self, timeout: float = 20.0) -> str:
        """Wait for login result. Returns SUCCESS, FAILED, CRASH, or TIMEOUT."""
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

                # Ignore other packets (SMSG_ACCOUNT_DATA_TIMES, etc.)

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
        """Full world login flow. Returns result string."""
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
                # Clean disconnect
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
    parser = argparse.ArgumentParser(description='WoW 3.3.5a Login Test Bot')
    parser.add_argument('--auth-host', default='127.0.0.1')
    parser.add_argument('--auth-port', type=int, default=3726)
    parser.add_argument('--world-host', default='127.0.0.1')
    parser.add_argument('--world-port', type=int, default=8087)
    parser.add_argument('--username', required=True)
    parser.add_argument('--password', required=True)
    parser.add_argument('--guid', type=int, required=True)
    args = parser.parse_args()

    print("=" * 50)
    print("WoW 3.3.5a Login Test Bot")
    print(f"Auth:  {args.auth_host}:{args.auth_port}")
    print(f"World: {args.world_host}:{args.world_port}")
    print(f"User:  {args.username}")
    print(f"GUID:  {args.guid}")
    print("=" * 50)

    # Phase 1: Auth
    print("\n--- Phase 1: Authentication ---")
    auth = RealmAuth(args.auth_host, args.auth_port, args.username, args.password)
    try:
        session_key = auth.authenticate()
    except Exception as e:
        print(f"\n[FATAL] Auth failed: {e}")
        traceback.print_exc()
        return 1

    # Phase 2: World Login
    print("\n--- Phase 2: World Login ---")
    world = WorldLogin(args.world_host, args.world_port, args.username, session_key)
    result = world.login_character(args.guid)

    print(f"\n{'=' * 50}")
    print(f"RESULT: {result}")
    print(f"{'=' * 50}")

    return 0 if result == "SUCCESS" else 1


if __name__ == '__main__':
    sys.exit(main())
