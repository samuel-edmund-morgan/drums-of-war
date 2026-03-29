#!/bin/bash
echo "=== Samuel position: map=0, x=-8854.02, y=655.903 (Stormwind) ==="
echo "Grid calc: gx=48, gy=30 approximately"
echo ""

echo "=== Check map file for Samuel grid ==="
ls -la /opt/cmangos/data/maps/0000_48_30.map 2>&1
ls -la /opt/cmangos/data/maps/0000_48_31.map 2>&1
ls -la /opt/cmangos/data/maps/0000_49_30.map 2>&1

echo ""
echo "=== Total map files ==="
ls /opt/cmangos/data/maps/*.map 2>/dev/null | wc -l

echo ""
echo "=== Map 0 file count ==="
ls /opt/cmangos/data/maps/0000_*.map 2>/dev/null | wc -l

echo ""
echo "=== Sample map 0 files ==="
ls /opt/cmangos/data/maps/0000_*.map 2>/dev/null | head -10

echo ""
echo "=== Does 0004331.map exist? ==="
ls -la /opt/cmangos/data/maps/0004331.map 2>&1

echo ""
echo "=== vmap file count ==="
ls /opt/cmangos/data/vmaps/ 2>/dev/null | wc -l

echo ""
echo "=== mmap file count ==="
ls /opt/cmangos/data/mmaps/ 2>/dev/null | wc -l

echo ""
echo "=== dbc file count ==="
ls /opt/cmangos/data/dbc/ 2>/dev/null | wc -l

echo ""
echo "=== Check for WotLK-specific map IDs (Northrend=571, etc) ==="
ls /opt/cmangos/data/maps/0571_*.map 2>/dev/null | wc -l
echo "Map 571 (Northrend) grid files"
ls /opt/cmangos/data/maps/0530_*.map 2>/dev/null | wc -l
echo "Map 530 (Outland) grid files"

echo "=== DONE ==="
