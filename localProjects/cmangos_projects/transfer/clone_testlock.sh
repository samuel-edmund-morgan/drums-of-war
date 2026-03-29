#!/bin/bash
DB="${DB_PASSWORD}"
db() { docker exec cmangos-wotlk-db mariadb -u root -p"$DB" "$@" 2>/dev/null; }

echo "=== CLONE Testlock row INTO Samuel (keep guid=1801, name=Samuel) ==="

# Get ALL columns except guid, name, account, deleteInfos_*
COLS=$(db -N -e "SELECT GROUP_CONCAT(COLUMN_NAME) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='characters' AND COLUMN_NAME NOT IN ('guid','name','account','deleteInfos_Account','deleteInfos_Name','deleteDate') ORDER BY ORDINAL_POSITION")

echo "Columns to copy: $COLS"
echo ""

# Build UPDATE SET from Testlock values
UPDATE_SQL="UPDATE characters dst JOIN characters src ON src.guid=1802 SET "
FIRST=1
IFS=',' read -ra COL_ARRAY <<< "$COLS"
for col in "${COL_ARRAY[@]}"; do
  if [ $FIRST -eq 1 ]; then
    UPDATE_SQL="${UPDATE_SQL}dst.\`${col}\`=src.\`${col}\`"
    FIRST=0
  else
    UPDATE_SQL="${UPDATE_SQL}, dst.\`${col}\`=src.\`${col}\`"
  fi
done
UPDATE_SQL="${UPDATE_SQL} WHERE dst.guid=1801"

echo "Running UPDATE..."
db wotlkcharacters -e "$UPDATE_SQL"
echo "Done."

echo ""
echo "=== Verify Samuel now matches Testlock ==="
echo "Samuel:"
db -N wotlkcharacters -e "SELECT guid,name,class,level,playerBytes,playerBytes2,playerFlags,health,power1,power2,at_login,equipmentCache FROM characters WHERE guid=1801"
echo "Testlock:"
db -N wotlkcharacters -e "SELECT guid,name,class,level,playerBytes,playerBytes2,playerFlags,health,power1,power2,at_login,equipmentCache FROM characters WHERE guid=1802"

echo ""
echo "Samuel is now a CLONE of Testlock (same data, different guid/name)."
echo "Try logging in. This MUST work if Testlock works."
