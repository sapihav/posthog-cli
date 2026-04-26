# PARITY — posthog-cli vs PostHog API & MCP

**Last audited:** 2026-04-26 · CLI version: HEAD `package.json` v0.2.0; **published npm `posthog-cli@latest` is v0.1.6** — release pipeline lags HEAD by one minor.

**Published-artifact smoke (2026-04-26):** `npm install -g posthog-cli@latest` → v0.1.6. `posthog --help`, `posthog --version`, `posthog schema` all pass. Workspace-contract gap surfaced: `posthog version` (subcommand) is rejected with `unknown command 'version'` — see "Workspace contract gaps" below.

## Scope

`posthog-cli` is intentionally narrow: it ships the read-heavy "agent-facing" surface (flags, experiments, insights, dashboards, HogQL query) and is not trying to mirror the full PostHog REST API or the ~200-tool PostHog MCP server. Most rows below are deliberately `skipped (out of scope)` — see `ROADMAP.md` for the planned MCP-parity milestones (M5–M14) that will close the biggest gaps if/when prioritised.

## Currently shipped CLI commands

From `posthog schema` at HEAD:

| Group | Subcommands |
|---|---|
| `login` | (interactive) |
| `config` | `set`, `show` |
| `flags` | `list`, `get`, `create`, `update`, `enable`, `disable`, `delete`, `dependents` |
| `experiments` | `list`, `get`, `results`, `launch`, `pause`, `end` |
| `insights` | `list`, `get` |
| `dashboards` | `list`, `get` |
| `query` | (HogQL, positional or stdin) |
| `schema` | (introspection) |

Total: 8 top-level groups, 23 leaf commands.

## Capability matrix

Status legend: `full` · `partial` · `read-only` · `planned (Mn)` · `skipped (out of scope)` · `n/a`.

| API / MCP group | CLI coverage | Status | Notes |
|---|---|---|---|
| **Auth / config** (env, login, project select) | `login`, `config set/show` | full | env-var precedence + interactive login. No org/project switching yet (deferred). |
| **Self-description / schema** | `schema`, `--help --json` | full | Workspace-standard agent contract; no MCP equivalent. |
| **Feature flags — read** (list, get, definition) | `flags list/get` | full | |
| **Feature flags — write** (CRUD + enable/disable) | `flags create/update/enable/disable/delete` | full | Mirrors core MCP flag tools. |
| **Feature flags — advanced** (copy, dependents, status, blast-radius, evaluation-reasons, scheduled changes) | `flags dependents` | partial | Shipped: `dependents` (wraps `feature-flags-dependent-flags-retrieve`). Remaining: `copy`, `status`, `blast-radius`, `evaluation-reasons`, `scheduled` CRUD — planned (M5); ROADMAP.md §M5. |
| **Experiments — read & control plane** (list, get, results, launch, pause, end) | `experiments list/get/results/launch/pause/end` | partial | No create/update/delete/archive/reset/resume/ship-variant/duplicate yet. |
| **Experiments — full CRUD** (create, update, delete, archive, reset, resume, ship-variant, duplicate, stats, timeseries) | — | planned (M7) | ~14 MCP tools. |
| **Insights — read** (list, get) | `insights list/get` | read-only | |
| **Insights — write** (create, update, delete, query) | — | planned (M8) | |
| **Dashboards — read** (list, get) | `dashboards list/get` | read-only | |
| **Dashboards — write** (create, update, delete, reorder-tiles, run, add-insight) | — | planned (M8) | |
| **HogQL / query — basic** | `query "<hogql>"` | partial | Raw query only; no `--params`, no NL→HogQL, no saved queries. |
| **HogQL / query — advanced** (NL→HogQL, saved/views, params, format) | — | planned (M6) | Wraps `query-generate-hogql-from-question`, views CRUD. |
| **Query wrappers** (funnel, trends, lifecycle, retention, paths, stickiness) | — | planned (M14) | Thin wrappers over M6 core. |
| **Persons** (list, get, delete, properties, bulk-delete) | — | planned (M9) | |
| **Cohorts** (CRUD, static add/remove persons) | — | planned (M9) | |
| **Surveys** (CRUD, stats, global-stats) | — | planned (M10) | |
| **Error tracking** (issues, merge/split, rules, query) | — | planned (M11) | |
| **Taxonomy** (actions, annotations, event-definitions, property-definitions) | — | planned (M12) | |
| **Session replays** (list, get, delete, playlists) | — | planned (M13) | |
| **LLM analytics & evaluations** (costs, evals CRUD, run/test) | — | skipped (out of scope) | Deferred stretch; ROADMAP §Deferred. |
| **Data warehouse — views & endpoints** | — | skipped (out of scope) | Deferred stretch (~16 tools). |
| **CDP — hog functions, templates, hog flows** | — | skipped (out of scope) | Deferred stretch (~8 tools). |
| **Notebooks** | — | skipped (out of scope) | Deferred stretch (~5 tools). |
| **Alerts & subscriptions** | — | skipped (out of scope) | Deferred stretch (~9 tools). |
| **Roles, org/project switching, integrations, proxies, workflows, conversations, prompts, early-access features, scheduled changes, SDK doctor, debug** | — | skipped (out of scope) | ~30 long-tail MCP tools; ROADMAP §Deferred item 6. |
| **Docs / entity search** (`docs-search`, `entity-search`) | — | skipped (out of scope) | Cheap one-PR add per ROADMAP §Deferred item 7; ship on demand. |
| **Event ingestion** (`/capture`, `/decide`, `/batch`) | — | n/a | Ingestion belongs in PostHog client SDKs, not in this management CLI. |
| **Source maps upload** (REST `/api/projects/:id/error_tracking/symbol_sets/`) | — | skipped (out of scope) ? | Workspace `CLAUDE.md` table marks this CLI as "source maps (WIP, limited scope)" — **inaccurate**: no source-map command ships in v0.2.0 and none is on ROADMAP. Either implement or correct the workspace doc. |

