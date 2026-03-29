#!/bin/bash
DB="${DB_PASSWORD}"
D="docker exec cmangos-wotlk-db mariadb -u root -p$DB wotlkcharacters"

echo "=== Reclone baseline ==="
ACCT=$($D -N -e "SELECT account FROM characters WHERE guid=1801" 2>/dev/null)
$D -e "DELETE FROM characters WHERE guid=1801" 2>/dev/null
COLS=$($D -N -e "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='characters' AND COLUMN_NAME NOT IN ('guid','name','account')" 2>/dev/null)
$D -e "INSERT INTO characters (guid, name, account, $COLS) SELECT 1801, 'Samuel', $ACCT, $COLS FROM characters WHERE guid=1802" 2>/dev/null
echo "Clone done"

# Clean secondary
for t in character_spell character_skills character_reputation character_action character_aura character_stats character_inventory character_account_data character_queststatus character_social character_spell_cooldown character_achievement character_achievement_progress character_talent; do
  $D -e "DELETE FROM $t WHERE guid=1801" 2>/dev/null
done
$D -e "DELETE FROM item_instance WHERE owner_guid=1801; DELETE FROM character_pet WHERE owner=1801" 2>/dev/null
echo "Secondary cleaned"

echo "=== Set ALL original numerics ==="
$D -e "UPDATE characters SET xp=31, money=37903267, totaltime=1202050, leveltime=146378, logout_time=1772560692, rest_bonus=0, resettalents_cost=100000, resettalents_time=1752771490, watchedFaction=42, health=7234, power1=7348, power2=0, power4=100, actionBars=15, fishingSteps=2, at_login=6, cinematic=1, playerFlags=2080, playerBytes2=33947654 WHERE guid=1801" 2>/dev/null
echo "Numerics set"

echo "=== Verify ==="
$D -e "SELECT guid,name,at_login,playerFlags,playerBytes2,health,xp,money FROM characters WHERE guid=1801" 2>/dev/null
echo ""
echo "Test: ALL original numerics, Testlock text fields (taximask/exploredZones/equipmentCache)"
