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

## Deferred (next rounds, in rough order)

1. **Resource coverage parity with the MCP** — `persons`, `cohorts`, `surveys`, `error tracking`, `annotations`, `actions`, `event definitions`, `session recordings`. Each is small (one resource per PR) and uses the existing generic CRUD client.
2. **Trust signals** — GitHub Actions CI (build + test on Node 20/22), `CHANGELOG.md`, `CONTRIBUTING.md`, issue/PR templates, semver discipline.
3. **Multi-project switching** — `posthog use <project>` and equivalent for orgs.
4. **Discoverability** — community post in `posthog/posthog`, docs PR mentioning the CLI under tooling, npm badges.
5. **Claude Code integration kit** — slash commands, CLAUDE.md snippet, recipes. *Optional, opt-in only.* Revisit after M1–M3 stabilize the agent surface.
6. **Self-telemetry** (opt-in, off by default) — emit anonymous usage events to PostHog itself. Eat your own dogfood; builds the case to PostHog that real people use it.

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
