# Довідник Команд

Залишай тут лише команди, які реально використовуються в цьому проєкті. Команди нижче консолідують template і legacy workflow.

## Універсальний preflight

```bash
gh --version
gh auth status
git --version
docker --version
python3 --version
ssh -G workspace | sed -n '1,10p'
```

## Пошук локального контексту

```bash
pwd
find localProjects -maxdepth 2 -type d | sort
find additionalContextFiles -maxdepth 2 -type f | sort
find localProjects/cmangos_projects -maxdepth 2 -type f -name '*.md' | sort
```

## Віддалений доступ

```bash
# Створити / відновити ControlMaster
ssh -fN -o ControlMaster=yes -o ControlPath=/tmp/ssh-ws -o ControlPersist=8h \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 workspace

# Перевірити multiplexed session
ssh -o ControlPath=/tmp/ssh-ws -O check workspace

# Базова команда
ssh -o ControlPath=/tmp/ssh-ws workspace 'pwd'
```

## Docker Compose та runtime

```bash
# Classic
ssh -o ControlPath=/tmp/ssh-ws workspace 'cd /opt/cmangos-classic && docker compose ps'
ssh -o ControlPath=/tmp/ssh-ws workspace 'cd /opt/cmangos-classic && docker compose logs --tail 50'

# TBC
ssh -o ControlPath=/tmp/ssh-ws workspace 'cd /opt/cmangos-tbc && docker compose ps'
ssh -o ControlPath=/tmp/ssh-ws workspace 'cd /opt/cmangos-tbc && docker compose logs --tail 50'

# WotLK
ssh -o ControlPath=/tmp/ssh-ws workspace 'cd /opt/cmangos-wotlk && docker compose ps'
ssh -o ControlPath=/tmp/ssh-ws workspace 'cd /opt/cmangos-wotlk && docker compose logs --tail 50'

# TASK-014 fallback: temporary debug-build path for WotLK crash triage
# 1. Keep the normal release Dockerfile as the default source of truth.
# 2. Only for crash triage, temporarily switch the local build flags in
#    localProjects/cmangos_projects/docker-wotlk/Dockerfile.server from:
#      -DDEBUG=0
#    to:
#      -DCMAKE_BUILD_TYPE=Debug \
#      -DDEBUG=1
# 3. Rebuild a separate local image tag instead of overwriting the normal release tag.
docker build \
  -t semorgana/cmangos-wotlk:debug \
  -f localProjects/cmangos_projects/docker-wotlk/Dockerfile.server \
  localProjects/cmangos_projects/docker-wotlk

# 4. Run the debug image with the same WotLK ports and volumes so crash behavior stays comparable.
docker compose \
  --env-file localProjects/cmangos_projects/docker-wotlk/.env.example \
  -f localProjects/cmangos_projects/docker-wotlk/docker-compose.yml \
  up -d

# 5. Capture the first failure signals before restart noise hides them.
docker logs cmangos-wotlk-server --tail 200
docker inspect cmangos-wotlk-server --format '{{.State.Status}} {{.State.ExitCode}}'

# 6. A healthy run should still end in the normal startup markers rather than a crash loop.
docker logs cmangos-wotlk-server --tail 200 | rg 'World initialized|CMaNGOS/Realm-daemon started|Segmentation fault|core dumped|Assertion'

# Загальний список контейнерів
ssh -o ControlPath=/tmp/ssh-ws workspace 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
```

## Targeted transfer runner

```bash
# Local syntax gates for the request-scoped Classic -> TBC runner
bash -n localProjects/cmangos_projects/transfer/lib.sh
bash -n localProjects/cmangos_projects/transfer/daily-sync.sh
bash -n localProjects/cmangos_projects/transfer/targeted-transfer-runner.sh

# Help / CLI contract
bash localProjects/cmangos_projects/transfer/targeted-transfer-runner.sh --help

# Safe remote dry-run using the runtime's sync-accounts.conf
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./targeted-transfer-runner.sh --account SAMUEL --character Samuel --dry-run'

# Dry-run with explicit password override
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./targeted-transfer-runner.sh --account SAMUEL --password samuel --character Samuel --dry-run'

# Example real execution shape
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./targeted-transfer-runner.sh --account SAMUEL --character Samuel --request-id req-12345'
```

## Chained WotLK runner

```bash
# Local syntax gates
bash -n localProjects/cmangos_projects/transfer/chained-wotlk-transfer-runner.sh

# Safe remote dry-run from Classic via TBC
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./chained-wotlk-transfer-runner.sh --source classic --account SAMUEL --character Samuel --dry-run'

# Safe remote dry-run for direct TBC-origin path
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./chained-wotlk-transfer-runner.sh --source tbc --account SAMUEL --character Samuel --dry-run'

# Example real execution shapes
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./chained-wotlk-transfer-runner.sh --source classic --account SAMUEL --character Samuel --request-id req-12345'

ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./chained-wotlk-transfer-runner.sh --source tbc --account SAMUEL --character Samuel --request-id req-12346'

# TASK-041 acceptance harness: duplicate guards + stale recovery
bash -n localProjects/cmangos_projects/transfer/request-locks.sh
bash -n localProjects/cmangos_projects/transfer/test-request-lock-guards.sh
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && ./test-request-lock-guards.sh'
```

## Transfer operator controls

