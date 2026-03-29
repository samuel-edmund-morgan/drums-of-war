#!/bin/bash
WOTLK_IP=$(docker inspect cmangos-wotlk-server --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
echo "IP: $WOTLK_IP"

python3 << PYEOF
import socket, time
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(5)
s.connect(("$WOTLK_IP", 3443))
time.sleep(0.3)
print("BANNER:", s.recv(1024).decode(errors='replace').strip())
s.send(b'ADMIN\r\n')
time.sleep(0.3)
print("AFTER USER:", s.recv(1024).decode(errors='replace').strip())
s.send(b'admin\r\n')
time.sleep(0.5)
resp = s.recv(1024).decode(errors='replace').strip()
print("AFTER PASS:", resp)
if "Wrong" in resp:
    print("AUTH FAILED")
    s.close()
    exit(1)
s.send(b'server info\r\n')
time.sleep(1)
print("SERVER INFO:", s.recv(4096).decode(errors='replace').strip())
s.close()
PYEOF
