#!/bin/bash
# Create a fresh minimal Warlock character to test if the class works on WotLK
DB="${DB_PASSWORD}"

db() { docker exec cmangos-wotlk-db mariadb -u root -p"$DB" "$@" 2>/dev/null; }

echo "=== Step 1: Get next available guid ==="
NEXT_GUID=$(db -N wotlkcharacters -e "SELECT COALESCE(MAX(guid),0)+1 FROM characters")
echo "Next guid: $NEXT_GUID"

echo ""
echo "=== Step 2: Get SAMUEL account ID ==="
ACCOUNT_ID=$(db -N wotlkcharacters -e "SELECT account FROM characters WHERE guid=1801")
echo "Account: $ACCOUNT_ID"

echo ""
echo "=== Step 3: First, restore Samuel to Warlock (undo our test change) ==="
db wotlkcharacters -e "UPDATE characters SET class=9 WHERE guid=1801"
echo "Samuel restored to class=9 (Warlock)"

echo ""
echo "=== Step 4: Create fresh Testlock character ==="
db wotlkcharacters -e "
INSERT INTO characters (guid, account, name, race, class, gender, level, xp, money,
  playerBytes, playerBytes2, playerFlags,
  position_x, position_y, position_z, map, dungeon_difficulty, orientation,
  taximask, online, cinematic, totaltime, leveltime, logout_time,
  is_logout_resting, rest_bonus, resettalents_cost, resettalents_time,
  trans_x, trans_y, trans_z, trans_o, transguid,
  extra_flags, stable_slots, at_login, zone, death_expire_time, taxi_path,
  arenaPoints, totalHonorPoints, todayHonorPoints, yesterdayHonorPoints,
  totalKills, todayKills, yesterdayKills, chosenTitle, knownCurrencies,
  watchedFaction, drunk,
  health, power1, power2, power3, power4, power5, power6, power7,
  specCount, activeSpec,
  exploredZones, equipmentCache, ammoId, knownTitles, actionBars, grantableLevels, fishingSteps)
VALUES (
  $NEXT_GUID, $ACCOUNT_ID, 'Testlock', 1, 9, 0, 60, 0, 0,
  151585280, 33947654, 0,
  -8854.02, 655.903, 96.6168, 0, 0, 5.69921,
  '0 0 0 0 0 0 0 0 0 0 0 0 0 0', 0, 1, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0, 0,
  0, 0, 38, 1519, 0, '',
  0, 0, 0, 0,
  0, 0, 0, 0, 0,
  0, 0,
  3000, 3000, 0, 0, 100, 0, 0, 0,
  1, 0,
  '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0',
  '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0',
  0, '0 0 0 0 0 0', 0, 0, 0
)"
echo "Insert result: $?"

echo ""
echo "=== Step 5: Add homebind ==="
db wotlkcharacters -e "INSERT INTO character_homebind (guid, map, zone, position_x, position_y, position_z) VALUES ($NEXT_GUID, 0, 1519, -8866.54, 672.169, 97.9035)"

echo ""
echo "=== Step 6: Verify ==="
db -N wotlkcharacters -e "SELECT guid, name, class, level, at_login FROM characters WHERE guid=$NEXT_GUID"

echo ""
echo "at_login=38 means: reset spells (4) + reset talents (2) + reset pet talents (32)"
echo ""
echo "Now try to log in with Testlock. If it works, the class is NOT the problem."
echo "If it crashes, Warlock class itself is broken on this WotLK build."