```bash
# Inspect current operator-control flags and active request locks
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && mkdir -p runtime/control runtime/request-locks && find runtime/control runtime/request-locks -maxdepth 2 -type f | sort'

# Show the current self-service disable / pause / emergency-stop metadata if present
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && for f in runtime/control/self-service-transfer.disabled.flag runtime/control/transfer-queue.paused.flag runtime/control/emergency-stop.flag; do if [ -f "$f" ]; then echo --- "$f" ---; sed -n "1,120p" "$f"; fi; done'

# Disable new self-service transfer submits at the feature level
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && mkdir -p runtime/control && printf "%s\n" "actor=<operator>" "reason=<maintenance_or_incident>" "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" > runtime/control/self-service-transfer.disabled.flag'

# Re-enable self-service transfer submits
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && rm -f runtime/control/self-service-transfer.disabled.flag'

# Pause the transfer queue without deleting request/lock evidence
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && mkdir -p runtime/control && printf "%s\n" "actor=<operator>" "reason=<queue_pause_reason>" "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" > runtime/control/transfer-queue.paused.flag'

# Resume the transfer queue
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && rm -f runtime/control/transfer-queue.paused.flag'

# Declare emergency-stop mode before manual runtime intervention
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && mkdir -p runtime/control && printf "%s\n" "actor=<operator>" "reason=<incident_reason>" "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" > runtime/control/emergency-stop.flag'

# Inspect active lock metadata before clearing locks or killing runners
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && find runtime/request-locks -mindepth 1 -maxdepth 2 -name metadata -print | sort | while read f; do echo --- "$f" ---; sed -n "1,160p" "$f"; done'

# Exit emergency-stop mode only after recovery evidence is captured
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/cmangos-transfer && rm -f runtime/control/emergency-stop.flag'
```

Operational note:

- These commands manage only the canonical runtime control flags. They do not replace the future request-head/event audit writer; any operator retry/cancel action still requires the corresponding immutable operator event once persistent request rows are live.

## Legacy website local container

```bash
# Переглянути підготовлений website deploy layer
find localProjects/cmangos_projects/docker-website -maxdepth 3 -type f | sort

# Перевірити build-time compose graph
docker compose \
  --env-file localProjects/cmangos_projects/docker-website/.env.example \
  -f localProjects/cmangos_projects/docker-website/docker-compose.yml \
  config

# Зібрати локальний image
docker compose \
  --env-file localProjects/cmangos_projects/docker-website/.env.example \
  -f localProjects/cmangos_projects/docker-website/docker-compose.yml \
  build mangos-website

# Перевірити локальний image/tag set
docker image inspect semorgana/mangos-website:local \
  --format '{{.Id}} {{.RepoTags}}'

# Lint runtime config helper через disposable PHP container
docker run --rm -v "$PWD":/work -w /work php:8.2-cli \
  php -l localProjects/cmangos_projects/docker-website/scripts/configure-app.php

# Local container smoke без Traefik/real DB
docker rm -f task017-web || true
docker run -d --name task017-web \
  --tmpfs /tmp:size=64m,mode=1777 \
  --tmpfs /var/lib/php/sessions:size=32m,mode=1733 \
  --tmpfs /var/lock/apache2:size=4m \
  --tmpfs /var/run/apache2:size=16m \
  -e MW_BASE_URL=https://world-of-warcraft.morgan-dev.com/ \
  -e MW_DB_HOST=example.invalid \
  -e MW_DB_PORT=3306 \
  -e MW_DB_NAME=wotlkrealmd \
  -e MW_DB_USER=root \
  -e MW_DB_PASSWORD=change-me \
  -e MW_DEFAULT_REALM_ID=1 \
  -e MW_MULTIREALM=0 \
  -e MW_EXPANSION=2 \
  -e MW_DEFAULT_TEMPLATE=wotlk \
  -e MW_SITE_TITLE="World of Warcraft" \
  -e MW_SITE_EMAIL=webmaster@world-of-warcraft.morgan-dev.com \
  -e MW_PUBLIC_MODE=1 \
  -p 8089:80 semorgana/mangos-website:local
docker exec task017-web sh -lc \
  "grep -nE '<default_template>|<site_register>|<site_title>|<base_href>' /var/www/runtime/config/config.xml"
docker exec task017-web php -m | grep -E '^(gd|mysql|mysqli|mysqlnd|pdo_mysql)$'
curl -I http://127.0.0.1:8089/
curl -I http://127.0.0.1:8089/donate.php
curl -I 'http://127.0.0.1:8089/index.php?n=admin'
curl -I 'http://127.0.0.1:8089/index.php?n=account.manage'
curl -I http://127.0.0.1:8089/install/
curl -I http://127.0.0.1:8089/config/config.xml
docker rm -f task017-web
```

## Legacy website browser audit

```bash
# Bootstrap isolated Playwright env once
python3 -m venv localProjects/cmangos_projects/docker-website/browser-audit/.venv
localProjects/cmangos_projects/docker-website/browser-audit/.venv/bin/python -m pip install \
  -r localProjects/cmangos_projects/docker-website/browser-audit/requirements.txt
localProjects/cmangos_projects/docker-website/browser-audit/.venv/bin/python -m playwright install chromium

# Run the live audit against the current public site
localProjects/cmangos_projects/docker-website/browser-audit/run_live_audit.sh

# Run the manifest-driven full website matrix with remote log collection
localProjects/cmangos_projects/docker-website/browser-audit/run_live_matrix_audit.sh

# Run the logged-in auth render gate across Classic/TBC/WotLK
sh localProjects/cmangos_projects/docker-website/browser-audit/run_live_auth_audit.sh

# Inspect the first verified baseline
cat localProjects/cmangos_projects/docker-website/browser-audit/reports/20260315_092632/summary.json
sed -n '1,120p' localProjects/cmangos_projects/docker-website/browser-audit/reports/20260315_092632/summary.md
```

## Legacy website path-prefix / multiroute proof

