#!/bin/bash
#
# TBC → WotLK Character Transfer Script
# Transfers Samuel (TBC guid=1801) into Testlock (WotLK guid=1802)
# by renaming Testlock and transferring secondary data.
#
# KEY PRINCIPLE: We do NOT touch the WotLK 'characters' row structure.
# It was created natively by the WotLK server, so all WotLK-specific
# fields are already correct. We only UPDATE safe cosmetic/value fields.
#

set -euo pipefail

# === Config ===
TBC_DB_CONTAINER="cmangos-tbc-db"
WOTLK_DB_CONTAINER="cmangos-wotlk-db"
DB_PASS="${DB_PASSWORD}"
TBC_DB="tbccharacters"
WOTLK_DB="wotlkcharacters"
WOTLK_MANGOS_DB="wotlkmangos"

SRC_GUID=1801   # Samuel on TBC
DST_GUID=1802   # Testlock on WotLK (will become Samuel)
DST_ACCOUNT=12  # SAMUEL account on WotLK

tbc_sql() {
    docker exec "$TBC_DB_CONTAINER" mariadb -u root -p"$DB_PASS" "$TBC_DB" -N -e "$1" 2>/dev/null
}

wotlk_sql() {
    docker exec "$WOTLK_DB_CONTAINER" mariadb -u root -p"$DB_PASS" "$WOTLK_DB" -N -e "$1" 2>/dev/null
}

wotlk_sql_batch() {
    # For multi-line SQL via stdin
    docker exec -i "$WOTLK_DB_CONTAINER" mariadb -u root -p"$DB_PASS" "$WOTLK_DB" 2>/dev/null
}

echo "============================================"
echo "  TBC → WotLK Character Transfer"
echo "  Source: Samuel (TBC guid=$SRC_GUID)"
echo "  Target: Testlock (WotLK guid=$DST_GUID)"
echo "============================================"

# === Step 0: Safety checks ===
echo ""
echo "=== Step 0: Safety Checks ==="

# Check Testlock exists and is offline
TESTLOCK_STATUS=$(wotlk_sql "SELECT name,online FROM characters WHERE guid=$DST_GUID")
if [ -z "$TESTLOCK_STATUS" ]; then
    echo "ERROR: Testlock (guid=$DST_GUID) not found on WotLK!"
    exit 1
fi
echo "Target character: $TESTLOCK_STATUS"

ONLINE=$(echo "$TESTLOCK_STATUS" | awk '{print $2}')
if [ "$ONLINE" != "0" ]; then
    echo "ERROR: Target character is online! Log out first."
    exit 1
fi

# Check TBC Samuel exists
TBC_CHECK=$(tbc_sql "SELECT name,level,class FROM characters WHERE guid=$SRC_GUID")
if [ -z "$TBC_CHECK" ]; then
    echo "ERROR: Samuel (guid=$SRC_GUID) not found on TBC!"
    exit 1
fi
echo "Source character: $TBC_CHECK"
echo "Safety checks passed ✓"

# === Step 1: Rename and update safe fields ===
echo ""
echo "=== Step 1: Rename Testlock → Samuel + Update Safe Fields ==="

# Get TBC values for safe fields
TBC_DATA=$(tbc_sql "SELECT name, level, xp, money, playerBytes, playerBytes2, playerFlags, \
position_x, position_y, position_z, map, orientation, totaltime, leveltime, \
rest_bonus, is_logout_resting, zone, drunk, health, power1, power2, power3, power4, power5, \
ammoId, actionBars \
FROM characters WHERE guid=$SRC_GUID")

