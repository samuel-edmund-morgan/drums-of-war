#!/bin/bash
DB="${DB_PASSWORD}"
db() { docker exec cmangos-wotlk-db mariadb -u root -p"$DB" "$@" 2>/dev/null; }

echo "=== CHECK 1: Enchantment field value count for Samuel items ==="
echo "Classic items have 21 values (7 slots x 3), WotLK needs 36 (12 slots x 3) or 45 (15 x 3)"
db -N wotlkcharacters -e "
SELECT 
  MIN(LENGTH(enchantments) - LENGTH(REPLACE(enchantments, ' ', '')) + 1) as min_values,
  MAX(LENGTH(enchantments) - LENGTH(REPLACE(enchantments, ' ', '')) + 1) as max_values,
  COUNT(*) as total_items
FROM item_instance WHERE owner_guid=1801"

echo ""
echo "=== CHECK 2: How many enchantment values does a correctly-generated WotLK item have? ==="
echo "Checking ALL item_instances (not just Samuels):"
db -N wotlkcharacters -e "
SELECT 
  LENGTH(enchantments) - LENGTH(REPLACE(enchantments, ' ', '')) + 1 as num_values,
  COUNT(*) as num_items
FROM item_instance 
GROUP BY num_values
ORDER BY num_items DESC"

echo ""
echo "=== CHECK 3: Active quests (status=3 = QUEST_STATUS_INCOMPLETE) ==="
db -N wotlkcharacters -e "SELECT quest, status, rewarded FROM character_queststatus WHERE guid=1801 AND status=3"

echo ""
echo "=== CHECK 4: Any character_spell_cooldown ==="
db -N wotlkcharacters -e "SELECT COUNT(*) FROM character_spell_cooldown WHERE guid=1801"

echo ""
echo "=== CHECK 5: item_instance columns and their defaults ==="
db -N -e "SELECT COLUMN_NAME, COLUMN_DEFAULT, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='item_instance' ORDER BY ORDINAL_POSITION"

echo ""
echo "=== CHECK 6: Check playedTime and text for Samuel items ==="
db -N wotlkcharacters -e "SELECT guid, playedTime, text FROM item_instance WHERE owner_guid=1801 AND (playedTime != 0 OR text != '') LIMIT 10"
echo "(empty = all zeros/empty, which is correct)"

echo ""
echo "=== CHECK 7: Compare charges field format ==="
db -N wotlkcharacters -e "
SELECT 
  LENGTH(charges) - LENGTH(REPLACE(charges, ' ', '')) + 1 as charge_values,
  COUNT(*) as cnt
FROM item_instance WHERE owner_guid=1801
GROUP BY charge_values"

echo "=== DONE ==="