```bash
# Validate the multiroute compose contract
docker compose \
  --env-file localProjects/cmangos_projects/docker-website/.env.multiroute.example \
  -f localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml \
  config

# Syntax gates for the prefix-aware deploy layer
bash -n localProjects/cmangos_projects/docker-website/scripts/docker-entrypoint.sh
docker run --rm -v "$PWD":/work -w /work php:8.2-cli \
  php -l localProjects/cmangos_projects/docker-website/scripts/configure-apache.php

# Build the local path-prefix proof image
MW_IMAGE_NAME=semorgana/mangos-website:task024-pathprefix-local docker compose \
  --env-file localProjects/cmangos_projects/docker-website/.env.example \
  -f localProjects/cmangos_projects/docker-website/docker-compose.yml \
  build mangos-website

# Run a disposable prefixed WotLK container
docker rm -f task024-prefix || true
docker run -d --name task024-prefix \
  --tmpfs /tmp:size=64m,mode=1777 \
  --tmpfs /var/lib/php/sessions:size=32m,mode=1733 \
  --tmpfs /var/lock/apache2:size=4m \
  --tmpfs /var/run/apache2:size=16m \
  -e MW_BASE_URL=http://127.0.0.1:8091/wotlk/ \
  -e MW_DB_HOST=example.invalid \
  -e MW_DB_PORT=3306 \
  -e MW_DB_NAME=wotlkrealmd \
  -e MW_DB_USER=root \
  -e MW_DB_PASSWORD=change-me \
  -e MW_DEFAULT_REALM_ID=1 \
  -e MW_MULTIREALM=0 \
  -e MW_EXPANSION=2 \
  -e MW_DEFAULT_TEMPLATE=wotlk \
  -e MW_SITE_TITLE="World of Warcraft WotLK" \
  -e MW_SITE_EMAIL=webmaster@world-of-warcraft.morgan-dev.com \
  -e MW_PUBLIC_MODE=1 \
  -p 8091:80 semorgana/mangos-website:task024-pathprefix-local

# HTTP smoke for prefixed runtime
curl -I http://127.0.0.1:8091/wotlk/
curl -I http://127.0.0.1:8091/wotlk/templates/wotlk/css/newhp.css
curl -I http://127.0.0.1:8091/

# DOM proof that shared_topnav contains patch-switch links
localProjects/cmangos_projects/docker-website/browser-audit/.venv/bin/python - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://127.0.0.1:8091/wotlk/', wait_until='domcontentloaded')
    page.wait_for_timeout(1500)
    nav = page.eval_on_selector('#shared_topnav', """el => ({
      text: el.innerText.replace(/\\s+/g, ' ').trim(),
      hrefs: Array.from(el.querySelectorAll('a')).map(a => a.getAttribute('href'))
    })""")
    print(nav)
    browser.close()
PY

# Cleanup
docker rm -f task024-prefix
```

## Legacy website live deploy

```bash
# Publish the image used by the live rollout
docker tag semorgana/mangos-website:local \
  semorgana/mangos-website:task021-wotlk-public-20260315
docker push semorgana/mangos-website:task021-wotlk-public-20260315

# Backup WotLK realmd before website bootstrap
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb-dump -u root -p"$DB_PASSWORD" wotlkrealmd > /opt/cmangos-wotlk/backups/wotlkrealmd.pre_task021_$(date +%Y%m%d_%H%M%S).sql'

# Upload live deploy bundle
scp -o ControlPath=/tmp/ssh-ws \
  localProjects/cmangos_projects/docker-website/docker-compose.remote.yml \
  workspace:/opt/mangos-website/docker-compose.yml
scp -o ControlPath=/tmp/ssh-ws \
  localProjects/cmangos_projects/mangos-website/install/sql/full_install.sql \
  workspace:/opt/mangos-website/full_install.sql
scp -o ControlPath=/tmp/ssh-ws \
  localProjects/cmangos_projects/docker-website/sql/public-site-compat.sql \
  workspace:/opt/mangos-website/public-site-compat.sql

# Bootstrap website schema into WotLK realmd
ssh -o ControlPath=/tmp/ssh-ws workspace \
  "docker exec -i cmangos-wotlk-db mariadb -u root -p'$DB_PASSWORD' wotlkrealmd" \
  < localProjects/cmangos_projects/mangos-website/install/sql/full_install.sql
ssh -o ControlPath=/tmp/ssh-ws workspace \
  "docker exec -i cmangos-wotlk-db mariadb -u root -p'$DB_PASSWORD' wotlkrealmd" \
  < localProjects/cmangos_projects/docker-website/sql/public-site-compat.sql
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb -u root -p"$DB_PASSWORD" wotlkrealmd -e "REPLACE INTO realm_settings (id_realm, dbhost, dbport, dbuser, dbpass, dbname, chardbname, uptime) VALUES (1, '\''cmangos-wotlk-db'\'', '\''3306'\'', '\''root'\'', '\''$DB_PASSWORD'\'', '\''wotlkmangos'\'', '\''wotlkcharacters'\'', NOW());"'

# Pull and recreate the live container
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/mangos-website && docker pull semorgana/mangos-website:task021-wotlk-public-20260315 && docker compose --env-file .env -f docker-compose.yml up -d --force-recreate'

# Runtime and TLS verification
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Networks}}" | grep -E "^(NAMES|mangos-website)"'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker logs traefik --tail 80 | grep -E "world-of-warcraft|Certificates obtained"'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec mangos-website sh -lc "grep -nE \"<default_template>|<site_register>|<site_title>|<base_href>\" /var/www/html/config/config.xml && php -m | grep -E \"^(gd|mysql|mysqli|mysqlnd|pdo_mysql)$\""'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb -u root -p"$DB_PASSWORD" wotlkrealmd -N -e "SHOW TABLES LIKE \"account_extend\"; SHOW TABLES LIKE \"realm_settings\"; SELECT id_realm,dbhost,dbname,chardbname FROM realm_settings LIMIT 3;"'
curl -I https://world-of-warcraft.morgan-dev.com
curl -I https://world-of-warcraft.morgan-dev.com/install/
curl -I 'https://world-of-warcraft.morgan-dev.com/index.php?n=admin'
curl -I 'https://world-of-warcraft.morgan-dev.com/index.php?n=account.manage'
curl -I https://world-of-warcraft.morgan-dev.com/donate.php
curl -I https://world-of-warcraft.morgan-dev.com/config/config.xml
curl -fsSL https://world-of-warcraft.morgan-dev.com | rg -n "<title>|World of Warcraft|Fatal error|Warning"
openssl s_client -connect world-of-warcraft.morgan-dev.com:443 \
  -servername world-of-warcraft.morgan-dev.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

```bash
# TASK-022 theme/assets repair: publish the fixed image
docker push semorgana/mangos-website:task022-themefix-20260315