# Parse values
NAME=$(echo "$TBC_DATA" | awk -F'\t' '{print $1}')
LEVEL=$(echo "$TBC_DATA" | awk -F'\t' '{print $2}')
XP=$(echo "$TBC_DATA" | awk -F'\t' '{print $3}')
MONEY=$(echo "$TBC_DATA" | awk -F'\t' '{print $4}')
PBYTES=$(echo "$TBC_DATA" | awk -F'\t' '{print $5}')
PBYTES2=$(echo "$TBC_DATA" | awk -F'\t' '{print $6}')
PFLAGS=$(echo "$TBC_DATA" | awk -F'\t' '{print $7}')
POS_X=$(echo "$TBC_DATA" | awk -F'\t' '{print $8}')
POS_Y=$(echo "$TBC_DATA" | awk -F'\t' '{print $9}')
POS_Z=$(echo "$TBC_DATA" | awk -F'\t' '{print $10}')
MAP=$(echo "$TBC_DATA" | awk -F'\t' '{print $11}')
ORIENT=$(echo "$TBC_DATA" | awk -F'\t' '{print $12}')
TOTALTIME=$(echo "$TBC_DATA" | awk -F'\t' '{print $13}')
LEVELTIME=$(echo "$TBC_DATA" | awk -F'\t' '{print $14}')
REST_BONUS=$(echo "$TBC_DATA" | awk -F'\t' '{print $15}')
IS_LOGOUT_RESTING=$(echo "$TBC_DATA" | awk -F'\t' '{print $16}')
ZONE=$(echo "$TBC_DATA" | awk -F'\t' '{print $17}')
DRUNK=$(echo "$TBC_DATA" | awk -F'\t' '{print $18}')
HEALTH=$(echo "$TBC_DATA" | awk -F'\t' '{print $19}')
POWER1=$(echo "$TBC_DATA" | awk -F'\t' '{print $20}')
POWER2=$(echo "$TBC_DATA" | awk -F'\t' '{print $21}')
POWER3=$(echo "$TBC_DATA" | awk -F'\t' '{print $22}')
POWER4=$(echo "$TBC_DATA" | awk -F'\t' '{print $23}')
POWER5=$(echo "$TBC_DATA" | awk -F'\t' '{print $24}')
AMMOID=$(echo "$TBC_DATA" | awk -F'\t' '{print $25}')
ACTIONBARS=$(echo "$TBC_DATA" | awk -F'\t' '{print $26}')

# Get exploredZones (long string, handle separately)
EXPLORED=$(tbc_sql "SELECT exploredZones FROM characters WHERE guid=$SRC_GUID")
# WotLK exploredZones is longer (128 values vs 64 in TBC), pad with zeros
EXPLORED_PADDED="$EXPLORED"
# Count existing values
EXISTING_COUNT=$(echo "$EXPLORED" | wc -w | tr -d ' ')
# WotLK needs 128 values
NEEDED=$((128 - EXISTING_COUNT))
if [ "$NEEDED" -gt 0 ]; then
    PADDING=$(printf ' 0%.0s' $(seq 1 $NEEDED))
    EXPLORED_PADDED="${EXPLORED}${PADDING}"
fi

echo "Updating: name=$NAME level=$LEVEL money=$MONEY"

wotlk_sql "UPDATE characters SET
    name='$NAME',
    level=$LEVEL,
    xp=$XP,
    money=$MONEY,
    playerBytes=$PBYTES,
    playerBytes2=$PBYTES2,
    playerFlags=$PFLAGS,
    position_x=$POS_X,
    position_y=$POS_Y,
    position_z=$POS_Z,
    map=$MAP,
    orientation=$ORIENT,
    totaltime=$TOTALTIME,
    leveltime=$LEVELTIME,
    rest_bonus=$REST_BONUS,
    is_logout_resting=$IS_LOGOUT_RESTING,
    zone=$ZONE,
    drunk=$DRUNK,
    health=$HEALTH,
    power1=$POWER1,
    power2=$POWER2,
    power3=$POWER3,
    power4=$POWER4,
    power5=$POWER5,
    ammoId=$AMMOID,
    actionBars=$ACTIONBARS,
    exploredZones='$EXPLORED_PADDED',
    at_login=0,
    online=0,
    cinematic=1
WHERE guid=$DST_GUID"

echo "Main fields updated ✓"

# === Step 2: Transfer character_homebind ===
echo ""
echo "=== Step 2: Transfer character_homebind ==="
wotlk_sql "DELETE FROM character_homebind WHERE guid=$DST_GUID"
HOMEBIND=$(tbc_sql "SELECT map,zone,position_x,position_y,position_z FROM character_homebind WHERE guid=$SRC_GUID")
if [ -n "$HOMEBIND" ]; then
    HB_MAP=$(echo "$HOMEBIND" | awk -F'\t' '{print $1}')
    HB_ZONE=$(echo "$HOMEBIND" | awk -F'\t' '{print $2}')
    HB_X=$(echo "$HOMEBIND" | awk -F'\t' '{print $3}')
    HB_Y=$(echo "$HOMEBIND" | awk -F'\t' '{print $4}')
    HB_Z=$(echo "$HOMEBIND" | awk -F'\t' '{print $5}')
    wotlk_sql "INSERT INTO character_homebind (guid,map,zone,position_x,position_y,position_z) VALUES ($DST_GUID,$HB_MAP,$HB_ZONE,$HB_X,$HB_Y,$HB_Z)"
    echo "Homebind transferred ✓"
