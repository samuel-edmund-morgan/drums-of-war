#!/bin/bash
DB="${DB_PASSWORD}"
db() { docker exec cmangos-wotlk-db mariadb -u root -p"$DB" "$@" 2>/dev/null; }

echo "=== CHECK: What data was saved for Samuel during previous successful login? ==="
for tbl in character_spell character_skills character_reputation character_action character_aura character_stats character_inventory character_account_data character_queststatus; do
  cnt=$(db -N wotlkcharacters -e "SELECT COUNT(*) FROM $tbl WHERE guid=1801")
  echo "  $tbl: $cnt"
done
cnt=$(db -N wotlkcharacters -e "SELECT COUNT(*) FROM item_instance WHERE owner_guid=1801")
echo "  item_instance: $cnt"
cnt=$(db -N wotlkcharacters -e "SELECT COUNT(*) FROM character_pet WHERE owner=1801")
echo "  character_pet: $cnt"

echo ""
echo "=== NUKE everything server saved (back to clean) ==="
db wotlkcharacters -e "
DELETE FROM character_spell WHERE guid=1801;
DELETE FROM character_skills WHERE guid=1801;
DELETE FROM character_reputation WHERE guid=1801;
DELETE FROM character_action WHERE guid=1801;
DELETE FROM character_aura WHERE guid=1801;
DELETE FROM character_stats WHERE guid=1801;
DELETE FROM character_inventory WHERE guid=1801;
DELETE FROM character_account_data WHERE guid=1801;
DELETE FROM character_queststatus WHERE guid=1801;
DELETE FROM character_social WHERE guid=1801;
DELETE FROM character_spell_cooldown WHERE guid=1801;
DELETE FROM item_instance WHERE owner_guid=1801;
DELETE FROM character_pet WHERE owner=1801;
DELETE FROM character_achievement WHERE guid=1801;
DELETE FROM character_achievement_progress WHERE guid=1801;
DELETE FROM character_talent WHERE guid=1801;
"
echo "All secondary data nuked."

echo ""
echo "=== FULL REVERT: Clone Testlock into Samuel again ==="
COLS=$(db -N -e "SELECT GROUP_CONCAT(COLUMN_NAME) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='characters' AND COLUMN_NAME NOT IN ('guid','name','account','deleteInfos_Account','deleteInfos_Name','deleteDate') ORDER BY ORDINAL_POSITION")

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
db wotlkcharacters -e "$UPDATE_SQL"
echo "Samuel = exact Testlock clone again."

echo ""
echo "=== Verify clean state ==="
for tbl in character_spell character_skills character_reputation character_action; do
  cnt=$(db -N wotlkcharacters -e "SELECT COUNT(*) FROM $tbl WHERE guid=1801")
  echo "  $tbl: $cnt"
done
db -N wotlkcharacters -e "SELECT guid,name,at_login,health,power1 FROM characters WHERE guid=1801"

echo ""
echo "Try logging in. If CRASH: the server saved corrupt state that persists somewhere."
echo "If WORKS: we have clean baseline again for single-field testing."
