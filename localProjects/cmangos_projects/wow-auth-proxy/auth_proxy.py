#!/usr/bin/env python3
"""
WoW Unified Auth Proxy — One port, three expansions.

Listens on a single port (default 3724) and routes WoW auth traffic
to the correct backend auth server based on the client's build number
extracted from the CMD_AUTH_LOGON_CHALLENGE packet.

Supports:
  - Vanilla 1.12.1 (build 5875)  → vmangos-realmd
  - TBC 2.4.3     (build 8606)   → cmangos-tbc realmd
  - WotLK 3.3.5a  (build 12340)  → azerothcore authserver

After initial routing, acts as a transparent bidirectional TCP proxy.
"""

import asyncio
import logging
import os
import struct
import sys
from typing import Optional, Tuple

# --- Configuration ---

LISTEN_HOST = os.getenv("PROXY_LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(os.getenv("PROXY_LISTEN_PORT", "3724"))

# Backend auth servers: build_range → (host, port)
# Format: list of (min_build, max_build, host, port, label)
BACKENDS = [
    # Vanilla: builds up to 6141
    (0, 6141,
     os.getenv("VANILLA_AUTH_HOST", "vmangos-realmd"),
     int(os.getenv("VANILLA_AUTH_PORT", "3724")),
     "Vanilla"),
    # TBC: builds 6142-12339
    (6142, 12339,
     os.getenv("TBC_AUTH_HOST", "cmangos-tbc-server"),
     int(os.getenv("TBC_AUTH_PORT", "3724")),
     "TBC"),
    # WotLK: builds 12340+
    (12340, 99999,
     os.getenv("WOTLK_AUTH_HOST", "azerothcore-authserver"),
     int(os.getenv("WOTLK_AUTH_PORT", "3724")),
     "WotLK"),
]

# Protocol constants
CMD_AUTH_LOGON_CHALLENGE = 0x00
CMD_AUTH_RECONNECT_CHALLENGE = 0x02
BUILD_OFFSET = 11  # uint16 LE at offset 11-12 in AUTH_LOGON_CHALLENGE
MIN_CHALLENGE_SIZE = 34  # Minimum packet size before username

SEND_PROXY_PROTOCOL = os.getenv("SEND_PROXY_PROTOCOL", "1") == "1"

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("auth-proxy")


def parse_build_from_challenge(data: bytes) -> Optional[int]:
    """
    Extract the client build number from CMD_AUTH_LOGON_CHALLENGE.

    Packet layout:
      offset 0:    uint8  cmd (0x00)
      offset 1:    uint8  error
      offset 2-3:  uint16 size
      offset 4-7:  char[4] gamename ("WoW\\0")
      offset 8:    uint8  version1
      offset 9:    uint8  version2
      offset 10:   uint8  version3
      offset 11-12: uint16 build (little-endian) ← WE WANT THIS
      offset 13+:  platform, os, locale, etc.
    """
    if len(data) < MIN_CHALLENGE_SIZE:
        return None

    cmd = data[0]
    if cmd not in (CMD_AUTH_LOGON_CHALLENGE, CMD_AUTH_RECONNECT_CHALLENGE):
        return None

    build = struct.unpack_from("<H", data, BUILD_OFFSET)[0]
    return build


def extract_username(data: bytes) -> str:
    """Extract username from AUTH_LOGON_CHALLENGE for logging."""
    if len(data) < MIN_CHALLENGE_SIZE:
        return "?"
    username_len = data[33]
    if len(data) < 34 + username_len:
        return "?"
    return data[34:34 + username_len].decode("ascii", errors="replace")


def resolve_backend(build: int) -> Optional[Tuple[str, int, str]]:
    """Find the backend auth server for a given client build."""
    for min_b, max_b, host, port, label in BACKENDS:
        if min_b <= build <= max_b:
            return host, port, label
    return None


def build_proxy_v2_header(src_ip: str, dst_ip: str, src_port: int, dst_port: int) -> bytes:
    """
    Build a PROXY protocol v2 binary header.
    Spec: https://www.haproxy.org/download/2.9/doc/proxy-protocol.txt

    Signature (12 bytes) + ver_cmd (1) + fam_proto (1) + addr_len (2) + addresses
    """
    import socket as _socket

    # 12-byte signature
    signature = b"\x0d\x0a\x0d\x0a\x00\x0d\x0a\x51\x55\x49\x54\x0a"

    # Version (2) << 4 | Command (1 = PROXY)
    ver_cmd = 0x21

    # Address family (AF_INET=1) << 4 | Transport (STREAM=1)
    fam_proto = 0x11

    # IPv4 addresses: 4+4+2+2 = 12 bytes
    addr_len = 12

    src_addr = _socket.inet_aton(src_ip)
    dst_addr = _socket.inet_aton(dst_ip)

    header = signature
    header += struct.pack("!BBH", ver_cmd, fam_proto, addr_len)
    header += src_addr + dst_addr
    header += struct.pack("!HH", src_port, dst_port)

    return header


async def pipe(label: str, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """Forward data from reader to writer until EOF."""
    try:
        while True:
            data = await reader.read(4096)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except (ConnectionResetError, BrokenPipeError, OSError):
        pass
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass


async def handle_client(client_reader: asyncio.StreamReader, client_writer: asyncio.StreamWriter):
    """Handle a new client connection."""
    peer = client_writer.get_extra_info("peername")
    peer_str = f"{peer[0]}:{peer[1]}" if peer else "unknown"

    try:
        # Read the first packet — CMD_AUTH_LOGON_CHALLENGE
        # We need at least MIN_CHALLENGE_SIZE bytes to extract the build
        first_data = await asyncio.wait_for(client_reader.read(512), timeout=10.0)

        if not first_data:
            log.debug(f"[{peer_str}] Empty connection, closing")
            client_writer.close()
            return

        build = parse_build_from_challenge(first_data)

        if build is None:
            log.warning(f"[{peer_str}] Could not parse build from packet (len={len(first_data)}, cmd=0x{first_data[0]:02x})")
            client_writer.close()
            return

        username = extract_username(first_data)
        backend = resolve_backend(build)

        if backend is None:
            log.warning(f"[{peer_str}] Unknown build {build} from user '{username}', rejecting")
            client_writer.close()
            return

        host, port, label = backend
        log.info(f"[{peer_str}] User '{username}' build={build} → {label} ({host}:{port})")

        # Connect to backend
        try:
            backend_reader, backend_writer = await asyncio.wait_for(
                asyncio.open_connection(host, port),
                timeout=5.0
            )
        except (OSError, asyncio.TimeoutError) as e:
            log.error(f"[{peer_str}] Cannot connect to {label} backend {host}:{port}: {e}")
            client_writer.close()
            return

        # Send PROXY protocol v2 header so backend sees real client IP
        # Only VMaNGOS (Vanilla) supports PROXY protocol v2
        if SEND_PROXY_PROTOCOL and label == "Vanilla":
            local = backend_writer.get_extra_info("sockname")
            proxy_header = build_proxy_v2_header(peer[0], local[0], peer[1], local[1])
            backend_writer.write(proxy_header)
            await backend_writer.drain()

        # Forward the first packet to backend
        backend_writer.write(first_data)
        await backend_writer.drain()

        # Bidirectional pipe
        await asyncio.gather(
            pipe(f"{peer_str}→{label}", client_reader, backend_writer),
            pipe(f"{label}→{peer_str}", backend_reader, client_writer),
        )

        log.debug(f"[{peer_str}] Session ended ({label})")

    except asyncio.TimeoutError:
        log.debug(f"[{peer_str}] Timeout waiting for first packet")
    except Exception as e:
        log.error(f"[{peer_str}] Error: {e}")
    finally:
        try:
            client_writer.close()
            await client_writer.wait_closed()
        except Exception:
            pass


async def main():
    server = await asyncio.start_server(handle_client, LISTEN_HOST, LISTEN_PORT)

    addresses = ", ".join(str(sock.getsockname()) for sock in server.sockets)
    log.info(f"WoW Auth Proxy listening on {addresses}")
    log.info(f"Backends:")
    for min_b, max_b, host, port, label in BACKENDS:
        log.info(f"  {label}: builds {min_b}-{max_b} → {host}:{port}")

    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Shutting down")
        sys.exit(0)
