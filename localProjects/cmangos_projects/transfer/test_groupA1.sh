#!/bin/bash
DB="${DB_PASSWORD}"
db() { docker exec cmangos-wotlk-db mariadb -u root -p"$DB" "$@" 2>/dev/null; }

echo "=== REVERT to Testlock baseline ==="
db wotlkcharacters -e "
UPDATE characters dst JOIN characters src ON src.guid=1802
SET dst.xp=src.xp, dst.money=src.money, dst.totaltime=src.totaltime,
    dst.leveltime=src.leveltime, dst.logout_time=src.logout_time,
    dst.rest_bonus=src.rest_bonus, dst.resettalents_cost=src.resettalents_cost,
    dst.resettalents_time=src.resettalents_time, dst.watchedFaction=src.watchedFaction,
    dst.health=src.health, dst.power1=src.power1, dst.power2=src.power2,
    dst.power4=src.power4, dst.actionBars=src.actionBars, dst.fishingSteps=src.fishingSteps,
    dst.at_login=src.at_login, dst.cinematic=src.cinematic
WHERE dst.guid=1801
"
echo "Reverted to Testlock baseline."

echo ""
echo "=== GROUP A1: First half (xp, money, times) ==="
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
  cinematic = 1
WHERE guid = 1801
"
echo "Group A1 restored: xp, money, totaltime, leveltime, logout_time, rest_bonus, resettalents_cost/time, cinematic"

echo ""
db -N wotlkcharacters -e "SELECT guid,name,xp,money,at_login,actionBars,health,power1 FROM characters WHERE guid=1801"
echo ""
echo "Try logging in. at_login, actionBars, health, powers still at Testlock values."
