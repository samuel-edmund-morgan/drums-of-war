#!/bin/bash
DB="${DB_PASSWORD}"
D="docker exec cmangos-wotlk-db mariadb -u root -p$DB wotlkcharacters"

echo "=== Reclone baseline ==="
ACCT=$($D -N -e "SELECT account FROM characters WHERE guid=1801" 2>/dev/null)
$D -e "DELETE FROM characters WHERE guid=1801" 2>/dev/null
COLS=$($D -N -e "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='characters' AND COLUMN_NAME NOT IN ('guid','name','account')" 2>/dev/null)
$D -e "INSERT INTO characters (guid, name, account, $COLS) SELECT 1801, 'Samuel', $ACCT, $COLS FROM characters WHERE guid=1802" 2>/dev/null
echo "Clone done"

echo "=== Set money=37903267 ==="
$D -e "UPDATE characters SET money=37903267 WHERE guid=1801" 2>/dev/null
echo "money set"

echo "=== Restarting WotLK server to clear memory cache ==="
docker restart cmangos-wotlk-server
echo "Waiting for server to boot..."
sleep 30
echo "Server status:"
docker ps --filter name=cmangos-wotlk-server --format "{{.Status}}"

echo ""
echo "=== Verify DB ==="
$D -e "SELECT guid,name,at_login,playerFlags,playerBytes2,xp,money FROM characters WHERE guid=1801" 2>/dev/null
echo ""
echo "Server restarted. NOW login - clean memory, no stale cache."