# Backup remote runtime env, switch the live image tag, and recreate the container
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/mangos-website && ts=$(date +%Y%m%d_%H%M%S) && cp .env .env.pre_task022_$ts && sed -i "s|^MW_IMAGE_NAME=.*|MW_IMAGE_NAME=semorgana/mangos-website:task022-themefix-20260315|" .env && docker pull semorgana/mangos-website:task022-themefix-20260315 && docker compose --env-file .env -f docker-compose.yml up -d --force-recreate'

# Verify the case-sensitive WotLK theme assets after rollout
curl -I https://world-of-warcraft.morgan-dev.com/templates/wotlk/css/newhp.css
curl -I https://world-of-warcraft.morgan-dev.com/templates/wotlk/js/detection.js
curl -I https://world-of-warcraft.morgan-dev.com/templates/wotlk/images/pixel000.gif
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec mangos-website sh -lc "ls -la /var/www/html/templates | sed -n \"1,20p\""'
```

Scope note:

- Команди в секції `Legacy website path-prefix / multiroute proof` вище доводять лише local multiroute contract, але не виконують live rollout на `workspace`.
- Shared-host multiroute deploy і надалі потребує explicit user approval перед кожною новою infra mutation.

## Legacy website live multiroute deploy

```bash
# Publish the final TASK-025 image
docker push semorgana/mangos-website:task025a-cachebust-20260315

# Upload or refresh the multiroute compose bundle
scp -o ControlPath=/tmp/ssh-ws \
  localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml \
  workspace:/opt/mangos-website/docker-compose.multiroute.yml

# Backup remote env/compose state before switching image tags
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/mangos-website && ts=$(date +%Y%m%d_%H%M%S) && cp .env .env.pre_task025_$ts && cp .env.multiroute .env.multiroute.pre_task025_$ts && cp docker-compose.multiroute.yml docker-compose.multiroute.pre_task025_$ts.yml'

# Bootstrap website tables for Classic and TBC realmd DBs
ssh -o ControlPath=/tmp/ssh-ws workspace \
  "docker exec -i cmangos-db mariadb -u root -p'$DB_PASSWORD' classicrealmd" \
  < localProjects/cmangos_projects/mangos-website/install/sql/full_install.sql
ssh -o ControlPath=/tmp/ssh-ws workspace \
  "docker exec -i cmangos-db mariadb -u root -p'$DB_PASSWORD' classicrealmd" \
  < localProjects/cmangos_projects/docker-website/sql/public-site-compat.sql
ssh -o ControlPath=/tmp/ssh-ws workspace \
  "docker exec -i cmangos-tbc-db mariadb -u root -p'$DB_PASSWORD' tbcrealmd" \
  < localProjects/cmangos_projects/mangos-website/install/sql/full_install.sql
ssh -o ControlPath=/tmp/ssh-ws workspace \
  "docker exec -i cmangos-tbc-db mariadb -u root -p'$DB_PASSWORD' tbcrealmd" \
  < localProjects/cmangos_projects/docker-website/sql/public-site-compat.sql

# Pin the final image for both root and prefixed services, then recreate
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/mangos-website && sed -i "s|^MW_IMAGE_NAME=.*|MW_IMAGE_NAME=semorgana/mangos-website:task025a-cachebust-20260315|" .env .env.multiroute && docker pull semorgana/mangos-website:task025a-cachebust-20260315 && docker compose --env-file .env -f docker-compose.yml up -d --force-recreate && docker compose --env-file .env.multiroute -f docker-compose.multiroute.yml up -d --force-recreate'

# Verify the live containers
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep mangos-website'

# Verify public routes from the local machine, not from workspace
for p in / /classic/ /tbc/ /wotlk/ /classic /tbc /wotlk /wotlk-azcore/ /classic/install/ /tbc/donate.php '/wotlk/index.php?n=admin'; do
  printf '=== %s\n' "$p"
  curl -ksS -D - "https://world-of-warcraft.morgan-dev.com$p" -o /dev/null | sed -n '1,6p'
done

# Browser-side DOM proof for shared_topnav on live routes
localProjects/cmangos_projects/docker-website/browser-audit/.venv/bin/python - <<'PY'
from playwright.sync_api import sync_playwright
paths = ['/', '/classic/', '/tbc/', '/wotlk/']
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for path in paths:
        page = browser.new_page()
        page.goto('https://world-of-warcraft.morgan-dev.com' + path, wait_until='networkidle')
        page.wait_for_timeout(1500)
        nav = page.eval_on_selector('#shared_topnav', """el => ({
          text: el.innerText.replace(/\\s+/g, ' ').trim(),
          links: Array.from(el.querySelectorAll('a')).map(a => ({ href: a.getAttribute('href'), cls: a.className }))
        })""")
        print(path, nav)
        page.close()
    browser.close()
