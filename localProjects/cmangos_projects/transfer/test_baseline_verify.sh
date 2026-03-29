#!/bin/bash
DB="${DB_PASSWORD}"
D="docker exec cmangos-wotlk-db mariadb -u root -p$DB wotlkcharacters"

echo "=== Reclone baseline ==="
ACCT=$($D -N -e "SELECT account FROM characters WHERE guid=1801" 2>/dev/null)
$D -e "DELETE FROM characters WHERE guid=1801" 2>/dev/null
COLS=$($D -N -e "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='characters' AND COLUMN_NAME NOT IN ('guid','name','account')" 2>/dev/null)
$D -e "INSERT INTO characters (guid, name, account, $COLS) SELECT 1801, 'Samuel', $ACCT, $COLS FROM characters WHERE guid=1802" 2>/dev/null
echo "Clone done"

echo "=== FIRST: verify Testlock can still login ==="
echo "Can you login as Testlock? Check if Testlock (guid=1802) exists:"
$D -e "SELECT guid,name,money,at_login FROM characters WHERE guid=1802" 2>/dev/null

echo ""
echo "=== Samuel clone - NO money change ==="
$D -e "SELECT guid,name,money,at_login,playerFlags,health FROM characters WHERE guid=1801" 2>/dev/null

echo ""
echo "=== Restart server ==="
docker restart cmangos-wotlk-server
echo "Waiting 30s..."
sleep 30
docker ps --filter name=cmangos-wotlk-server --format "{{.Status}}"

echo ""
echo "TEST PLAN:"
echo "1) First login as Samuel (should work - clean clone, no changes)"
echo "2) Tell me if it works"
echo "3) DO NOT logout yet - I need to check what server stored"
