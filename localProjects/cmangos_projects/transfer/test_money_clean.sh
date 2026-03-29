#!/bin/bash
DB="${DB_PASSWORD}"
D="docker exec cmangos-wotlk-db mariadb -u root -p$DB wotlkcharacters"

echo "=== Reclone baseline ==="
ACCT=$($D -N -e "SELECT account FROM characters WHERE guid=1801" 2>/dev/null)
$D -e "DELETE FROM characters WHERE guid=1801" 2>/dev/null
COLS=$($D -N -e "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='characters' AND COLUMN_NAME NOT IN ('guid','name','account')" 2>/dev/null)
$D -e "INSERT INTO characters (guid, name, account, $COLS) SELECT 1801, 'Samuel', $ACCT, $COLS FROM characters WHERE guid=1802" 2>/dev/null
echo "Clone done"

echo "=== COMPREHENSIVE clean - EVERY table ==="
TABLES=$($D -N -e "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME != 'characters'" 2>/dev/null)

for t in $TABLES; do
  HAS_GUID=$($D -N -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='$t' AND COLUMN_NAME='guid'" 2>/dev/null)
  if [ "$HAS_GUID" = "1" ]; then
    $D -e "DELETE FROM \`$t\` WHERE guid=1801" 2>/dev/null
  fi
  HAS_OWNER=$($D -N -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='$t' AND COLUMN_NAME='owner'" 2>/dev/null)
  if [ "$HAS_OWNER" = "1" ]; then
    $D -e "DELETE FROM \`$t\` WHERE owner=1801" 2>/dev/null
  fi
  HAS_OG=$($D -N -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='$t' AND COLUMN_NAME='owner_guid'" 2>/dev/null)
  if [ "$HAS_OG" = "1" ]; then
    $D -e "DELETE FROM \`$t\` WHERE owner_guid=1801" 2>/dev/null
  fi
  HAS_MG=$($D -N -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='$t' AND COLUMN_NAME='memberGuid'" 2>/dev/null)
  if [ "$HAS_MG" = "1" ]; then
    $D -e "DELETE FROM \`$t\` WHERE memberGuid=1801" 2>/dev/null
  fi
done
echo "All tables cleaned for guid=1801"

echo "=== Set money=37903267 (NO login first!) ==="
$D -e "UPDATE characters SET money=37903267 WHERE guid=1801" 2>/dev/null
echo "money set"

echo "=== Verify ==="
$D -e "SELECT guid,name,at_login,playerFlags,playerBytes2,xp,money FROM characters WHERE guid=1801" 2>/dev/null

echo ""
echo "=== Double check: count of ALL rows related to guid=1801 ==="
TOTAL=0
for t in $TABLES; do
  for col in guid owner owner_guid memberGuid; do
    HAS=$($D -N -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='$t' AND COLUMN_NAME='$col'" 2>/dev/null)
    if [ "$HAS" = "1" ]; then
      CNT=$($D -N -e "SELECT COUNT(*) FROM \`$t\` WHERE \`$col\`=1801" 2>/dev/null)
      if [ "$CNT" != "0" ] && [ -n "$CNT" ]; then
        echo "  LEFTOVER: $t.$col = $CNT rows"
        TOTAL=$((TOTAL + CNT))
      fi
    fi
  done
done
echo "Total leftover rows: $TOTAL"
echo ""
echo "NOW login - no previous session, money=37903267 set directly"