PY
```

Operational note:

- Public route validation for this domain should be done from `morgan.local` or a real browser session. `curl` from the `workspace` host can receive Cloudflare edge `403` responses even when the public site is healthy.

## Legacy website canonical root redirect deploy

```bash
# Publish the TASK-026 image with root redirect + honest patch switcher
docker push semorgana/mangos-website:task026a-rootredirect-20260315

# Upload refreshed root and multiroute compose manifests
scp -o ControlPath=/tmp/ssh-ws \
  localProjects/cmangos_projects/docker-website/docker-compose.remote.yml \
  workspace:/opt/mangos-website/docker-compose.yml
scp -o ControlPath=/tmp/ssh-ws \
  localProjects/cmangos_projects/docker-website/docker-compose.remote.multiroute.yml \
  workspace:/opt/mangos-website/docker-compose.multiroute.yml

# Backup env state, pin the new image, hide unavailable azcore link, and recreate
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/mangos-website && ts=$(date +%Y%m%d_%H%M%S) && cp .env .env.pre_task026_$ts && cp .env.multiroute .env.multiroute.pre_task026_$ts && sed -i "s|^MW_IMAGE_NAME=.*|MW_IMAGE_NAME=semorgana/mangos-website:task026a-rootredirect-20260315|" .env .env.multiroute && if grep -q "^MW_ENABLE_AZCORE_LINK=" .env.multiroute; then sed -i "s|^MW_ENABLE_AZCORE_LINK=.*|MW_ENABLE_AZCORE_LINK=0|" .env.multiroute; else printf "\nMW_ENABLE_AZCORE_LINK=0\n" >> .env.multiroute; fi && docker pull semorgana/mangos-website:task026a-rootredirect-20260315 && docker compose --env-file .env -f docker-compose.yml up -d --force-recreate && docker compose --env-file .env.multiroute -f docker-compose.multiroute.yml up -d --force-recreate'

# Verify container health and live public contract
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep mangos-website'

for p in / /index.php /classic/ /tbc/ /wotlk/ /wotlk-azcore/ /classic/install/ /tbc/donate.php '/wotlk/index.php?n=admin'; do
  printf '=== %s\n' "$p"
  curl -ksS -D - "https://world-of-warcraft.morgan-dev.com$p" -o /dev/null | sed -n '1,6p'
done

localProjects/cmangos_projects/docker-website/browser-audit/.venv/bin/python - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for path in ['/', '/classic/', '/tbc/', '/wotlk/']:
        page = browser.new_page(viewport={'width': 1600, 'height': 300})
        page.goto('https://world-of-warcraft.morgan-dev.com' + path, wait_until='networkidle')
        page.wait_for_timeout(1200)
        nav = page.eval_on_selector('#shared_topnav', """el => ({
          box: (() => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })(),
          links: Array.from(el.querySelectorAll('.tn_patchswitch a')).map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim(), cls: a.className }))
        })""")
        print(path, nav)
        page.close()
    browser.close()
PY
```

## Legacy website residual runtime fix deploy

```bash
# Publish the final TASK-029 image.
docker push semorgana/mangos-website:task029b-armoryrealmfix-20260315

# Backup env state, pin the fixed image, and recreate the website containers.
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'cd /opt/mangos-website && ts=$(date +%Y%m%d_%H%M%S) && cp .env .env.pre_task029b_$ts && cp .env.multiroute .env.multiroute.pre_task029b_$ts && sed -i "s|^MW_IMAGE_NAME=.*|MW_IMAGE_NAME=semorgana/mangos-website:task029b-armoryrealmfix-20260315|" .env .env.multiroute && docker pull semorgana/mangos-website:task029b-armoryrealmfix-20260315 && docker compose --env-file .env -f docker-compose.yml up -d --force-recreate && docker compose --env-file .env.multiroute -f docker-compose.multiroute.yml up -d --force-recreate'

# Verify the repaired prefixed Armory and prototype endpoints.
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep mangos-website'

for p in /classic/armory/index.php /tbc/armory/index.php /wotlk/armory/index.php /classic/js/compressed/prototype.js /tbc/js/compressed/prototype.js /wotlk/js/compressed/prototype.js; do
  printf '=== %s\n' "$p"
  curl -ksS -D - "https://world-of-warcraft.morgan-dev.com$p" -o /dev/null | sed -n '1,6p'
done

# Re-run the browser audit after rollout.
cd localProjects/cmangos_projects/docker-website/browser-audit && ./run_live_audit.sh
```

## AzerothCore local stack

```bash
# Переглянути офіційний prebuilt compose (`acore-docker`)
gh api 'repos/azerothcore/acore-docker/contents/docker-compose.yml' --jq '.content' | base64 --decode

# Переглянути build-capable compose (`azerothcore-wotlk`)
gh api 'repos/azerothcore/azerothcore-wotlk/contents/docker-compose.yml?ref=master' --jq '.content' | base64 --decode

# Клонувати official source для ARM64-safe local builds
git clone https://github.com/azerothcore/azerothcore-wotlk \
  localProjects/cmangos_projects/azerothcore-wotlk

# Підготувати local env
cp localProjects/cmangos_projects/docker-azerothcore/.env.example \
  localProjects/cmangos_projects/docker-azerothcore/.env

# Якщо checkout раніше був sparse-only для schema analysis, розгорни full tree
git -C localProjects/cmangos_projects/azerothcore-wotlk sparse-checkout disable

# Перевірити compose graph без deploy
docker compose \
  --env-file localProjects/cmangos_projects/docker-azerothcore/.env \
  -f localProjects/cmangos_projects/docker-azerothcore/docker-compose.yml \
  config

