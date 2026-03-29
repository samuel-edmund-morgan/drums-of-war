#!/bin/bash
DB="${DB_PASSWORD}"
db() { docker exec cmangos-wotlk-db mariadb -u root -p"$DB" "$@" 2>/dev/null; }

echo "=== CHECK: equipmentCache value counts ==="
samuel_ec=$(db -N wotlkcharacters -e "SELECT equipmentCache FROM characters WHERE guid=1801")
testlock_ec=$(db -N wotlkcharacters -e "SELECT equipmentCache FROM characters WHERE guid=1802")
samuel_cnt=$(echo "$samuel_ec" | tr ' ' '\n' | grep -c .)
testlock_cnt=$(echo "$testlock_ec" | tr ' ' '\n' | grep -c .)
echo "Samuel equipmentCache values: $samuel_cnt"
echo "Testlock equipmentCache values: $testlock_cnt"

echo ""
echo "=== EXACT equipmentCache values ==="
echo "Samuel:   [$samuel_ec]"
echo "Testlock: [$testlock_ec]"

echo ""
echo "=== CHECK: exploredZones value counts ==="
samuel_ez=$(db -N wotlkcharacters -e "SELECT LENGTH(exploredZones) - LENGTH(REPLACE(exploredZones, ' ', '')) + 1 FROM characters WHERE guid=1801")
testlock_ez=$(db -N wotlkcharacters -e "SELECT LENGTH(exploredZones) - LENGTH(REPLACE(exploredZones, ' ', '')) + 1 FROM characters WHERE guid=1802")
echo "Samuel exploredZones values: $samuel_ez"
echo "Testlock exploredZones values: $testlock_ez"

echo ""
echo "=== CHECK: taximask value counts ==="
samuel_tm=$(db -N wotlkcharacters -e "SELECT LENGTH(taximask) - LENGTH(REPLACE(taximask, ' ', '')) + 1 FROM characters WHERE guid=1801")
testlock_tm=$(db -N wotlkcharacters -e "SELECT LENGTH(taximask) - LENGTH(REPLACE(taximask, ' ', '')) + 1 FROM characters WHERE guid=1802")
echo "Samuel taximask values: $samuel_tm"
echo "Testlock taximask values: $testlock_tm"

echo ""
echo "=== CHECK: knownTitles value counts ==="
samuel_kt=$(db -N wotlkcharacters -e "SELECT LENGTH(knownTitles) - LENGTH(REPLACE(knownTitles, ' ', '')) + 1 FROM characters WHERE guid=1801")
testlock_kt=$(db -N wotlkcharacters -e "SELECT LENGTH(knownTitles) - LENGTH(REPLACE(knownTitles, ' ', '')) + 1 FROM characters WHERE guid=1802")
echo "Samuel knownTitles values: $samuel_kt"
echo "Testlock knownTitles values: $testlock_kt"

echo ""
echo "=== playerFlags comparison ==="
echo "Samuel playerFlags: $(db -N wotlkcharacters -e "SELECT playerFlags FROM characters WHERE guid=1801")"
echo "Testlock playerFlags: $(db -N wotlkcharacters -e "SELECT playerFlags FROM characters WHERE guid=1802")"
echo "playerFlags 2080 = 0x820 = PLAYER_FLAGS_HIDE_HELM(0x400) | PLAYER_FLAGS_HIDE_CLOAK(0x020) | ??? "
echo "playerFlags 32 = 0x20 = PLAYER_FLAGS_HIDE_CLOAK"

echo ""
echo "=== playerBytes2 comparison ==="
echo "Samuel playerBytes2: $(db -N wotlkcharacters -e "SELECT playerBytes2 FROM characters WHERE guid=1801")"
echo "Testlock playerBytes2: $(db -N wotlkcharacters -e "SELECT playerBytes2 FROM characters WHERE guid=1802")"
echo "Samuel HEX: $(printf '0x%X' 33947654)"
echo "Testlock HEX: $(printf '0x%X' 17170438)"