else
    echo "No homebind found (will use default)"
fi

# === Step 3: Transfer character_spell (identical schema) ===
echo ""
echo "=== Step 3: Transfer character_spell ==="
wotlk_sql "DELETE FROM character_spell WHERE guid=$DST_GUID"

# Dump TBC spells and insert into WotLK, changing guid
tbc_sql "SELECT spell,active,disabled FROM character_spell WHERE guid=$SRC_GUID" | while IFS=$'\t' read -r SPELL ACTIVE DISABLED; do
    echo "INSERT IGNORE INTO character_spell (guid,spell,active,disabled) VALUES ($DST_GUID,$SPELL,$ACTIVE,$DISABLED);"
done | wotlk_sql_batch

SPELL_COUNT=$(wotlk_sql "SELECT COUNT(*) FROM character_spell WHERE guid=$DST_GUID")
echo "Spells transferred: $SPELL_COUNT ✓"

# === Step 4: Transfer character_skills (identical schema) ===
echo ""
echo "=== Step 4: Transfer character_skills ==="
wotlk_sql "DELETE FROM character_skills WHERE guid=$DST_GUID"

tbc_sql "SELECT skill,value,max FROM character_skills WHERE guid=$SRC_GUID" | while IFS=$'\t' read -r SKILL VALUE MAX; do
    echo "INSERT IGNORE INTO character_skills (guid,skill,value,max) VALUES ($DST_GUID,$SKILL,$VALUE,$MAX);"
done | wotlk_sql_batch

SKILL_COUNT=$(wotlk_sql "SELECT COUNT(*) FROM character_skills WHERE guid=$DST_GUID")
echo "Skills transferred: $SKILL_COUNT ✓"

# === Step 5: Transfer character_reputation (identical schema) ===
echo ""
echo "=== Step 5: Transfer character_reputation ==="
wotlk_sql "DELETE FROM character_reputation WHERE guid=$DST_GUID"

tbc_sql "SELECT faction,standing,flags FROM character_reputation WHERE guid=$SRC_GUID" | while IFS=$'\t' read -r FACTION STANDING FLAGS; do
    echo "INSERT IGNORE INTO character_reputation (guid,faction,standing,flags) VALUES ($DST_GUID,$FACTION,$STANDING,$FLAGS);"
done | wotlk_sql_batch

REP_COUNT=$(wotlk_sql "SELECT COUNT(*) FROM character_reputation WHERE guid=$DST_GUID")
echo "Reputation transferred: $REP_COUNT ✓"

# === Step 6: Transfer character_queststatus (WotLK adds itemcount5,itemcount6) ===
echo ""
echo "=== Step 6: Transfer character_queststatus ==="
wotlk_sql "DELETE FROM character_queststatus WHERE guid=$DST_GUID"

tbc_sql "SELECT quest,status,rewarded,explored,timer,mobcount1,mobcount2,mobcount3,mobcount4,itemcount1,itemcount2,itemcount3,itemcount4 FROM character_queststatus WHERE guid=$SRC_GUID" | while IFS=$'\t' read -r QUEST STATUS REWARDED EXPLORED TIMER MC1 MC2 MC3 MC4 IC1 IC2 IC3 IC4; do
    echo "INSERT IGNORE INTO character_queststatus (guid,quest,status,rewarded,explored,timer,mobcount1,mobcount2,mobcount3,mobcount4,itemcount1,itemcount2,itemcount3,itemcount4,itemcount5,itemcount6) VALUES ($DST_GUID,$QUEST,$STATUS,$REWARDED,$EXPLORED,$TIMER,$MC1,$MC2,$MC3,$MC4,$IC1,$IC2,$IC3,$IC4,0,0);"
done | wotlk_sql_batch