# Preferred ARM64 path: build locally from official Dockerfile targets
docker compose \
  --env-file localProjects/cmangos_projects/docker-azerothcore/.env \
  -f localProjects/cmangos_projects/docker-azerothcore/docker-compose.yml \
  build azerothcore-db-import azerothcore-client-data-init \
  azerothcore-worldserver azerothcore-authserver

# Boot the local stack
docker compose \
  --env-file localProjects/cmangos_projects/docker-azerothcore/.env \
  -f localProjects/cmangos_projects/docker-azerothcore/docker-compose.yml \
  up -d

# Runtime state and readiness logs
docker compose \
  --env-file localProjects/cmangos_projects/docker-azerothcore/.env \
  -f localProjects/cmangos_projects/docker-azerothcore/docker-compose.yml \
  ps
docker logs azerothcore-authserver --tail 20
docker logs azerothcore-worldserver --tail 20
```

## AzerothCore schema analysis

```bash
# Sparse checkout only the official base SQL we compare against
git clone --filter=blob:none --sparse https://github.com/azerothcore/azerothcore-wotlk \
  localProjects/cmangos_projects/azerothcore-wotlk
git -C localProjects/cmangos_projects/azerothcore-wotlk sparse-checkout set \
  data/sql/base/db_characters data/sql/base/db_auth

# Export live CMaNGOS WotLK characters/auth schemas from `workspace`
mkdir -p /tmp/task009
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb -u root -p"$DB_PASSWORD" -N -e "SELECT table_name,column_name,ordinal_position,column_type,is_nullable,IFNULL(column_default,\"<NULL>\"),column_key FROM information_schema.columns WHERE table_schema=\"wotlkcharacters\" ORDER BY table_name, ordinal_position;"' \
  > /tmp/task009/wotlkcharacters.columns.tsv
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb -u root -p"$DB_PASSWORD" -N -e "SELECT table_name,column_name,ordinal_position,column_type,is_nullable,IFNULL(column_default,\"<NULL>\"),column_key FROM information_schema.columns WHERE table_schema=\"wotlkrealmd\" ORDER BY table_name, ordinal_position;"' \
  > /tmp/task009/wotlkrealmd.columns.tsv

# Inspect official target DDL for critical tables
sed -n '20,120p' localProjects/cmangos_projects/azerothcore-wotlk/data/sql/base/db_characters/characters.sql
sed -n '20,120p' localProjects/cmangos_projects/azerothcore-wotlk/data/sql/base/db_auth/account.sql

# Pull AzerothCore source files that justify migration assumptions
git -C localProjects/cmangos_projects/azerothcore-wotlk sparse-checkout add \
  src/server/game/Entities/Player src/server/game/Handlers
rg -n 'AT_LOGIN|RESET_SPELLS|RESET_TALENTS' \
  localProjects/cmangos_projects/azerothcore-wotlk/src/server/game/Entities/Player \
  localProjects/cmangos_projects/azerothcore-wotlk/src/server/game/Handlers
```

## AzerothCore migration SQL

```bash
# Review the current migration skeleton
sed -n '1,260p' localProjects/cmangos_projects/transfer/migrate_cmangos_wotlk_to_azerothcore.sql

# Export live WotLK characters schema only, without data
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb-dump -u root -p"$DB_PASSWORD" --no-data wotlkcharacters' \
  > /tmp/task010_wotlk_no_data.sql

# Validate the migration file on a throwaway local MariaDB
docker run -d --name task010-mariadb \
  -e MARIADB_ROOT_PASSWORD=test -e MARIADB_DATABASE=task010 mariadb:11
docker exec -i task010-mariadb mariadb -uroot -ptest task010 < /tmp/task010_wotlk_no_data.sql
docker exec -i task010-mariadb mariadb -uroot -ptest task010 \
  < localProjects/cmangos_projects/transfer/migrate_cmangos_wotlk_to_azerothcore.sql
docker exec task010-mariadb mariadb -uroot -ptest task010 -N -e \
  "SHOW TABLES LIKE 'account_tutorial'; SHOW TABLES LIKE 'character_queststatus_rewarded'; SHOW TABLES LIKE 'guild_member_withdraw';"
docker rm -f task010-mariadb

# Local AzerothCore auth DB uses `mysql`, not `mariadb`
export $(grep -v '^#' localProjects/cmangos_projects/docker-azerothcore/.env | xargs)
docker exec azerothcore-db mysql -uroot -p"${DOCKER_DB_ROOT_PASSWORD}" -N -e \
  "SHOW DATABASES LIKE 'acore_auth';"

# Verified SRP6 byte order for AzerothCore auth staging
docker exec azerothcore-db mysql -uroot -p"${DOCKER_DB_ROOT_PASSWORD}" acore_auth -e \
  "SELECT 'use REVERSE(UNHEX(LPAD(s,64,''0''))) for salt and REVERSE(UNHEX(LPAD(v,64,''0''))) for verifier' AS note;"

# Bash syntax gates for transfer scripts on macOS host + Linux/bash5
bash -n localProjects/cmangos_projects/transfer/lib.sh
bash -n localProjects/cmangos_projects/transfer/daily-sync.sh
docker run --rm -v "$PWD":/work -w /work bash:5.2 \
  bash -n localProjects/cmangos_projects/transfer/lib.sh
docker run --rm -v "$PWD":/work -w /work bash:5.2 \
  bash -n localProjects/cmangos_projects/transfer/daily-sync.sh

# Focused post-staging proof after `TASK-012`
docker exec azerothcore-db mysql -uroot -p"${DOCKER_DB_ROOT_PASSWORD}" -N -e \
  "USE acore_auth; SELECT username, expansion, locale, HEX(REVERSE(salt)), HEX(REVERSE(verifier)), failed_logins, mutetime, last_ip, os, Flags FROM account WHERE username='TASK012ACC'; SELECT aa.gmlevel, aa.RealmID FROM account_access aa JOIN account a ON a.id=aa.id WHERE a.username='TASK012ACC';"
