#!/bin/bash
# Full schema and data analysis for CMaNGOS character databases
# Outputs: /tmp/schema_comparison.txt, /tmp/samuel_wotlk_full.txt

DB_PASS="${DB_PASSWORD}"

db_classic() { docker exec cmangos-db mariadb -u root -p"$DB_PASS" "$@" 2>/dev/null; }
db_tbc()     { docker exec cmangos-tbc-db mariadb -u root -p"$DB_PASS" "$@" 2>/dev/null; }
db_wotlk()   { docker exec cmangos-wotlk-db mariadb -u root -p"$DB_PASS" "$@" 2>/dev/null; }

OUT1="/tmp/schema_comparison.txt"
OUT2="/tmp/samuel_wotlk_full.txt"
OUT3="/tmp/samuel_tbc_full.txt"

###############################################
# PART 1: Schema comparison
###############################################
echo "=== SCHEMA COMPARISON: Classic vs TBC vs WotLK ===" > "$OUT1"
echo "Generated: $(date)" >> "$OUT1"
echo "" >> "$OUT1"

# Get table lists
classic_tables=$(db_classic -N -e "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='classiccharacters' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
tbc_tables=$(db_tbc -N -e "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='tbccharacters' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
wotlk_tables=$(db_wotlk -N -e "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")

echo "--- TABLE PRESENCE ---" >> "$OUT1"
all_tables=$(echo -e "${classic_tables}\n${tbc_tables}\n${wotlk_tables}" | sort -u)
printf "%-40s %-10s %-10s %-10s\n" "TABLE" "CLASSIC" "TBC" "WOTLK" >> "$OUT1"
printf "%-40s %-10s %-10s %-10s\n" "-----" "-------" "---" "-----" >> "$OUT1"
for t in $all_tables; do
  c=$(echo "$classic_tables" | grep -c "^${t}$" || true)
  b=$(echo "$tbc_tables" | grep -c "^${t}$" || true)
  w=$(echo "$wotlk_tables" | grep -c "^${t}$" || true)
  mark=""
  [ "$c" != "$b" ] || [ "$b" != "$w" ] && mark=" <-- DIFFERS"
  printf "%-40s %-10s %-10s %-10s%s\n" "$t" "$c" "$b" "$w" "$mark" >> "$OUT1"
done

echo "" >> "$OUT1"
echo "--- COLUMN-LEVEL COMPARISON FOR CHARACTER-RELATED TABLES ---" >> "$OUT1"

# Focus on tables relevant to character transfer
char_tables="characters character_account_data character_action character_aura character_homebind character_inventory character_pet character_queststatus character_reputation character_skills character_social character_spell character_spell_cooldown character_stats character_talent character_glyphs character_achievement character_achievement_progress character_battleground_data character_equipmentsets item_instance mail corpse pet_aura pet_spell"

for tbl in $char_tables; do
  echo "" >> "$OUT1"
  echo "====== TABLE: $tbl ======" >> "$OUT1"
  
  c_cols=$(db_classic -N -e "SELECT CONCAT(COLUMN_NAME, '|', COLUMN_TYPE, '|', IS_NULLABLE, '|', IFNULL(COLUMN_DEFAULT,'NULL')) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='classiccharacters' AND TABLE_NAME='${tbl}' ORDER BY ORDINAL_POSITION" 2>/dev/null)
  t_cols=$(db_tbc -N -e "SELECT CONCAT(COLUMN_NAME, '|', COLUMN_TYPE, '|', IS_NULLABLE, '|', IFNULL(COLUMN_DEFAULT,'NULL')) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='tbccharacters' AND TABLE_NAME='${tbl}' ORDER BY ORDINAL_POSITION" 2>/dev/null)
  w_cols=$(db_wotlk -N -e "SELECT CONCAT(COLUMN_NAME, '|', COLUMN_TYPE, '|', IS_NULLABLE, '|', IFNULL(COLUMN_DEFAULT,'NULL')) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='${tbl}' ORDER BY ORDINAL_POSITION" 2>/dev/null)
  
  [ -z "$c_cols" ] && c_cols="(table not present)"
  [ -z "$t_cols" ] && t_cols="(table not present)"
  [ -z "$w_cols" ] && w_cols="(table not present)"
  
  # Get all column names across expansions
  c_names=$(db_classic -N -e "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='classiccharacters' AND TABLE_NAME='${tbl}' ORDER BY ORDINAL_POSITION" 2>/dev/null)
  t_names=$(db_tbc -N -e "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='tbccharacters' AND TABLE_NAME='${tbl}' ORDER BY ORDINAL_POSITION" 2>/dev/null)
  w_names=$(db_wotlk -N -e "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='${tbl}' ORDER BY ORDINAL_POSITION" 2>/dev/null)
  
  all_cols=$(echo -e "${c_names}\n${t_names}\n${w_names}" | sort -u | grep -v '^$')
  
  printf "  %-30s %-8s %-8s %-8s  %-20s %-20s %-20s\n" "COLUMN" "CLASSIC" "TBC" "WOTLK" "CLASSIC_TYPE" "TBC_TYPE" "WOTLK_TYPE" >> "$OUT1"
  printf "  %-30s %-8s %-8s %-8s  %-20s %-20s %-20s\n" "------" "-------" "---" "-----" "------------" "--------" "----------" >> "$OUT1"
  
  for col in $all_cols; do
    in_c=$(echo "$c_names" | grep -c "^${col}$" 2>/dev/null || echo 0)
    in_t=$(echo "$t_names" | grep -c "^${col}$" 2>/dev/null || echo 0)
    in_w=$(echo "$w_names" | grep -c "^${col}$" 2>/dev/null || echo 0)
    
    c_type=""
    t_type=""
    w_type=""
    [ "$in_c" != "0" ] && c_type=$(db_classic -N -e "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='classiccharacters' AND TABLE_NAME='${tbl}' AND COLUMN_NAME='${col}'" 2>/dev/null)
    [ "$in_t" != "0" ] && t_type=$(db_tbc -N -e "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='tbccharacters' AND TABLE_NAME='${tbl}' AND COLUMN_NAME='${col}'" 2>/dev/null)
    [ "$in_w" != "0" ] && w_type=$(db_wotlk -N -e "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='wotlkcharacters' AND TABLE_NAME='${tbl}' AND COLUMN_NAME='${col}'" 2>/dev/null)
    
    mark=""
    if [ "$in_c" != "$in_t" ] || [ "$in_t" != "$in_w" ]; then
      mark=" <-- MISSING"
    elif [ "$c_type" != "$t_type" ] || [ "$t_type" != "$w_type" ]; then
      mark=" <-- TYPE DIFF"
    fi
    
    c_mark="YES"; [ "$in_c" = "0" ] && c_mark="---"
    t_mark="YES"; [ "$in_t" = "0" ] && t_mark="---"
    w_mark="YES"; [ "$in_w" = "0" ] && w_mark="---"
    
    printf "  %-30s %-8s %-8s %-8s  %-20s %-20s %-20s%s\n" "$col" "$c_mark" "$t_mark" "$w_mark" "${c_type:----}" "${t_type:----}" "${w_type:----}" "$mark" >> "$OUT1"
  done
done

echo "" >> "$OUT1"
echo "=== END SCHEMA COMPARISON ===" >> "$OUT1"

###############################################
# PART 2: WotLK Samuel full data dump
###############################################
echo "=== SAMUEL (guid=1801) FULL DATA ON WOTLK ===" > "$OUT2"
echo "Generated: $(date)" >> "$OUT2"

echo "" >> "$OUT2"
echo "--- characters ---" >> "$OUT2"
db_wotlk wotlkcharacters -e "SELECT * FROM characters WHERE guid=1801\G" >> "$OUT2"

for tbl in character_account_data character_action character_achievement character_achievement_progress character_aura character_battleground_data character_battleground_random character_declinedname character_equipmentsets character_gifts character_glyphs character_homebind character_instance character_inventory character_queststatus character_queststatus_daily character_queststatus_monthly character_queststatus_weekly character_reputation character_skills character_social character_spell character_spell_cooldown character_stats character_talent; do
  echo "" >> "$OUT2"
  cnt=$(db_wotlk -N wotlkcharacters -e "SELECT COUNT(*) FROM ${tbl} WHERE guid=1801")
  echo "--- ${tbl} (${cnt} rows) ---" >> "$OUT2"
  if [ "${cnt:-0}" != "0" ]; then
    db_wotlk wotlkcharacters -e "SELECT * FROM ${tbl} WHERE guid=1801\G" >> "$OUT2"
  fi
done

echo "" >> "$OUT2"
echo "--- character_tutorial (account=12) ---" >> "$OUT2"
db_wotlk wotlkcharacters -e "SELECT * FROM character_tutorial WHERE account=12\G" >> "$OUT2"

echo "" >> "$OUT2"
cnt=$(db_wotlk -N wotlkcharacters -e "SELECT COUNT(*) FROM character_pet WHERE owner=1801")
echo "--- character_pet (owner=1801, ${cnt} rows) ---" >> "$OUT2"
db_wotlk wotlkcharacters -e "SELECT * FROM character_pet WHERE owner=1801\G" >> "$OUT2"

echo "" >> "$OUT2"
cnt=$(db_wotlk -N wotlkcharacters -e "SELECT COUNT(*) FROM item_instance WHERE owner_guid=1801")
echo "--- item_instance (owner_guid=1801, ${cnt} rows) ---" >> "$OUT2"
if [ "${cnt:-0}" -gt 20 ]; then
  echo "(showing first 10 + last 10)" >> "$OUT2"
  db_wotlk wotlkcharacters -e "SELECT * FROM item_instance WHERE owner_guid=1801 ORDER BY guid LIMIT 10\G" >> "$OUT2"
  echo "..." >> "$OUT2"
  db_wotlk wotlkcharacters -e "SELECT * FROM item_instance WHERE owner_guid=1801 ORDER BY guid DESC LIMIT 10\G" >> "$OUT2"
else
  db_wotlk wotlkcharacters -e "SELECT * FROM item_instance WHERE owner_guid=1801\G" >> "$OUT2"
fi

echo "" >> "$OUT2"
echo "--- character_inventory (guid=1801) ---" >> "$OUT2"
db_wotlk wotlkcharacters -e "SELECT * FROM character_inventory WHERE guid=1801" >> "$OUT2"

echo "" >> "$OUT2"
echo "--- pet_spell for Samuel's pets ---" >> "$OUT2"
db_wotlk -N wotlkcharacters -e "SELECT * FROM pet_spell WHERE guid IN (SELECT id FROM character_pet WHERE owner=1801)" >> "$OUT2"

echo "" >> "$OUT2"
echo "--- pet_aura for Samuel's pets ---" >> "$OUT2"
db_wotlk -N wotlkcharacters -e "SELECT * FROM pet_aura WHERE guid IN (SELECT id FROM character_pet WHERE owner=1801)" >> "$OUT2"

echo "" >> "$OUT2"
echo "--- mail (receiver=1801) ---" >> "$OUT2"
cnt=$(db_wotlk -N wotlkcharacters -e "SELECT COUNT(*) FROM mail WHERE receiver=1801")
echo "${cnt} rows" >> "$OUT2"

echo "" >> "$OUT2"
echo "--- corpse (guid=1801) ---" >> "$OUT2"
db_wotlk -N wotlkcharacters -e "SELECT * FROM corpse WHERE guid=1801" >> "$OUT2"

echo "=== END ===" >> "$OUT2"

###############################################
# PART 3: TBC Samuel data for comparison
###############################################
echo "=== SAMUEL (guid=1801) FULL DATA ON TBC ===" > "$OUT3"
echo "Generated: $(date)" >> "$OUT3"

echo "" >> "$OUT3"
echo "--- characters ---" >> "$OUT3"
db_tbc tbccharacters -e "SELECT * FROM characters WHERE guid=1801\G" >> "$OUT3"

echo "" >> "$OUT3"
cnt=$(db_tbc -N tbccharacters -e "SELECT COUNT(*) FROM character_pet WHERE owner=1801")
echo "--- character_pet (owner=1801, ${cnt} rows) ---" >> "$OUT3"
db_tbc tbccharacters -e "SELECT * FROM character_pet WHERE owner=1801\G" >> "$OUT3"

for tbl in character_action character_skills character_reputation character_spell character_inventory character_homebind; do
  echo "" >> "$OUT3"
  cnt=$(db_tbc -N tbccharacters -e "SELECT COUNT(*) FROM ${tbl} WHERE guid=1801")
  echo "--- ${tbl} (${cnt} rows) ---" >> "$OUT3"
done

echo "=== END ===" >> "$OUT3"

echo "Done. Files:"
wc -l "$OUT1" "$OUT2" "$OUT3"
