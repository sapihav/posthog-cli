# Roadmap

Forward-looking plan for `posthog-cli`. North star: feel like a frictionless extension of PostHog's official tooling, so PostHog itself doesn't need to invest. Near-term focus: **AI-agent UX polish** (the differentiator vs the MCP).

> Format: each milestone is one PR, ~150–300 lines of app code, in strict order. Future agents picking this up should ship them sequentially, not batch them.

---

## Status

- v0.1.4 published to npm. Core surface complete: `login`, `config`, `flags`, `experiments`, `insights`, `dashboards`, `query`.
- Official `@posthog/cli` (Rust) is largely abandoned and installs as `posthog-cli`. Our binary is `posthog`. No collision.

---

## Milestone 1 — Self-describing CLI ✅ shipped (#1)

Make the CLI introspectable at runtime so agents don't have to scrape `--help`.

- `posthog schema` — emit full command tree as JSON (commands, options, arguments, output shapes)
- `--help --json` at every level — same data scoped to the current subcommand
- Pointer to `posthog schema` from `posthog --help`

**Files:** `src/commands/schema.ts` (new), `src/index.ts`, `src/output.ts`, `test/schema.test.ts`

**Verify:** `posthog schema | jq '.commands | length'` returns the command count.

---

## Milestone 2 — Stable output shapes + `--fields` ✅ shipped (#2)

Pin down JSON output and let agents trim payloads to control token cost.

- Per-command TypeScript interfaces colocated in each `src/commands/<name>.ts`
- `--fields <a,b,c>` global flag for list/get commands — post-filters response objects to only the listed keys
- `OUTPUT.md` — human-readable mirror of shapes (same data the schema command exposes)

**Files:** `src/commands/*.ts`, `src/client.ts`, `src/output.ts`, `OUTPUT.md` (new)

**Verify:** `posthog flags list --fields key,active` returns objects with only those two keys.

---

## Milestone 3 — Structured errors + `--dry-run` ⏳ in progress

Make failures machine-readable and add a safety rail for mutations.

- stderr emits structured JSON: `{ "error": { "message", "code", "hint?", "docs_url?" } }`
- Error codes: `AUTH_MISSING`, `AUTH_INVALID`, `NOT_FOUND`, `RATE_LIMITED`, `API_ERROR`, `VALIDATION`
- `--dry-run` on every mutating command — prints the planned API request, no network call, exit 0

**Files:** `src/output.ts`, `src/client.ts`, `src/commands/flags.ts`, `src/commands/experiments.ts`, `test/output.test.ts`, `test/client.test.ts`

**Verify:** bad key emits `{"error":{"code":"AUTH_INVALID",...}}`; `posthog flags create --key x --name X --dry-run` prints request payload, exit 0.

---

## MCP parity plan (M4 → M14)

Goal: replace PostHog MCP (~200 tools across ~30 domains) with this CLI. Upstream MCP source of truth: `github.com/PostHog/posthog/tree/master/services/mcp`. Domain grouping follows that repo's tool categories. Each milestone below is **one PR, ≤500 LoC app code**, sequential — no batching.

### Milestone 4 — Contract flags hardening

Complete the workspace-standard flag contract on every existing and future command.

- `--quiet`, `--verbose`, `--out <file>`, `--limit N`, `--json-errors` (already partial via M3 — extend everywhere).
- stdin `-` support on commands that take a query, key, or ID.
- Env-var-only auth mode (the workspace CLAUDE.md mandates no file fallback); introduce `POSTHOG_CONFIG=env-only` switch. Keep `~/.config/posthog/config.json` as default for backward compatibility.

**Verify:** `posthog flags list --limit 5 --quiet --pretty` prints 5 flags, no progress on stderr; `echo "flag_key" | posthog flags get -` works.

### Milestone 5 — Feature flags full parity

The MCP's 16-tool flag surface collapses into CLI subcommands.

- `posthog flags copy --from PROJECT --to PROJECT --keys k1,k2`
- `posthog flags dependents <key>` — tools that reference this flag.
- `posthog flags status <key>` — evaluation-reasons + blast-radius summary.
- `posthog flags blast-radius <key>` — estimate % users affected.
- `posthog flags evaluation-reasons <key> --distinct-id <id>` — why this user sees what they see.
- `posthog flags scheduled list|create|update|delete` — scheduled rollouts.

**Verify:** `posthog flags blast-radius <key>` returns `{pct_affected, sample_size, ...}`.

### Milestone 6 — HogQL runner v2

Turn `query` into a first-class SQL surface.

- `posthog query run "<hogql>" --params @params.json --format json|csv`.
- `posthog query nl "<question>"` — `query-generate-hogql-from-question` equivalent; returns the generated HogQL and optionally executes with `--run`.
- `posthog query saved list|get|run <id>` — read-only access to saved "endpoints" (HogQL-backed APIs). Write side deferred to a later stretch milestone.

**Verify:** `posthog query nl "top 5 events last 24h" --run --limit 5` returns rows.

### Milestone 7 — Experiments full CRUD

Close the write gap on experiments (current CLI is read/control-plane only).

- `posthog experiments create --key X --name X --variants @variants.json`
- `posthog experiments update <id> --patch @patch.json`
- `posthog experiments delete <id>`
- `posthog experiments archive <id>` / `unarchive <id>`
- `posthog experiments reset <id>` / `resume <id>` / `ship-variant <id> --variant X`