python3 localProjects/cmangos_projects/transfer/wow_login_test_universal.py \
  --expansion azerothcore --username TASK012ACC --password task012acc --guid 1 || true
```

## Доступ до БД

```bash
# Remote CMaNGOS DB-контейнери дають `mariadb` / `mariadb-dump`, а local `azerothcore-db` дає `mysql`

# WotLK characters
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb -u root -p"$DB_PASSWORD" wotlkcharacters -N -e "SELECT guid,name,level FROM characters"'

# WotLK realmd accounts
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb -u root -p"$DB_PASSWORD" wotlkrealmd -N -e "SELECT id,username,gmlevel FROM account"'

# Classic / TBC аналоги
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-db mariadb -u root -p"$DB_PASSWORD" classiccharacters -N -e "SELECT guid,name,level FROM characters"'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-tbc-db mariadb -u root -p"$DB_PASSWORD" tbccharacters -N -e "SELECT guid,name,level FROM characters"'
```

## Login Bot і transfer tooling

```bash
# Поточний verified login на target після `TASK-003`
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'python3 /opt/cmangos-transfer/wow_login_test_universal.py --expansion tbc --username SAMUEL --password samuel --guid 1801'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'python3 /opt/cmangos-transfer/wow_login_test_universal.py --expansion wotlk --username SAMUEL --password samuel --guid 1801'

# Legacy WotLK-only bot, якщо ще потрібен
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'python3 /opt/cmangos-transfer/wow_login_test.py --username SAMUEL --password samuel --guid 1801'

# SRP6 helper локально
python3 localProjects/cmangos_projects/transfer/srp6_set_password.py SAMUEL samuel

# AzerothCore local smokes after `TASK-011`
python3 localProjects/cmangos_projects/transfer/wow_login_test_universal.py \
  --expansion wotlk --auth-port 3727 --world-port 8088 \
  --username ACBOT --password acbot --guid 1
python3 localProjects/cmangos_projects/transfer/wow_login_test_universal.py \
  --expansion azerothcore --username ACBOT --password acbot --guid 1

# Інтерактивний transfer
ssh -o ControlPath=/tmp/ssh-ws workspace '/opt/cmangos-transfer/transfer-interactive.sh'

# Manual daily sync
ssh -o ControlPath=/tmp/ssh-ws workspace '/opt/cmangos-transfer/daily-sync.sh'

# Multi-account regression fixture (`TASK-004`) without touching canonical config
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'SYNC_CONF=/opt/cmangos-transfer/sync-accounts.task004.conf /opt/cmangos-transfer/daily-sync.sh'

# Class-coverage regression fixture (`TASK-005`) without touching canonical config
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'SYNC_CONF=/opt/cmangos-transfer/sync-accounts.task005.classacc-only.conf /opt/cmangos-transfer/daily-sync.sh'

# 3-run stability fixture (`TASK-006`) without touching canonical config
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'SYNC_CONF=/opt/cmangos-transfer/sync-accounts.task006.conf /opt/cmangos-transfer/daily-sync.sh'

# Extract only the latest daily-sync log section
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'log=/opt/cmangos-transfer/logs/daily-sync-$(date +%Y%m%d).log; start=$(grep -n "Daily sync started — Sequential Pipeline" "$log" | tail -1 | cut -d: -f1); tail -n +"$start" "$log"'

# Focused summary for the latest multi-account run
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'log=/opt/cmangos-transfer/logs/daily-sync-$(date +%Y%m%d).log; start=$(grep -n "Daily sync started — Sequential Pipeline" "$log" | tail -1 | cut -d: -f1); tail -n +"$start" "$log" | grep -E "AUTO-CREATED|SKIP:|DAILY SYNC SUMMARY|Accounts:|Synced:|Skipped:|Created:|Errors:|Duration:"'

# Перевірити at_login / online після sync
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-tbc-db mariadb -u root -p"$DB_PASSWORD" tbccharacters -N -e "SELECT guid,name,at_login,online FROM characters WHERE name=\"Samuel\";"'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb -u root -p"$DB_PASSWORD" wotlkcharacters -N -e "SELECT guid,name,at_login,online FROM characters WHERE name=\"Samuel\";"'

# Перевірити current_hash vs stored_hash після `TASK-020`
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-tbc-db mariadb -u root -p"$DB_PASSWORD" tbccharacters -N -e "SELECT MD5(CONCAT_WS(\"|\", c.level, c.xp, c.money, c.totaltime, (SELECT COUNT(*) FROM item_instance WHERE owner_guid = c.guid), (SELECT COUNT(*) FROM character_spell WHERE guid = c.guid), (SELECT COUNT(*) FROM character_queststatus WHERE guid = c.guid))) AS current_hash, (SELECT sync_hash FROM character_sync_hash WHERE char_name=\"Samuel\" LIMIT 1) AS stored_hash FROM characters c WHERE c.name=\"Samuel\" LIMIT 1;"'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb -u root -p"$DB_PASSWORD" wotlkcharacters -N -e "SELECT MD5(CONCAT_WS(\"|\", c.level, c.xp, c.money, c.totaltime, (SELECT COUNT(*) FROM item_instance WHERE owner_guid = c.guid), (SELECT COUNT(*) FROM character_spell WHERE guid = c.guid), (SELECT COUNT(*) FROM character_queststatus WHERE guid = c.guid))) AS current_hash, (SELECT sync_hash FROM character_sync_hash WHERE char_name=\"Samuel\" LIMIT 1) AS stored_hash FROM characters c WHERE c.name=\"Samuel\" LIMIT 1;"'

