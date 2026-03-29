#!/bin/bash
DB="${DB_PASSWORD}"
D="docker exec cmangos-wotlk-db mariadb -u root -p$DB wotlkcharacters"

echo "=== Full cleanup ==="

echo "--- Delete Samuel completely ---"
$D -e "DELETE FROM characters WHERE guid=1801" 2>/dev/null

echo "--- Clean ALL Samuel references ---"
TABLES=$($D -N -e "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_TYPE='BASE TABLE'" 2>/dev/null)
for t in $TABLES; do
  for col in guid owner owner_guid memberGuid; do
    HAS=$($D -N -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='$t' AND COLUMN_NAME='$col'" 2>/dev/null)
    if [ "$HAS" = "1" ]; then
      $D -e "DELETE FROM \`$t\` WHERE \`$col\`=1801" 2>/dev/null
    fi
  done
done
echo "Samuel purged"

echo "--- Reset Testlock to clean state ---"
$D -e "UPDATE characters SET money=0, online=0 WHERE guid=1802" 2>/dev/null
echo "Testlock reset"

echo "--- Drop all backup tables ---"
BAKTABLES=$($D -N -e "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME LIKE '_bak%'" 2>/dev/null)
for t in $BAKTABLES; do
  echo "Dropping $t"
  $D -e "DROP TABLE IF EXISTS \`$t\`" 2>/dev/null
done
echo "Backup tables dropped"

echo "--- Check DB integrity ---"
$D -e "CHECK TABLE characters" 2>/dev/null

echo ""
echo "=== Restart server ==="
docker restart cmangos-wotlk-server
echo "Waiting 35s for boot..."
sleep 35
docker ps --filter name=cmangos-wotlk-server --format "{{.Status}}"

echo ""
echo "=== Verify - only Testlock should exist ==="
$D -e "SELECT guid,name,money,at_login,online FROM characters" 2>/dev/null

echo ""
echo "Login as TESTLOCK (money=0). This MUST work. If it crashes, server is fundamentally broken."
