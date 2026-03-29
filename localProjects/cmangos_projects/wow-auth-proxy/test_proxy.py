#!/usr/bin/env python3
"""
Quick test: send CMD_AUTH_LOGON_CHALLENGE packets with different build numbers
through the auth proxy and verify routing.
"""

import socket
import struct
import sys

PROXY_HOST = "64.181.205.211"
PROXY_PORT = 3724

# Build numbers for each expansion
BUILDS = {
    "Vanilla 1.12.1": 5875,
    "TBC 2.4.3": 8606,
    "WotLK 3.3.5a": 12340,
}


def build_logon_challenge(username: str, build: int) -> bytes:
    """Construct a CMD_AUTH_LOGON_CHALLENGE packet."""
    username_bytes = username.upper().encode("ascii")

    # Fixed fields
    cmd = 0x00       # CMD_AUTH_LOGON_CHALLENGE
    error = 0x03     # client always sends 3
    gamename = b"WoW\x00"
    version1 = 1
    version2 = 12
    version3 = 1
    platform = b"68x\x00"  # "x86" reversed
    os_field = b"niW\x00"  # "Win" reversed
    locale = b"SUne"       # "enUS" reversed
    timezone_bias = 0
    ip = 0x7F000001  # 127.0.0.1
    username_len = len(username_bytes)

    # Size = total packet size minus first 4 bytes (cmd, error, size)
    size = 30 + username_len

    packet = struct.pack("<BBH", cmd, error, size)
    packet += gamename
    packet += struct.pack("<BBB", version1, version2, version3)
    packet += struct.pack("<H", build)
    packet += platform
    packet += os_field
    packet += locale
    packet += struct.pack("<I", timezone_bias)
    packet += struct.pack("<I", ip)
    packet += struct.pack("<B", username_len)
    packet += username_bytes

    return packet


def test_build(label: str, build: int):
    """Send a logon challenge and check if we get a response."""
    print(f"  [{label}] build={build} ... ", end="", flush=True)

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect((PROXY_HOST, PROXY_PORT))

        packet = build_logon_challenge("PROXYTEST", build)
        sock.sendall(packet)

        # Read response — CMD_AUTH_LOGON_CHALLENGE_RESPONSE
        response = sock.recv(256)
        sock.close()

        if len(response) < 3:
            print(f"FAIL (too short: {len(response)} bytes)")
            return False

        resp_cmd = response[0]
        resp_unk = response[1]
        resp_error = response[2]

        if resp_cmd == 0x00 and resp_error == 0x00:
            print(f"OK (SRP6 challenge received, {len(response)} bytes)")
            return True
        elif resp_cmd == 0x00:
            # Got a response but error (e.g., unknown account) — proxy still routed correctly!
            error_names = {4: "UNKNOWN_ACCOUNT", 5: "INCORRECT_PASSWORD", 9: "VERSION_INVALID"}
            err_name = error_names.get(resp_error, f"code={resp_error}")
            print(f"OK (routed, auth error: {err_name} — expected for test user)")
            return True
        else:
            print(f"FAIL (unexpected cmd=0x{resp_cmd:02x})")
            return False

    except Exception as e:
        print(f"FAIL ({e})")
        return False


def main():
    print(f"Testing WoW Auth Proxy at {PROXY_HOST}:{PROXY_PORT}")
    print()

    results = {}
    for label, build in BUILDS.items():
        results[label] = test_build(label, build)

    print()
    all_ok = all(results.values())
    print(f"Result: {'ALL PASSED' if all_ok else 'SOME FAILED'}")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