# Multi-account post-run smoke (`TASK-004`)
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'python3 /opt/cmangos-transfer/wow_login_test_universal.py --expansion tbc --username AUTOACC --password AUTOACC --guid 1802'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'python3 /opt/cmangos-transfer/wow_login_test_universal.py --expansion wotlk --username AUTOACC --password AUTOACC --guid 1802'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'python3 /opt/cmangos-transfer/wow_login_test_universal.py --expansion tbc --username SKIPACC --password SKIPACC --guid 1803'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'python3 /opt/cmangos-transfer/wow_login_test_universal.py --expansion wotlk --username SKIPACC --password SKIPACC --guid 1803'

# Class-coverage post-run smoke (`TASK-005`) — run sequentially, not in parallel
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'python3 /opt/cmangos-transfer/wow_login_test_universal.py --expansion tbc --username CLASSACC --password CLASSACC --guid 1804'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'python3 /opt/cmangos-transfer/wow_login_test_universal.py --expansion wotlk --username CLASSACC --password CLASSACC --guid 1804'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'python3 /opt/cmangos-transfer/wow_login_test_universal.py --expansion tbc --username CLASSACC --password CLASSACC --guid 1805'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'python3 /opt/cmangos-transfer/wow_login_test_universal.py --expansion wotlk --username CLASSACC --password CLASSACC --guid 1805'

# TASK-006: inspect dual-baseline hashes on TBC/WotLK
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-tbc-db mariadb -u root -p"$DB_PASSWORD" tbccharacters -N -e "SELECT c.guid,c.name,c.money,c.at_login,c.online,(SELECT sync_hash FROM character_sync_hash WHERE char_name=c.name LIMIT 1),(SELECT source_hash FROM character_sync_hash WHERE char_name=c.name LIMIT 1),(SELECT synced_from FROM character_sync_hash WHERE char_name=c.name LIMIT 1) FROM characters c WHERE c.name IN (\"Testwar\",\"Testhunt\") ORDER BY guid;"'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb -u root -p"$DB_PASSWORD" wotlkcharacters -N -e "SELECT c.guid,c.name,c.money,c.at_login,c.online,(SELECT sync_hash FROM character_sync_hash WHERE char_name=c.name LIMIT 1),(SELECT source_hash FROM character_sync_hash WHERE char_name=c.name LIMIT 1),(SELECT synced_from FROM character_sync_hash WHERE char_name=c.name LIMIT 1) FROM characters c WHERE c.name IN (\"Testwar\",\"Testhunt\") ORDER BY guid;"'

# TASK-006: mutate Classic fixture between Run 2 and Run 3
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'mkdir -p /opt/cmangos-classic/backups && docker exec cmangos-db sh -lc '\''mariadb-dump -uroot -p"$MYSQL_ROOT_PASSWORD" classiccharacters characters --where="name=\"Testwar\""'\'' > /opt/cmangos-classic/backups/classiccharacters.testwar.pre_task006_run3_$(date +%Y%m%d_%H%M%S).sql'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-db mariadb -u root -p"$DB_PASSWORD" classiccharacters -e "UPDATE characters SET money=12345 WHERE name=\"Testwar\";"'
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-db mariadb -u root -p"$DB_PASSWORD" classiccharacters -N -e "SELECT guid,name,money,MD5(CONCAT_WS(\"|\", level, xp, money, totaltime, (SELECT COUNT(*) FROM item_instance WHERE owner_guid = c.guid), (SELECT COUNT(*) FROM character_spell WHERE guid = c.guid), (SELECT COUNT(*) FROM character_queststatus WHERE guid = c.guid))) FROM characters c WHERE c.name IN (\"Testwar\",\"Testhunt\") ORDER BY guid;"'
```

## Логи, readiness і діагностика

```bash
# Шукати ініціалізацію світу
ssh -o ControlPath=/tmp/ssh-ws workspace 'docker logs cmangos-wotlk-server --tail 50'

# Перевірити timers
ssh -o ControlPath=/tmp/ssh-ws workspace 'systemctl list-timers "cmangos-*"'

# Статус конкретних timer-ів
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'systemctl status cmangos-update.timer cmangos-tbc-update.timer cmangos-wotlk-update.timer cmangos-daily-sync.timer --no-pager'

# Останній лог daily sync
ssh -o ControlPath=/tmp/ssh-ws workspace 'tail -n 40 /opt/cmangos-transfer/logs/daily-sync-$(date +%Y%m%d).log'

# Перевірити місце на диску
ssh -o ControlPath=/tmp/ssh-ws workspace 'df -h /opt'

# Перевірити RAM
ssh -o ControlPath=/tmp/ssh-ws workspace 'free -h'
```

## Backup / Restore

```bash
# Backup WotLK characters
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb-dump -u root -p"$DB_PASSWORD" wotlkcharacters > /opt/cmangos-wotlk/backups/chars_$(date +%Y%m%d_%H%M%S).sql'

# Full DB backup
ssh -o ControlPath=/tmp/ssh-ws workspace \
  'docker exec cmangos-wotlk-db mariadb-dump -u root -p"$DB_PASSWORD" --all-databases > /opt/cmangos-wotlk/backups/full_$(date +%Y%m%d).sql'
```

## Docs migration / cleanup

```bash
# Перевірити що ще лишилось із template placeholders
rg -n '\[SET_ME\]|INIT_STATUS: NOT_STARTED|BACKLOG_STATUS: EMPTY|REMOTE_ACCESS_STATUS: EMPTY' \
  workflow_config.md remote_access.md docs

# Переглянути migrated project-owned markdown перед cleanup
find localProjects/cmangos_projects -maxdepth 2 -type f -name '*.md' | sort
```
