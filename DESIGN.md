# PostHog CLI (`posthog`) — Design Document

## Context
PostHog provides a web UI, SDK, API, and MCP server but no proper CLI. The existing official `@posthog/cli` (Rust) is very limited (login, query, sourcemap only). MCPs in general are not a good fit for AI agent tooling — terminal CLI tools are more predictable, composable, and debuggable for agents like Claude Code. Goal: a TypeScript/Node.js CLI (`posthog`) that Claude Code can invoke via bash to manage PostHog projects — JSON output by default, core operations only.

---

## Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js v22+ (native fetch, no node-fetch needed)
- **CLI framework**: `commander` (simple, battle-tested)
- **Binary name**: `posthog`
- **Minimal deps**: `commander` + `chalk` only

---

## Project Structure

```
poshog-cli/
├── src/
│   ├── index.ts              # Entry: commander root, subcommand wiring
│   ├── client.ts             # PostHog API client (auth, fetch, retry on 429)
│   ├── config.ts             # Config read/write (~/.config/posthog/config.json)
│   ├── output.ts             # stdout JSON / stderr errors helper
│   └── commands/
│       ├── config.ts         # posthog config set / show
│       ├── flags.ts          # posthog flags *
│       ├── experiments.ts    # posthog experiments *
│       ├── insights.ts       # posthog insights *
│       ├── dashboards.ts     # posthog dashboards *
│       └── query.ts          # posthog query <hogql>
├── package.json
└── tsconfig.json
```

---

## Auth & Config

Priority (highest first):
1. Env vars: `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_HOST`
2. Local project config: `.posthog.json` in cwd
3. Global config: `~/.config/posthog/config.json`

Config shape:
```json
{ "apiKey": "phx_...", "projectId": "12345", "host": "https://us.posthog.com" }
```

---

## Commands (MVP Scope)

```
posthog config set --api-key <key> --project-id <id> [--host <url>]
posthog config show

posthog flags list [--search <text>] [--active]
posthog flags get <key-or-id>
posthog flags create --key <key> --name <name> [--rollout <0-100>]
posthog flags update <key-or-id> [options]
posthog flags enable <key-or-id>
posthog flags disable <key-or-id>
posthog flags delete <key-or-id>

posthog experiments list [--status draft|running|complete]
posthog experiments get <id>
posthog experiments results <id>
posthog experiments launch <id>
posthog experiments pause <id>
posthog experiments end <id>

posthog insights list [--search <text>]
posthog insights get <id>

posthog dashboards list
posthog dashboards get <id>

posthog query "<hogql>"
```

---

## API Client (`src/client.ts`)

- Base URL: `{host}/api/projects/{projectId}/`
- Auth header: `Authorization: Bearer {apiKey}`
- Retry on 429 with exponential backoff (max 3 retries)
- Throw typed errors; all caught in command layer and printed to stderr as `{ "error": "..." }` with non-zero exit code
- Pagination: auto-fetch next page when `--all` flag passed (default: first page, limit 100)

---

## Output Conventions

- **stdout**: Always valid JSON (either object or array)
- **stderr**: Human-readable error messages + `process.exit(1)`
- No pretty-printing by default (compact JSON for AI parsing)
- `--pretty` flag for human-readable indented output

---

## Implementation Milestones

1. **Scaffold** — `package.json`, `tsconfig.json`, `src/index.ts` entry, build script (`tsc`), dev script (`tsx`), `bin: { "posthog": "./dist/index.js" }`
2. **Config** — `src/config.ts` + `posthog config set/show`
3. **API client** — `src/client.ts` with auth, fetch, 429 retry
4. **Feature flags** — full CRUD + enable/disable (highest priority for Claude Code)
5. **Experiments** — list, get, results, launch, pause, end
6. **Insights + dashboards** — read-only list/get
7. **HogQL query** — `posthog query "<sql>"` → raw results JSON

---

## Verification

1. `posthog config set --api-key phx_... --project-id 123` → writes config, shows it back
2. `posthog flags list` → returns JSON array of flags
3. `posthog flags enable my-flag` → returns updated flag JSON
4. `posthog query "SELECT event, count() FROM events GROUP BY event LIMIT 10"` → returns rows JSON
5. `posthog experiments results 42` → returns experiment results JSON
6. Claude Code can run `posthog flags list | jq '.[].key'` to extract flag keys

---

## Key PostHog API Endpoints

- Feature flags: `GET/POST /api/projects/:id/feature_flags/`
- Flag detail: `GET/PATCH/DELETE /api/projects/:id/feature_flags/:flagId/`
- Experiments: `GET/POST /api/projects/:id/experiments/`
- Experiment results: `GET /api/projects/:id/experiments/:id/results/`
- Insights: `GET /api/environments/:id/insights/`
- Dashboards: `GET /api/environments/:id/dashboards/`
- Query (HogQL): `POST /api/environments/:id/query/`

Note: some endpoints use `environments` (newer) vs `projects` (legacy) — handle both.