## Workspace contract gaps

These aren't API/MCP-parity rows but contract drift vs the rest of `~/src/clis` — surfaced by the 2026-04-26 published-artifact smoke.

| Gap | Status | Notes |
|---|---|---|
| `posthog version` (subcommand) | missing | Sibling Go CLIs (`exa`, `tavily`, `perplexity`, `craft`) all ship `<bin> version` as a subcommand returning JSON. `posthog` only accepts `--version` (flag) and prints a bare string `0.1.6`. Worth a one-PR add: a `version` subcommand emitting the standard envelope (`{schema_version, provider, command, version}`). |
| Published artifact lag | ongoing | npm `posthog-cli@latest` is v0.1.6 while HEAD `package.json` declares v0.2.0. Either bump-and-publish or align HEAD to the released version; current state means `posthog schema` from a fresh `npm install -g` does not reflect what this PARITY doc describes. |

## Coverage summary

- Groups with **any** CLI coverage (full / partial / read-only): **9** of ~28 listed groups.
- Groups **planned** in ROADMAP M5–M14: **10** (M5 now `partial` — 1 of ~6 sub-tools shipped).
- Groups explicitly **skipped (out of scope)**: **9** (plus `n/a` ingestion).

## Gaps worth considering

Short list of expansions that would deliver the highest agent value per LoC, in rough priority order:

1. **Docs / entity search** — trivial one-PR adds; lets agents resolve names without scraping.
2. **Persons + cohorts read** (`persons get`, `cohorts list/get`) — cheap and frequently needed alongside flags.
3. **Insights & dashboards write** (M8) — current read-only is a notable asymmetry vs flags/experiments.
4. **HogQL `--params` + saved queries** (subset of M6) — unblocks reusable analytics in scripts.
5. **Resolve the source-maps mismatch** — either ship `posthog sourcemaps inject|upload` (the original stated scope) or remove that line from the workspace `CLAUDE.md` table.
6. **Add `posthog version` subcommand + cut a v0.2.0 npm release** — closes the workspace-contract gap and aligns the published artifact with HEAD. Trivial PR.

Everything else (replays, surveys, error tracking, taxonomy, LLM analytics, data warehouse, CDP, notebooks, alerts, long-tail admin) should stay deferred unless a concrete user request appears.
