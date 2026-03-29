#!/bin/bash
DB="${DB_PASSWORD}"
db() { docker exec cmangos-wotlk-db mariadb -u root -p"$DB" "$@" 2>/dev/null; }

echo "=== FIELD-BY-FIELD COMPARISON: Samuel (1801) vs Testlock (1802) ==="
echo ""

# Get column names
COLS=$(db -N -e "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='characters' ORDER BY ORDINAL_POSITION")

for col in $COLS; do
  val1=$(db -N wotlkcharacters -e "SELECT \`$col\` FROM characters WHERE guid=1801")
  val2=$(db -N wotlkcharacters -e "SELECT \`$col\` FROM characters WHERE guid=1802")
  
  if [ "$val1" = "$val2" ]; then
    mark="  SAME"
  else
    mark="<<< DIFFERENT >>>"
  fi
  
  # Truncate long values for display
  v1_display="$val1"
  v2_display="$val2"
  if [ ${#val1} -gt 80 ]; then
    v1_display="${val1:0:80}..."
  fi
  if [ ${#val2} -gt 80 ]; then
    v2_display="${val2:0:80}..."
  fi
  
  printf "%-25s %s\n" "$col" "$mark"
  if [ "$mark" != "  SAME" ]; then
    echo "  Samuel:   $v1_display"
    echo "  Testlock: $v2_display"
  fi
done
