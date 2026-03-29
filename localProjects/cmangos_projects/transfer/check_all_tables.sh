#!/bin/bash
DB="${DB_PASSWORD}"
D="docker exec cmangos-wotlk-db mariadb -u root -p$DB wotlkcharacters"

echo "=== All tables with guid=1801 data ==="
TABLES=$($D -N -e "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_TYPE='BASE TABLE'" 2>/dev/null)

for t in $TABLES; do
  # Check if table has guid column
  HAS_GUID=$($D -N -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='$t' AND COLUMN_NAME='guid'" 2>/dev/null)
  if [ "$HAS_GUID" = "1" ]; then
    CNT=$($D -N -e "SELECT COUNT(*) FROM \`$t\` WHERE guid=1801" 2>/dev/null)
    if [ "$CNT" != "0" ] && [ -n "$CNT" ]; then
      echo "  $t: $CNT rows (guid)"
    fi
  fi
  # Check owner column
  HAS_OWNER=$($D -N -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='$t' AND COLUMN_NAME='owner'" 2>/dev/null)
  if [ "$HAS_OWNER" = "1" ]; then
    CNT=$($D -N -e "SELECT COUNT(*) FROM \`$t\` WHERE owner=1801" 2>/dev/null)
    if [ "$CNT" != "0" ] && [ -n "$CNT" ]; then
      echo "  $t: $CNT rows (owner)"
    fi
  fi
  # Check owner_guid column
  HAS_OG=$($D -N -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='$t' AND COLUMN_NAME='owner_guid'" 2>/dev/null)
  if [ "$HAS_OG" = "1" ]; then
    CNT=$($D -N -e "SELECT COUNT(*) FROM \`$t\` WHERE owner_guid=1801" 2>/dev/null)
    if [ "$CNT" != "0" ] && [ -n "$CNT" ]; then
      echo "  $t: $CNT rows (owner_guid)"
    fi
  fi
done

echo ""
echo "=== Check character_homebind ==="
$D -e "SELECT * FROM character_homebind WHERE guid=1801" 2>/dev/null

echo ""
echo "=== Check character_instance ==="
$D -e "SELECT * FROM character_instance WHERE guid=1801" 2>/dev/null

echo ""
echo "=== Check group_member ==="
$D -e "SELECT * FROM group_member WHERE memberGuid=1801" 2>/dev/null

echo ""
echo "=== Server status ==="
docker ps --filter name=cmangos-wotlk-server --format "{{.Status}}"