QUEST_COUNT=$(wotlk_sql "SELECT COUNT(*) FROM character_queststatus WHERE guid=$DST_GUID")
echo "Quests transferred: $QUEST_COUNT ✓"

# === Step 7: Transfer character_action (WotLK adds spec column) ===
echo ""
echo "=== Step 7: Transfer character_action ==="
wotlk_sql "DELETE FROM character_action WHERE guid=$DST_GUID"

tbc_sql "SELECT button,action,type FROM character_action WHERE guid=$SRC_GUID" | while IFS=$'\t' read -r BUTTON ACTION TYPE; do
    echo "INSERT IGNORE INTO character_action (guid,spec,button,action,type) VALUES ($DST_GUID,0,$BUTTON,$ACTION,$TYPE);"
done | wotlk_sql_batch

ACTION_COUNT=$(wotlk_sql "SELECT COUNT(*) FROM character_action WHERE guid=$DST_GUID")
echo "Actions transferred: $ACTION_COUNT ✓"

# === Step 8: Transfer items (item_instance + character_inventory) ===
echo ""
echo "=== Step 8: Transfer Items ==="

# Get max existing item guid on WotLK (should be 0 since clean)
MAX_ITEM_GUID=$(wotlk_sql "SELECT IFNULL(MAX(guid),0) FROM item_instance")
ITEM_OFFSET=$((MAX_ITEM_GUID + 1000))  # Start from offset to be safe
echo "Item guid offset: $ITEM_OFFSET (max existing: $MAX_ITEM_GUID)"

# First, dump TBC item_instance for Samuel and create mapping
# TBC schema: guid,owner_guid,itemEntry,creatorGuid,giftCreatorGuid,count,duration,charges,flags,enchantments,randomPropertyId,durability,itemTextId
# WotLK schema: guid,owner_guid,itemEntry,creatorGuid,giftCreatorGuid,count,duration,charges,flags,enchantments,randomPropertyId,durability,playedTime,text

# Create temp file for guid mapping
TMPMAP=$(mktemp /tmp/item_map_XXXXXX.txt)

# Get all TBC items, create mapping and INSERT statements
echo "Transferring item_instance..."
tbc_sql "SELECT guid,itemEntry,creatorGuid,giftCreatorGuid,count,duration,charges,flags,enchantments,randomPropertyId,durability FROM item_instance WHERE owner_guid=$SRC_GUID ORDER BY guid" | {
    ITEM_COUNT=0
    while IFS=$'\t' read -r OLD_GUID ITEM_ENTRY CREATOR GIFT_CREATOR CNT DURATION CHARGES FLAGS ENCHANTS RAND_PROP DURABILITY; do
        NEW_GUID=$((OLD_GUID + ITEM_OFFSET))
        echo "$OLD_GUID $NEW_GUID" >> "$TMPMAP"
        
        # Escape single quotes in enchantments string
        ENCHANTS_ESC=$(echo "$ENCHANTS" | sed "s/'/''/g")
        CHARGES_ESC=$(echo "$CHARGES" | sed "s/'/''/g")
        
        echo "INSERT INTO item_instance (guid,owner_guid,itemEntry,creatorGuid,giftCreatorGuid,count,duration,charges,flags,enchantments,randomPropertyId,durability,playedTime,text) VALUES ($NEW_GUID,$DST_GUID,$ITEM_ENTRY,$CREATOR,$GIFT_CREATOR,$CNT,$DURATION,'$CHARGES_ESC',$FLAGS,'$ENCHANTS_ESC',$RAND_PROP,$DURABILITY,0,NULL);"
        ITEM_COUNT=$((ITEM_COUNT + 1))
    done
    echo "-- Total items: $ITEM_COUNT" >&2
} | wotlk_sql_batch

ITEM_TOTAL=$(wotlk_sql "SELECT COUNT(*) FROM item_instance WHERE owner_guid=$DST_GUID")
echo "Items transferred: $ITEM_TOTAL"

# Now transfer character_inventory using the guid mapping
echo "Transferring character_inventory..."
wotlk_sql "DELETE FROM character_inventory WHERE guid=$DST_GUID"

