#!/bin/bash
DB="${DB_PASSWORD}"

echo "=== INVALID SPELLS: What are they in Classic? ==="
for spell in 2970 11703 11717 11743 17937 18134 18701 18745 18879; do
  name=$(docker exec cmangos-db mariadb -u root -p"$DB" -N -e "SELECT name FROM classicmangos.spell_template WHERE Id=$spell" 2>/dev/null)
  echo "  spell=$spell => $name"
done

echo ""
echo "=== ALL 18 AURAS on Samuel in WotLK ==="
docker exec cmangos-wotlk-db mariadb -u root -p"$DB" wotlkcharacters -e "SELECT guid, caster_guid, item_guid, spell, stackcount, remaincharges, basepoints0, basepoints1, basepoints2, maxduration, remaintime, effIndexMask FROM character_aura WHERE guid=1801" 2>/dev/null

echo ""
echo "=== Check if aura spell IDs exist in WotLK ==="
docker exec cmangos-wotlk-db mariadb -u root -p"$DB" -N -e "SELECT ca.spell, CASE WHEN st.Id IS NULL THEN 'MISSING' ELSE 'OK' END as status FROM wotlkcharacters.character_aura ca LEFT JOIN wotlkmangos.spell_template st ON ca.spell = st.Id WHERE ca.guid = 1801 ORDER BY ca.spell" 2>/dev/null

echo ""
echo "=== at_login value ==="
docker exec cmangos-wotlk-db mariadb -u root -p"$DB" -N wotlkcharacters -e "SELECT at_login FROM characters WHERE guid=1801" 2>/dev/null

echo ""
echo "=== Count of character_spell total ==="
docker exec cmangos-wotlk-db mariadb -u root -p"$DB" -N wotlkcharacters -e "SELECT COUNT(*) FROM character_spell WHERE guid=1801" 2>/dev/null

echo "=== DONE ==="
