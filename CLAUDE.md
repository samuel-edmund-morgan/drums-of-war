# CMaNGOS Multi-Expansion Transfer Platform

## Quick Context

Personal WoW private server project by Samuel Morgan. Three game servers in Docker on remote ARM64 host (`workspace` / `64.181.205.211`), character transfer pipeline between expansions, and a public website at `world-of-warcraft.morgan-dev.com`.

**Final topology (3 servers, 3 emulators):**
- Classic — VMaNGOS (`vmangos-classic`)
- TBC — cmangos (`cmangos-tbc`)
- WotLK — AzerothCore (`azerothcore`)

## Language

Communicate in **Ukrainian** by default. Code, commands, paths, identifiers stay in their canonical language.

## Key Files (read order)

1. `workflow_config.md` — role, credentials, environment config
2. `remote_access.md` — SSH access to `workspace`
3. `docs/PROJECT_STATUS.md` — current state and next priorities
4. `docs/BACKLOG.md` — canonical task queue (BACKLOG-FIRST rule applies)
5. `docs/ARCHITECTURE.md` — system architecture and components
6. `docs/TRANSFER_SYSTEM.md` — character transfer pipeline details
7. `docs/DECISIONS.md` — architectural decisions log
8. `docs/COMMANDS_REFERENCE.md` — operational commands reference

## Project Structure

```
wow_projects/
├── CLAUDE.md                    ← you are here
├── AGENTS.md                    ← portable AI agent instructions
├── workflow_config.md           ← credentials, role, environment
├── remote_access.md             ← SSH access details
├── docs/                        ← canonical documentation
│   ├── BACKLOG.md               ← task queue (source of truth)
│   ├── PROJECT_STATUS.md        ← current state
│   ├── ARCHITECTURE.md          ← system design
│   ├── TRANSFER_SYSTEM.md       ← transfer pipeline
│   ├── DECISIONS.md             ← decisions log
│   ├── COMMANDS_REFERENCE.md    ← operations reference
│   ├── CONTINUATION_GUIDE.md    ← onboarding for new agents
│   ├── SESSION_LOG.md           ← append-only session history
│   ├── MODULES.md               ← module ownership map
│   ├── PROJECT_BRIEF.md         ← project scope and goals
│   ├── TESTING_AND_RELEASE.md   ← test/release policies
│   └── LEGACY_*_ARCHIVE.md      ← historical archives
├── localProjects/cmangos_projects/
│   ├── docker-tbc/              ← TBC Docker stack descriptors
│   ├── docker-azerothcore/      ← AzerothCore Docker stack
│   ├── docker-website/          ← website deploy layer + audit harness
│   ├── vmangos-classic/         ← VMaNGOS Classic stack
│   ├── mangos-website/          ← website PHP source
│   ├── transfer/                ← transfer pipeline scripts/SQL
│   ├── mangos-classic/          ← upstream source reference (read-only)
│   ├── azerothcore-wotlk/       ← AzerothCore source (build-capable)
│   ├── issues.wiki/             ← upstream wiki reference
│   └── spp-classics-cmangos/    ← reference project
└── additionalContextFiles/      ← extra context (currently empty)
```

## Remote Access

```bash
# Establish SSH ControlMaster (needs YubiKey touch on first connect)
ssh -o ControlMaster=yes -o ControlPath=/tmp/ssh-ws -o ControlPersist=600 -N workspace

# Run commands via multiplexed channel
ssh -o ControlPath=/tmp/ssh-ws workspace '<command>'
```

**Remote paths:** `/opt/vmangos-classic/`, `/opt/cmangos-tbc/`, `/opt/docker-azerothcore/`, `/opt/cmangos-transfer/`, `/opt/mangos-website/`

## Critical Rules

1. **BACKLOG-FIRST**: Before implementing any requirement, decompose into tasks in `docs/BACKLOG.md` first. No exceptions.
2. **Approval tokens**: `+` for test deploys, `ТОПОЛЬ` for destructive/live mutations.
3. **No improvisation around blockers**: If something is blocked, stop and report.
4. **Update docs in the same cycle**: Any change that affects verified reality must update relevant docs before the task is considered done.
5. **Transfer pipeline**: Always sequential `Classic → TBC verify → WotLK verify`. Login bot is a mandatory gate.
6. **Remote operations are high-risk**: No separate staging/prod. Treat all `workspace` mutations carefully.
7. **NEWS-ON-DEPLOY**: After completing a significant user-facing feature or infrastructure change, add a news entry to `localProjects/cmangos_projects/mw-unified-site/src/data/news.json`. See format below.

## Website News

After each significant deployed change, append an entry to `src/data/news.json` in the unified site. This keeps the public website news feed up-to-date with real project progress.

**File:** `localProjects/cmangos_projects/mw-unified-site/src/data/news.json`

**Format:**
```json
{
  "id": <next_integer>,
  "title": "Short title of what was done",
  "author": "Drums of War Team",
  "date": "<ISO 8601 UTC timestamp>",
  "preview": "1-2 sentence description of what changed and why it matters to players.",
  "patch": "general" | "classic" | "tbc" | "wotlk",
  "tag": "feature" | "improvement" | "announcement" | "infrastructure" | "bugfix"
}
```

**When to add a news entry:**
- New page or major UI feature (e.g. armory, transfer, guide)
- Auth/account system changes
- Server infrastructure changes (migration, upgrade)
- Transfer pipeline improvements
- Significant bug fixes that affected players

**When NOT to add:**
- Internal refactoring with no user-visible change
- Minor CSS tweaks
- Documentation-only changes

**Tags:**
- `feature` — new capability (transfer, armory, login)
- `improvement` — enhancement to existing feature
- `announcement` — general project news
- `infrastructure` — server/backend changes
- `bugfix` — fix for a player-facing bug

## DB Credentials

MariaDB root password for all CMaNGOS containers: see `workflow_config.md` (`MARIADB_ROOT_PASSWORD`).

## Current Focus

Check `docs/PROJECT_STATUS.md` header for the latest priorities and blockers.