tbc_sql "SELECT bag,slot,item,item_template FROM character_inventory WHERE guid=$SRC_GUID" | while IFS=$'\t' read -r BAG SLOT ITEM_GUID ITEM_TEMPLATE; do
    NEW_ITEM_GUID=$((ITEM_GUID + ITEM_OFFSET))
    # If bag != 0, the bag guid also needs remapping
    if [ "$BAG" -ne 0 ]; then
        NEW_BAG=$((BAG + ITEM_OFFSET))
    else
        NEW_BAG=0
    fi
    echo "INSERT INTO character_inventory (guid,bag,slot,item,item_template) VALUES ($DST_GUID,$NEW_BAG,$SLOT,$NEW_ITEM_GUID,$ITEM_TEMPLATE);"
done | wotlk_sql_batch

INV_COUNT=$(wotlk_sql "SELECT COUNT(*) FROM character_inventory WHERE guid=$DST_GUID")
echo "Inventory slots transferred: $INV_COUNT ✓"

# Build equipmentCache from equipped items (slots 0-18)
echo "Building equipmentCache..."
EQUIP_CACHE=""
for SLOT in $(seq 0 19); do
    ITEM_ENTRY=$(wotlk_sql "SELECT ii.itemEntry FROM character_inventory ci JOIN item_instance ii ON ci.item=ii.guid WHERE ci.guid=$DST_GUID AND ci.bag=0 AND ci.slot=$SLOT")
    if [ -n "$ITEM_ENTRY" ] && [ "$ITEM_ENTRY" != "NULL" ]; then
        # Get enchantments (permanent enchant is first value in enchantments string)
        ENCHANT_STR=$(wotlk_sql "SELECT enchantments FROM item_instance ii JOIN character_inventory ci ON ci.item=ii.guid WHERE ci.guid=$DST_GUID AND ci.bag=0 AND ci.slot=$SLOT")
        PERM_ENCHANT=$(echo "$ENCHANT_STR" | awk '{print $1}')
        [ -z "$PERM_ENCHANT" ] && PERM_ENCHANT=0
        EQUIP_CACHE="$EQUIP_CACHE $ITEM_ENTRY $PERM_ENCHANT"
    else
        EQUIP_CACHE="$EQUIP_CACHE 0 0"
    fi
done
EQUIP_CACHE=$(echo "$EQUIP_CACHE" | sed 's/^ //')
wotlk_sql "UPDATE characters SET equipmentCache='$EQUIP_CACHE' WHERE guid=$DST_GUID"
echo "equipmentCache updated ✓"

# Clean up temp file
rm -f "$TMPMAP"

# === Step 9: Transfer character_aura ===
echo ""
echo "=== Step 9: Transfer character_aura ==="
wotlk_sql "DELETE FROM character_aura WHERE guid=$DST_GUID"

# Don't transfer auras - they can cause issues. Let server recalculate.
echo "Auras skipped (server will recalculate) ✓"

# === Step 10: Transfer character_pet ===
echo ""
echo "=== Step 10: Transfer character_pet ==="
# WotLK removes: loyaltypoints, loyalty, xpForNextLoyalty, trainpoint, teachspelldata

wotlk_sql "DELETE FROM character_pet WHERE owner=$DST_GUID"
wotlk_sql "DELETE FROM pet_spell WHERE guid IN (SELECT id FROM character_pet WHERE owner=$DST_GUID)" 2>/dev/null || true

tbc_sql "SELECT id,entry,modelid,CreatedBySpell,PetType,level,exp,Reactstate,name,renamed,slot,curhealth,curmana,curhappiness,savetime,resettalents_cost,resettalents_time,abdata FROM character_pet WHERE owner=$SRC_GUID" | while IFS=$'\t' read -r PET_ID ENTRY MODELID SPELL PTYPE PLEVEL PEXP REACT PNAME RENAMED PSLOT CURH CURM CURHA SAVE RTCOST RTTIME ABDATA; do
    # Escape quotes in name and abdata
    PNAME_ESC=$(echo "$PNAME" | sed "s/'/''/g")
    ABDATA_ESC=$(echo "$ABDATA" | sed "s/'/''/g")
    
    echo "INSERT INTO character_pet (id,entry,owner,modelid,CreatedBySpell,PetType,level,exp,Reactstate,name,renamed,slot,curhealth,curmana,curhappiness,savetime,resettalents_cost,resettalents_time,abdata) VALUES ($PET_ID,$ENTRY,$DST_GUID,$MODELID,$SPELL,$PTYPE,$PLEVEL,$PEXP,$REACT,'$PNAME_ESC',$RENAMED,$PSLOT,$CURH,$CURM,$CURHA,$SAVE,$RTCOST,$RTTIME,'$ABDATA_ESC');"
