#!/bin/bash
# Binary search: strip Samuel to absolute minimum like Testlock
DB="${DB_PASSWORD}"
db() { docker exec cmangos-wotlk-db mariadb -u root -p"$DB" "$@" 2>/dev/null; }

echo "=== BACKUP all Samuel data ==="
db wotlkcharacters -e "CREATE TABLE IF NOT EXISTS _bak2_inventory AS SELECT * FROM character_inventory WHERE guid=1801"
db wotlkcharacters -e "CREATE TABLE IF NOT EXISTS _bak2_items AS SELECT * FROM item_instance WHERE owner_guid=1801"
db wotlkcharacters -e "CREATE TABLE IF NOT EXISTS _bak2_quests AS SELECT * FROM character_queststatus WHERE guid=1801"
db wotlkcharacters -e "CREATE TABLE IF NOT EXISTS _bak2_rep AS SELECT * FROM character_reputation WHERE guid=1801"
db wotlkcharacters -e "CREATE TABLE IF NOT EXISTS _bak2_skills AS SELECT * FROM character_skills WHERE guid=1801"
db wotlkcharacters -e "CREATE TABLE IF NOT EXISTS _bak2_account_data AS SELECT * FROM character_account_data WHERE guid=1801"
echo "Backups done"

echo ""
echo "=== DELETE everything except characters row ==="
db wotlkcharacters -e "
DELETE FROM character_inventory WHERE guid=1801;
DELETE FROM item_instance WHERE owner_guid=1801;
DELETE FROM character_queststatus WHERE guid=1801;
DELETE FROM character_reputation WHERE guid=1801;
DELETE FROM character_skills WHERE guid=1801;
DELETE FROM character_account_data WHERE guid=1801;
DELETE FROM character_spell WHERE guid=1801;
DELETE FROM character_spell_cooldown WHERE guid=1801;
DELETE FROM character_aura WHERE guid=1801;
DELETE FROM character_action WHERE guid=1801;
DELETE FROM character_social WHERE guid=1801;
DELETE FROM character_pet WHERE owner=1801;
DELETE FROM character_stats WHERE guid=1801;
"
echo "All secondary data deleted"

echo ""
echo "=== Verify Samuel is completely clean ==="
for tbl in character_inventory character_queststatus character_reputation character_skills character_spell character_aura character_action character_social character_stats character_account_data; do
  cnt=$(db -N wotlkcharacters -e "SELECT COUNT(*) FROM $tbl WHERE guid=1801")
  echo "  $tbl: $cnt"
done
cnt=$(db -N wotlkcharacters -e "SELECT COUNT(*) FROM item_instance WHERE owner_guid=1801")
echo "  item_instance: $cnt"
cnt=$(db -N wotlkcharacters -e "SELECT COUNT(*) FROM character_pet WHERE owner=1801")
echo "  character_pet: $cnt"

echo ""
echo "=== Samuel characters row ==="
db -N wotlkcharacters -e "SELECT guid,name,class,level,at_login FROM characters WHERE guid=1801"

echo ""
echo "=== Testlock for comparison ==="
for tbl in character_inventory character_queststatus character_reputation character_skills character_spell character_aura character_action; do
  cnt=$(db -N wotlkcharacters -e "SELECT COUNT(*) FROM $tbl WHERE guid=1802")
  echo "  $tbl: $cnt"
done
cnt=$(db -N wotlkcharacters -e "SELECT COUNT(*) FROM item_instance WHERE owner_guid=1802")
echo "  item_instance: $cnt"

echo ""
echo "Now Samuel should be as clean as Testlock. Try logging in."
echo "If it works: problem is in secondary data (items/quests/rep/skills)"
echo "If crash: problem is in the characters ROW itself"
