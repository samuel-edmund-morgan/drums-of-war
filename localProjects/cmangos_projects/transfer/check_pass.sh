#!/bin/bash
docker exec cmangos-wotlk-db mariadb -u root -p"${DB_PASSWORD}" wotlkrealmd -e "SELECT id,username,sha_pass_hash,gmlevel FROM account" 2>/dev/null
echo "---"
# Also check what hash format is expected
docker exec cmangos-wotlk-db mariadb -u root -p"${DB_PASSWORD}" wotlkrealmd -e "SELECT SHA1(CONCAT(UPPER('ADMIN'),':',UPPER('admin'))) AS expected_hash" 2>/dev/null
echo "---"
# Check Classic ADMIN password hash for reference
docker exec cmangos-db mariadb -u root -p"${DB_PASSWORD}" classicrealmd -e "SELECT id,username,sha_pass_hash FROM account WHERE username='ADMIN'" 2>/dev/null
