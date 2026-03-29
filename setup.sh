#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Drums of War — Initial Setup Script
# Clones upstream repos, generates configs, checks prerequisites
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECTS_DIR="${SCRIPT_DIR}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo -e "${YELLOW}╔═══════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║     Drums of War — Server Setup           ║${NC}"
echo -e "${YELLOW}║     Classic · TBC · WotLK                 ║${NC}"
echo -e "${YELLOW}╚═══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check prerequisites ──
info "Checking prerequisites..."

MISSING=0
for cmd in git docker; do
  if ! command -v "$cmd" &>/dev/null; then
    error "$cmd is not installed"
    MISSING=1
  else
    ok "$cmd found: $(${cmd} --version 2>/dev/null | head -1)"
  fi
done

if ! docker compose version &>/dev/null; then
  error "docker compose plugin not found"
  MISSING=1
else
  ok "docker compose found: $(docker compose version --short 2>/dev/null)"
fi

if [ "$MISSING" -eq 1 ]; then
  error "Install missing prerequisites and try again."
  exit 1
fi

# ── 2. Clone upstream repos ──
info "Cloning upstream repositories..."

clone_if_missing() {
  local url="$1" target="$2" name="$3"
  if [ -d "${PROJECTS_DIR}/${target}/.git" ]; then
    ok "${name} already cloned"
  else
    info "Cloning ${name}..."
    git clone --depth 1 "$url" "${PROJECTS_DIR}/${target}"
    ok "${name} cloned"
  fi
}

clone_if_missing "https://github.com/vmangos/core.git" "mangos-classic" "VMaNGOS (Classic)"
clone_if_missing "https://github.com/cmangos/mangos-tbc.git" "mangos-tbc" "CMaNGOS TBC"
clone_if_missing "https://github.com/azerothcore/azerothcore-wotlk.git" "azerothcore-wotlk" "AzerothCore (WotLK)"

# ── 3. Setup environment file ──
info "Setting up environment..."

if [ -f "${SCRIPT_DIR}/.env" ]; then
  ok ".env already exists — skipping"
else
  cp "${SCRIPT_DIR}/.env.example" "${SCRIPT_DIR}/.env"
  # Generate random secrets
  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | tr -d '\n' | head -c 64)
  DB_PASSWORD=$(openssl rand -base64 18 2>/dev/null || head -c 24 /dev/urandom | base64 | tr -d '\n/+=' | head -c 18)

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" "${SCRIPT_DIR}/.env"
    sed -i '' "s|MARIADB_ROOT_PASSWORD=.*|MARIADB_ROOT_PASSWORD=${DB_PASSWORD}|" "${SCRIPT_DIR}/.env"
    sed -i '' "s|DOCKER_DB_ROOT_PASSWORD=.*|DOCKER_DB_ROOT_PASSWORD=${DB_PASSWORD}|" "${SCRIPT_DIR}/.env"
  else
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" "${SCRIPT_DIR}/.env"
    sed -i "s|MARIADB_ROOT_PASSWORD=.*|MARIADB_ROOT_PASSWORD=${DB_PASSWORD}|" "${SCRIPT_DIR}/.env"
    sed -i "s|DOCKER_DB_ROOT_PASSWORD=.*|DOCKER_DB_ROOT_PASSWORD=${DB_PASSWORD}|" "${SCRIPT_DIR}/.env"
  fi

  ok ".env created with generated secrets"
  warn "Edit .env to set your domain and Resend API key!"
fi

# Transfer .env
if [ ! -f "${PROJECTS_DIR}/transfer/.env" ]; then
  cp "${PROJECTS_DIR}/transfer/.env.example" "${PROJECTS_DIR}/transfer/.env"
  if [ -f "${SCRIPT_DIR}/.env" ]; then
    DB_PW=$(grep "^MARIADB_ROOT_PASSWORD=" "${SCRIPT_DIR}/.env" | cut -d= -f2)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|DB_PASSWORD=.*|DB_PASSWORD=${DB_PW}|" "${PROJECTS_DIR}/transfer/.env"
    else
      sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=${DB_PW}|" "${PROJECTS_DIR}/transfer/.env"
    fi
  fi
  ok "transfer/.env created"
fi

# ── 4. Create data directories for maps ──
info "Creating data directories..."
for exp in classic tbc wotlk; do
  mkdir -p "${SCRIPT_DIR}/data/${exp}"
done
ok "data/classic/, data/tbc/, data/wotlk/ created"

# ── 5. Summary ──
echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env — set SERVER_PUBLIC_IP, MW_DOMAIN, RESEND_API_KEY"
echo "  2. Place game data (maps/vmaps/mmaps/dbc) in data/classic/, data/tbc/, data/wotlk/"
echo "  3. Start servers: docker compose up -d  (in each stack directory)"
echo "  4. Or use: ./update.sh --build-all  to build and start everything"
echo ""
