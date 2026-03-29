#!/bin/bash
set -x

# Check all accounts
docker exec cmangos-wotlk-db mariadb -u root -p"${DB_PASSWORD}" -e "SELECT id,username,sha_pass_hash,gmlevel FROM wotlkrealmd.account;" 2>/dev/null

echo "==="

# Set ADMIN password properly  
docker exec cmangos-wotlk-db mariadb -u root -p"${DB_PASSWORD}" -e "UPDATE wotlkrealmd.account SET sha_pass_hash=SHA1(CONCAT(UPPER('ADMIN'),':',UPPER('admin'))), v='', s='' WHERE id=13;" 2>/dev/null

echo "Password updated"

# Verify
docker exec cmangos-wotlk-db mariadb -u root -p"${DB_PASSWORD}" -e "SELECT id,username,sha_pass_hash FROM wotlkrealmd.account WHERE id=13;" 2>/dev/null