**Verify:** round-trip: create → launch → results → ship-variant → archive.

### Milestone 8 — Insights + dashboards write surface

Add create/update/delete for insights and dashboards; add insight-to-dashboard wiring.

- `posthog insights create|update|delete` (schema via `--query @query.json`).
- `posthog dashboards create|update|delete`.
- `posthog dashboards add-insight <dash_id> --insight <insight_id>`
- `posthog dashboards reorder-tiles <dash_id> --tiles @order.json`
- `posthog dashboards run <dash_id>` — execute all insights; `insights-run` parity.

**Verify:** create insight → add to new dashboard → run dashboard; all JSON envelopes stable.

### Milestone 9 — Persons + cohorts

- `posthog persons list|get|delete --distinct-id X`
- `posthog persons property set|delete --distinct-id X --key K --value V`
- `posthog persons bulk-delete --filter @filter.json`
- `posthog cohorts list|get|create|update|delete`
- `posthog cohorts static add-persons <id> --ids @ids.json` / `remove-persons <id>`

**Verify:** static cohort round-trip (create → add 3 persons → get → remove → delete).

### Milestone 10 — Surveys

- `posthog surveys list|get|create|update|delete`
- `posthog surveys stats <id>` (per-survey stats)
- `posthog surveys global-stats`

**Verify:** create draft survey → get → update → stats returns response aggregates → delete.

### Milestone 11 — Error tracking

- `posthog errors issues list|get|update <id>`
- `posthog errors issues merge --into <id> --from <ids>`
- `posthog errors issues split <id>`
- `posthog errors rules list|create`
- `posthog errors query --filter @filter.json` — wraps `query-error-tracking-issues`.

**Verify:** query for top issues, update one to `resolved`, confirm via get.

### Milestone 12 — Taxonomy (actions, annotations, definitions)

- `posthog actions list|get|create|update|delete`
- `posthog annotations list|get|create|update|delete`
- `posthog event-definitions list|update`
- `posthog property-definitions list`

**Verify:** create an action, find it in `list`, update, delete.

### Milestone 13 — Session replays

- `posthog replays list|get|delete <id>`
- `posthog replays playlists list|get|create|update|delete`
- `--filter @filter.json` (search filters match MCP replay query tool).

**Verify:** list recent replays, fetch one, create a playlist containing it.

### Milestone 14 — Query wrappers (funnel/trends/lifecycle/retention/paths/stickiness)

Thin, opinionated wrappers over the M6 query core. Each wraps MCP's dedicated trend/funnel/etc. tool.

- `posthog query funnel @config.json`
- `posthog query trends @config.json`
- `posthog query lifecycle @config.json`
- `posthog query retention @config.json`
- `posthog query paths @config.json`
- `posthog query stickiness @config.json`

**Verify:** `posthog query trends @examples/daily-active-users.json` returns the same shape as the MCP `query-run-trends` tool.

---

## Deferred — long tail MCP parity (stretch, demand-driven)

After M14, the CLI covers ~70% of PostHog MCP tool count. The remaining ~30% is lower-usage and should be scoped **only when concrete demand surfaces**:

1. **LLM analytics + evaluations** (12 tools) — costs, evals CRUD + run/test.
2. **Data warehouse views + endpoints** (16 tools) — views CRUD + materialise, HogQL-backed endpoints CRUD.
3. **CDP functions + templates** (8 tools) — `hog_functions` CRUD + invocations.
4. **Notebooks** (5 tools).
5. **Alerts + subscriptions** (9 tools).
6. **Reverse proxies, integrations, workflows, conversations, roles, org/project switching, early access features, prompts** (~30 tools combined).
7. **Docs + entity search** (`docs-search`, `entity-search`) — standalone one-PR additions, low effort, high agent value; ship any time.

---

## Deferred (non-parity infrastructure)

1. **Trust signals** — GitHub Actions CI (build + test on Node 20/22), `CHANGELOG.md`, `CONTRIBUTING.md`, issue/PR templates, semver discipline.
2. **Multi-project switching** — `posthog use <project>` and equivalent for orgs.
3. **Discoverability** — community post in `posthog/posthog`, docs PR mentioning the CLI under tooling, npm badges.
4. **Claude Code integration kit** — slash commands, CLAUDE.md snippet, recipes. *Optional, opt-in only.*
5. **Self-telemetry** (opt-in, off by default) — emit anonymous usage events to PostHog itself. Eat your own dogfood; builds the case to PostHog that real people use it.

---

## Principles

- **One milestone = one PR**, ~500 lines of app code max. Refuse to batch; review and merge each before starting the next.
- **JSON contract is sacred:** stdout always valid JSON; stderr structured (after M3); never break documented shapes without a major version bump.
- **YAGNI:** no plugin system, no TUI, no nice-to-have features without an explicit ask.

---

## References

- [Rewrite Your CLI for AI Agents — Justin Poehnelt](https://justin.poehnelt.com/posts/rewrite-your-cli-for-ai-agents/)
- [Heroku CLI Style Guide](https://devcenter.heroku.com/articles/cli-style-guide)
- [Linux CLI apps should have a --json flag](https://thomashunter.name/posts/2012-06-06-linux-cli-apps-should-have-a-json-flag)