done | wotlk_sql_batch

PET_COUNT=$(wotlk_sql "SELECT COUNT(*) FROM character_pet WHERE owner=$DST_GUID")
echo "Pets transferred: $PET_COUNT ✓"

# Transfer pet_spell (identical schema)
tbc_sql "SELECT guid,spell,active FROM pet_spell WHERE guid IN (SELECT id FROM character_pet WHERE owner=$SRC_GUID)" | while IFS=$'\t' read -r PGUID PSPELL PACTIVE; do
    echo "INSERT IGNORE INTO pet_spell (guid,spell,active) VALUES ($PGUID,$PSPELL,$PACTIVE);"
done | wotlk_sql_batch

PET_SPELL_COUNT=$(wotlk_sql "SELECT COUNT(*) FROM pet_spell WHERE guid IN (SELECT id FROM character_pet WHERE owner=$DST_GUID)")
echo "Pet spells transferred: $PET_SPELL_COUNT ✓"

# === Step 11: Transfer taximask ===
echo ""
echo "=== Step 11: Transfer taximask ==="
# TBC taximask has fewer values than WotLK, need to pad
TBC_TAXI=$(tbc_sql "SELECT taximask FROM characters WHERE guid=$SRC_GUID")
# WotLK needs 14 values, TBC has fewer
TAXI_COUNT=$(echo "$TBC_TAXI" | wc -w | tr -d ' ')
TAXI_NEEDED=$((14 - TAXI_COUNT))
TAXI_PADDED="$TBC_TAXI"
if [ "$TAXI_NEEDED" -gt 0 ]; then
    PADDING=$(printf ' 0%.0s' $(seq 1 $TAXI_NEEDED))
    TAXI_PADDED="${TBC_TAXI}${PADDING}"
fi
wotlk_sql "UPDATE characters SET taximask='$TAXI_PADDED' WHERE guid=$DST_GUID"
echo "Taximask transferred ✓"

# === Step 12: Clean account_data (will be regenerated on login) ===
echo ""
echo "=== Step 12: Clean account_data ==="
wotlk_sql "DELETE FROM character_account_data WHERE guid=$DST_GUID"
echo "Account data cleaned (will regenerate on login) ✓"

# === Final verification ===
echo ""
echo "============================================"
echo "  Transfer Complete - Verification"
echo "============================================"
echo ""
echo "=== Character ==="
wotlk_sql "SELECT guid,name,account,level,class,race,gender,money,health,power1,map,zone,online,at_login FROM characters WHERE guid=$DST_GUID" | column -t

echo ""
echo "=== Secondary Data ==="
wotlk_sql "
SELECT 'character_spell' AS tbl, COUNT(*) AS cnt FROM character_spell WHERE guid=$DST_GUID
UNION ALL SELECT 'character_skills', COUNT(*) FROM character_skills WHERE guid=$DST_GUID
UNION ALL SELECT 'character_reputation', COUNT(*) FROM character_reputation WHERE guid=$DST_GUID
UNION ALL SELECT 'character_queststatus', COUNT(*) FROM character_queststatus WHERE guid=$DST_GUID
UNION ALL SELECT 'character_action', COUNT(*) FROM character_action WHERE guid=$DST_GUID
UNION ALL SELECT 'character_inventory', COUNT(*) FROM character_inventory WHERE guid=$DST_GUID
UNION ALL SELECT 'item_instance', COUNT(*) FROM item_instance WHERE owner_guid=$DST_GUID
UNION ALL SELECT 'character_pet', COUNT(*) FROM character_pet WHERE owner=$DST_GUID
UNION ALL SELECT 'pet_spell', COUNT(*) FROM pet_spell WHERE guid IN (SELECT id FROM character_pet WHERE owner=$DST_GUID)
UNION ALL SELECT 'character_homebind', COUNT(*) FROM character_homebind WHERE guid=$DST_GUID
" | column -t

echo ""
echo "Transfer complete! Restart the server before logging in."
echo "Run: docker restart cmangos-wotlk-server"
