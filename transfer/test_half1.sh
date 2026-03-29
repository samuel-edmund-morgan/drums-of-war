#!/bin/bash
DB="${DB_PASSWORD}"
D="docker exec cmangos-wotlk-db mariadb -u root -p$DB wotlkcharacters"

echo "=== Reclone baseline ==="
ACCT=$($D -N -e "SELECT account FROM characters WHERE guid=1801" 2>/dev/null)
$D -e "DELETE FROM characters WHERE guid=1801" 2>/dev/null
COLS=$($D -N -e "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='characters' AND COLUMN_NAME NOT IN ('guid','name','account')" 2>/dev/null)
$D -e "INSERT INTO characters (guid, name, account, $COLS) SELECT 1801, 'Samuel', $ACCT, $COLS FROM characters WHERE guid=1802" 2>/dev/null

for t in character_spell character_skills character_reputation character_action character_aura character_stats character_inventory character_account_data character_queststatus character_social character_spell_cooldown character_achievement character_achievement_progress character_talent; do
  $D -e "DELETE FROM $t WHERE guid=1801" 2>/dev/null
done
$D -e "DELETE FROM item_instance WHERE owner_guid=1801; DELETE FROM character_pet WHERE owner=1801" 2>/dev/null
echo "Clone + clean done"

echo "=== Set HALF 1: xp, money, totaltime, leveltime, logout_time ==="
$D -e "UPDATE characters SET xp=31, money=37903267, totaltime=1202050, leveltime=146378, logout_time=1772560692 WHERE guid=1801" 2>/dev/null
echo "Half 1 set"

echo "=== Verify ==="
$D -e "SELECT guid,name,at_login,playerFlags,playerBytes2,xp,money,totaltime,leveltime,logout_time FROM characters WHERE guid=1801" 2>/dev/null
