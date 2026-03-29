#!/bin/bash
# Set ADMIN password and test RA
DB_CONTAINER="cmangos-wotlk-db"
DB_PASS="${DB_PASSWORD}"

# Set password to 'admin' for ADMIN account
docker exec "$DB_CONTAINER" mariadb -u root -p"$DB_PASS" wotlkrealmd -e \
  "UPDATE account SET sha_pass_hash=SHA1(CONCAT(UPPER('ADMIN'),':',UPPER('admin'))) WHERE username='ADMIN'" 2>/dev/null
echo "Password updated"

# Verify
docker exec "$DB_CONTAINER" mariadb -u root -p"$DB_PASS" wotlkrealmd -e \
  "SELECT id,username,sha_pass_hash,gmlevel FROM account WHERE username='ADMIN'" 2>/dev/null

# Test RA connection
WOTLK_IP=$(docker inspect cmangos-wotlk-server --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
echo "WotLK IP: $WOTLK_IP"

python3 << 'PYEOF'
import socket, time, sys
ip = sys.argv[1] if len(sys.argv) > 1 else "172.21.0.3"
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(5)
try:
    s.connect((ip, 3443))
    time.sleep(0.3)
    banner = s.recv(1024).decode(errors='replace')
    print(f"BANNER: {banner.strip()}")
    s.send(b'ADMIN\r\n')
    time.sleep(0.3)
    resp = s.recv(1024).decode(errors='replace')
    print(f"AFTER USER: {resp.strip()}")
    s.send(b'admin\r\n')
    time.sleep(0.5)
    resp = s.recv(1024).decode(errors='replace')
    print(f"AFTER PASS: {resp.strip()}")
    s.send(b'server info\r\n')
    time.sleep(1)
    resp = s.recv(4096).decode(errors='replace')
    print(f"SERVER INFO: {resp.strip()}")
    s.close()
except Exception as e:
    print(f"ERROR: {e}")
PYEOF
