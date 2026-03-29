#!/bin/bash
DB="${DB_PASSWORD}"
db() { docker exec cmangos-wotlk-db mariadb -u root -p"$DB" "$@" 2>/dev/null; }

echo "=== STEP 1: Full revert to Testlock clone ==="
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
echo "Full Testlock clone done."

echo ""
echo "=== STEP 2: Clean all secondary data ==="
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
echo "All secondary data cleaned."

echo ""
echo "=== STEP 3: Restore ALL original Samuel values EXCEPT suspicious ones ==="
echo "KEEPING Testlock values for: playerFlags, playerBytes2, equipmentCache"
echo "RESTORING original Samuel values for everything else"
db wotlkcharacters -e "
UPDATE characters SET
  xp = 31,
  money = 37903267,
  totaltime = 1202050,
  leveltime = 146378,
  logout_time = 1772560692,
  rest_bonus = 0,
  resettalents_cost = 100000,
  resettalents_time = 1752771490,
  watchedFaction = 42,
  health = 7234,
  power1 = 7348,
  power2 = 0,
  power4 = 100,
  actionBars = 15,
  fishingSteps = 2,
  at_login = 6,
  cinematic = 1,
  taximask = '3456411898 2148078929 49991 0 0 0 0 0 0 0 0 0 0 0 ',
  exploredZones = '1121058871 2742896513 1082914479 2005094400 3321852831 4294451086 3929011967 1375756414 1073878092 1172766958 4249333247 4235171551 3175091455 1813033177 92842096 859871384 4292348222 824767063 4225492685 124987362 9307094 27205603 4260593412 3883925053 3998612975 3557589438 3200700059 2652937050 1027604480 1979997117 2147571383 1621281190 2148647891 252 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 '
WHERE guid = 1801
"
echo "Done. Restored all EXCEPT playerFlags(keep 32), playerBytes2(keep 17170438), equipmentCache(keep 40-value format)"

echo ""
echo "=== Verify ==="
db -N wotlkcharacters -e "SELECT guid,name,xp,money,health,power1,playerFlags,playerBytes2,at_login FROM characters WHERE guid=1801"

echo ""
echo "Try login. If WORKS: problem is in playerFlags/playerBytes2/equipmentCache."
echo "If CRASHES: problem is in taximask or exploredZones or one of the restored numerics."
