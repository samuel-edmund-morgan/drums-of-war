#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Drums of War — Update Script
# Pulls latest code and upstream repos, rebuilds, restarts
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECTS_DIR="${SCRIPT_DIR}/localProjects/cmangos_projects"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo ""
echo -e "${YELLOW}╔═══════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║     Drums of War — Update                 ║${NC}"
echo -e "${YELLOW}╚═══════════════════════════════════════════╝${NC}"
echo ""

CHANGES=""

# ── 1. Pull own repo ──
info "Updating Drums of War code..."
cd "$SCRIPT_DIR"
OLD_HASH=$(git rev-parse HEAD 2>/dev/null || echo "none")
git pull --ff-only 2>/dev/null && ok "Own code updated" || warn "git pull failed (maybe local changes?)"
NEW_HASH=$(git rev-parse HEAD 2>/dev/null || echo "none")
if [ "$OLD_HASH" != "$NEW_HASH" ] && [ "$OLD_HASH" != "none" ]; then
  CHANGES="${CHANGES}\n=== Drums of War ===\n$(git log --oneline "${OLD_HASH}..${NEW_HASH}" 2>/dev/null)"
fi

# ── 2. Pull upstream repos ──
pull_upstream() {
  local dir="$1" name="$2"
  if [ -d "${PROJECTS_DIR}/${dir}/.git" ]; then
    cd "${PROJECTS_DIR}/${dir}"
    local old=$(git rev-parse HEAD 2>/dev/null)
    git pull --ff-only 2>/dev/null && ok "${name} updated" || warn "${name} pull failed"
    local new=$(git rev-parse HEAD 2>/dev/null)
    if [ "$old" != "$new" ]; then
      local log=$(git log --oneline "${old}..${new}" 2>/dev/null | head -10)
      CHANGES="${CHANGES}\n=== ${name} ===\n${log}"
    fi
  else
    warn "${name} not cloned — run ./setup.sh first"
  fi
}

pull_upstream "mangos-classic" "VMaNGOS (Classic)"
pull_upstream "azerothcore-wotlk" "AzerothCore (WotLK)"

# ── 3. Rebuild if requested ──
if [[ "${1:-}" == "--build-all" || "${1:-}" == "-b" ]]; then
  info "Rebuilding all containers..."

  for stack in vmangos-classic docker-tbc docker-azerothcore; do
    if [ -f "${PROJECTS_DIR}/${stack}/docker-compose.yml" ]; then
      info "Building ${stack}..."
      cd "${PROJECTS_DIR}/${stack}"
      docker compose build 2>&1 | tail -3
      docker compose up -d 2>&1 | tail -2
      ok "${stack} rebuilt and restarted"
    fi
  done
fi

# ── 4. Summary ──
cd "$SCRIPT_DIR"
echo ""
if [ -n "$CHANGES" ]; then
  echo -e "${GREEN}═══ Changes ═══${NC}"
  echo -e "$CHANGES"
  echo ""
else
  ok "No new changes found."
fi

echo -e "${GREEN}Update complete.${NC}"
echo "Run with --build-all to rebuild Docker containers."
echo ""
