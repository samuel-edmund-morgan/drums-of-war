#!/bin/bash
DB="${DB_PASSWORD}"
D="docker exec cmangos-wotlk-db mariadb -u root -p$DB wotlkcharacters"

echo "=== Samuel WHILE ONLINE - characters row ==="
$D -e "SELECT * FROM characters WHERE guid=1801\G" 2>/dev/null

echo ""
echo "=== All secondary tables with data ==="
TABLES=$($D -N -e "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME != 'characters'" 2>/dev/null)

for t in $TABLES; do
  for col in guid owner owner_guid memberGuid; do
    HAS=$($D -N -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='$t' AND COLUMN_NAME='$col'" 2>/dev/null)
    if [ "$HAS" = "1" ]; then
      CNT=$($D -N -e "SELECT COUNT(*) FROM \`$t\` WHERE \`$col\`=1801" 2>/dev/null)
      if [ "$CNT" != "0" ] && [ -n "$CNT" ]; then
        echo "--- $t ($col): $CNT rows ---"
        $D -e "SELECT * FROM \`$t\` WHERE \`$col\`=1801 LIMIT 5" 2>/dev/null
        echo ""
      fi
    fi
  done
done
