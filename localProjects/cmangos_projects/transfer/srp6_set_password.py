#!/usr/bin/env python3
"""
CMaNGOS SRP6 password setter.
Matches exact C++ implementation from:
  - src/shared/Auth/SRP6.cpp (CalculateVerifier)
  - src/shared/Auth/BigNumber.cpp (AsByteArray, SetBinary, SetHexStr)
  - src/game/Accounts/AccountMgr.cpp (CalculateShaPassHash, CheckPassword)

Key facts from source:
  - N = "894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7"
  - g = 7
  - Both username and password are UPPERCASED (normalizeString in CheckPassword)
  - CalculateShaPassHash = hexEncodeByteArray(SHA1(name + ":" + password)) → uppercase hex, 40 chars
  - BigNumber::AsByteArray(0, true) = BN_bn2bin (BE) then std::reverse → LE, natural length
  - BigNumber::SetBinary(bytes, len) = reverse bytes then BN_bin2bn (BE) → reads LE
  - BigNumber::AsHexStr() = BN_bn2hex → uppercase BE hex, no leading zeros
  - BigNumber::SetHexStr(str) = BN_hex2bn → reads BE hex

Algorithm (CalculateVerifier):
  1. I = BigNumber from hex of SHA1(USER:PASS)
  2. mDigest[20] = {0}; copy I.AsByteArray() (LE) into mDigest; reverse(mDigest) → BE
     Net effect: mDigest = raw SHA1 bytes in standard order (with leading zero preservation)
  3. x = SHA1(salt.AsByteArray() || mDigest) read as LE BigNumber (SetBinary)
  4. v = g^x mod N
  5. Store s and v as AsHexStr() (uppercase BE hex)
"""

import hashlib
import secrets
import sys


# CMaNGOS SRP6 constants
N = int("894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7", 16)
g = 7


def bn_num_bytes(n):
    """Match OpenSSL BN_num_bytes: ceil(bit_length / 8), 0 for 0"""
    if n == 0:
        return 0
    return (n.bit_length() + 7) // 8


def bn_as_byte_array_le(n, min_size=0):
    """
    Match BigNumber::AsByteArray(minSize=0, reverse=true).
    BN_bn2bin outputs BE bytes with optional leading zero padding,
    then std::reverse gives LE bytes.
    """
    num_bytes = bn_num_bytes(n)
    length = max(min_size, num_bytes)
    if length == 0:
        return b''
    # BN_bn2bin outputs BE, padded to 'length' bytes at the front
    be_bytes = n.to_bytes(length, byteorder='big')
    # std::reverse → LE
    return bytes(reversed(be_bytes))


def bn_as_hex_str(n):
    """Match BigNumber::AsHexStr() = BN_bn2hex → uppercase BE hex, no leading zeros, no prefix"""
    if n == 0:
        return "0"
    return format(n, 'X')


def calculate_sha_pass_hash(username, password):
    """
    Match AccountMgr::CalculateShaPassHash.
    Returns hexEncodeByteArray(SHA1(name:password)) → 40-char uppercase hex with leading zeros.
    """
    sha = hashlib.sha1()
    sha.update(username.encode('utf-8'))
    sha.update(b":")
    sha.update(password.encode('utf-8'))
    digest = sha.digest()
    # hexEncodeByteArray preserves all 20 bytes → 40 hex chars, uppercase
    return digest.hex().upper()


def calculate_verifier(sha_pass_hex, salt_int=None):
    """
    Match SRP6::CalculateVerifier(rI, salt).
    Returns (salt_int, v_int).
    """
    # Generate salt if not provided
    if salt_int is None:
        salt_int = secrets.randbits(256)
        while salt_int == 0:
            salt_int = secrets.randbits(256)

    # I.SetHexStr(rI) — parse SHA1 hex as BigNumber
    I_int = int(sha_pass_hex, 16)

    # vect_I = I.AsByteArray() — LE bytes, natural length
    I_le = bn_as_byte_array_le(I_int)

    # mDigest[20] = {0}; memcpy(mDigest, vect_I.data(), vect_I.size())
    mDigest = bytearray(20)
    copy_len = min(len(I_le), 20)
    mDigest[:copy_len] = I_le[:copy_len]

    # std::reverse(mDigest, mDigest + 20) — LE → BE
    mDigest.reverse()
    # Now mDigest = original SHA1 bytes in standard (BE) order

    # salt LE bytes: s.AsByteArray() — natural length
    salt_le = bn_as_byte_array_le(salt_int)

    # SHA1(salt_LE || mDigest_BE)
    sha = hashlib.sha1()
    sha.update(salt_le)
    sha.update(bytes(mDigest))
    x_digest = sha.digest()

    # x.SetBinary(digest, 20) — reads LE bytes
    x = int.from_bytes(x_digest, byteorder='little')

    # v = g^x mod N
    v = pow(g, x, N)

    return salt_int, v


def verify(username, password, s_hex, v_hex):
    """
    Match AccountMgr::CheckPassword flow:
    normalizeString(username) + normalizeString(password) → uppercase
    CalculateShaPassHash → hex SHA1
    CalculateVerifier with stored salt → computed v
    ProofVerifier: compare hex strings
    """
    username = username.upper()
    password = password.upper()
    sha_pass_hex = calculate_sha_pass_hash(username, password)
    salt_int = int(s_hex, 16)
    _, v_computed = calculate_verifier(sha_pass_hex, salt_int)
    v_computed_hex = bn_as_hex_str(v_computed)
    return v_computed_hex == v_hex


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} USERNAME PASSWORD")
        sys.exit(1)

    username = sys.argv[1].upper()
    password = sys.argv[2].upper()  # normalizeString uppercases

    sha_pass_hex = calculate_sha_pass_hash(username, password)
    salt_int, v_int = calculate_verifier(sha_pass_hex)

    s_hex = bn_as_hex_str(salt_int)
    v_hex = bn_as_hex_str(v_int)

    # Self-verify
    ok = verify(username, password, s_hex, v_hex)
    assert ok, "SELF-VERIFICATION FAILED!"

    print(f"-- SRP6 for {username} (password: {password})")
    print(f"-- SHA1 hash: {sha_pass_hex}")
    print(f"-- Salt (s): {s_hex}")
    print(f"-- Verifier (v): {v_hex}")
    print(f"-- Self-verify: {'OK' if ok else 'FAIL'}")
    print(f"UPDATE account SET v='{v_hex}', s='{s_hex}' WHERE username='{username}';")


if __name__ == "__main__":
    main()
