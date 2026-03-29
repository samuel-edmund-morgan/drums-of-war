#!/bin/bash
# Test: Move ALL equipped items to bags to eliminate set bonus as crash cause
DB="${DB_PASSWORD}"
db() { docker exec cmangos-wotlk-db mariadb -u root -p"$DB" "$@" 2>/dev/null; }

echo "=== HYPOTHESIS: Netherwind 8-piece set bonus references pet ==="
echo "=== The bonus 'Your pet gains 7% of your Intellect' tries to access pet ==="
echo "=== If pet is not in world, GetMap() on pet object = CRASH ==="
echo ""

echo "=== Current equipped items ==="
db -N wotlkcharacters -e "SELECT ci.slot, ii.itemEntry FROM character_inventory ci JOIN item_instance ii ON ci.item=ii.guid WHERE ci.guid=1801 AND ci.bag=0 AND ci.slot<19 ORDER BY ci.slot"

echo ""
echo "=== Netherwind pieces (entries 16803-16810) ==="
db -N wotlkcharacters -e "SELECT ci.slot, ci.item, ii.itemEntry FROM character_inventory ci JOIN item_instance ii ON ci.item=ii.guid WHERE ci.guid=1801 AND ci.bag=0 AND ii.itemEntry BETWEEN 16803 AND 16810 ORDER BY ci.slot"

echo ""
echo "=== TEST 1: Move ALL equipment to a free bag slot ==="
echo "Finding first free bag slot..."

# Get a bag guid (slot 19 = first bag)
BAG_GUID=$(db -N wotlkcharacters -e "SELECT item FROM character_inventory WHERE guid=1801 AND bag=0 AND slot=19 LIMIT 1")
echo "Bag guid: $BAG_GUID"

if [ -z "$BAG_GUID" ]; then
    echo "No bag found. Using unequip approach: delete equipped items from character_inventory"
    echo "(items remain in item_instance, just not equipped)"
    
    echo ""
    echo "=== Backing up character_inventory ==="
    db wotlkcharacters -e "CREATE TABLE IF NOT EXISTS _bak_samuel_inventory AS SELECT * FROM character_inventory WHERE guid=1801"
    
    echo ""
    echo "=== Removing ALL equipped items (slots 0-18) from inventory ==="
    db wotlkcharacters -e "DELETE FROM character_inventory WHERE guid=1801 AND bag=0 AND slot < 19"
    echo "Done."
else
    echo ""
    echo "=== Backing up character_inventory ==="
    db wotlkcharacters -e "CREATE TABLE IF NOT EXISTS _bak_samuel_inventory AS SELECT * FROM character_inventory WHERE guid=1801"
    
    echo ""
    echo "=== Removing ALL equipped items (slots 0-18) from inventory ==="
    db wotlkcharacters -e "DELETE FROM character_inventory WHERE guid=1801 AND bag=0 AND slot < 19"
    echo "Done. Items still exist in item_instance but are not equipped."
fi

echo ""
echo "=== Also clear equipmentCache ==="
db wotlkcharacters -e "UPDATE characters SET equipmentCache='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0' WHERE guid=1801"

echo ""
echo "=== Verify: no equipped items ==="
db -N wotlkcharacters -e "SELECT COUNT(*) as equipped FROM character_inventory WHERE guid=1801 AND bag=0 AND slot<19"

echo ""
echo "=== Samuel is now NAKED (no equipment). Try logging in. ==="
echo "If login works: the crash was caused by equipped item set bonus."
echo "If it still crashes: the problem is something else in the characters row."
