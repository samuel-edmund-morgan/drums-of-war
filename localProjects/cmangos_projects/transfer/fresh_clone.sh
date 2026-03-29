#!/bin/bash
DB="${DB_PASSWORD}"
D="docker exec cmangos-wotlk-db mariadb -u root -p$DB wotlkcharacters"

echo "=== Step 1: Get Testlock row ==="
# Save Testlock's full row, then insert as Samuel
$D -N -e "SELECT account FROM characters WHERE guid=1801" 2>/dev/null > /tmp/samuel_acct.txt
ACCT=$($D -N -e "SELECT account FROM characters WHERE guid=1801" 2>/dev/null)
echo "Samuel's account: $ACCT"

echo "=== Step 2: Delete Samuel ==="
$D -e "DELETE FROM characters WHERE guid=1801" 2>/dev/null
echo "Samuel deleted"

echo "=== Step 3: Clone Testlock as Samuel ==="
# Get column list excluding guid, name, account
COLS=$($D -N -e "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='characters' AND COLUMN_NAME NOT IN ('guid','name','account')" 2>/dev/null)
echo "Columns: $(echo $COLS | cut -c1-80)..."

$D -e "INSERT INTO characters (guid, name, account, $COLS) SELECT 1801, 'Samuel', $ACCT, $COLS FROM characters WHERE guid=1802" 2>/dev/null
echo "Clone inserted"

echo "=== Step 4: Clean secondary ==="
for t in character_spell character_skills character_reputation character_action character_aura character_stats character_inventory character_account_data character_queststatus character_social character_spell_cooldown character_achievement character_achievement_progress character_talent; do
  $D -e "DELETE FROM $t WHERE guid=1801" 2>/dev/null
done
$D -e "DELETE FROM item_instance WHERE owner_guid=1801" 2>/dev/null
$D -e "DELETE FROM character_pet WHERE owner=1801" 2>/dev/null
echo "Secondary cleaned"

echo "=== Step 5: Verify clone is exact ==="
echo "--- Samuel vs Testlock key fields ---"
$D -e "SELECT guid,name,at_login,playerFlags,playerBytes2,health,power1,xp,money,totaltime,rest_bonus,zone FROM characters WHERE guid IN (1801,1802)" 2>/dev/null

echo ""
echo "Try login NOW to confirm baseline works."
