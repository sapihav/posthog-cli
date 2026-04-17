# posthog-cli

PostHog CLI (`posthog` binary) — manage PostHog projects from the terminal.
MCPs are not a good fit for AI agent tooling — a CLI is more predictable and composable.

## Sources of truth

- `DESIGN.md` — full spec: stack, commands, API client contract, auth.
- `ROADMAP.md` — current milestone status and what ships next. **Read this before starting new work.**
- `OUTPUT.md` — per-command JSON output shapes (mirror of `OUTPUT_SHAPES` in `src/commands/schema.ts`).

## Dev commands

```
npm run build   # compile TypeScript → dist/
npm run dev     # run via tsx (no build step)
npm test        # tsx --test test/*.test.ts
```

Runtime introspection: `npm run dev -- schema` returns the full command tree as JSON. Prefer this over re-reading source when answering "what does command X return?".

## Auth

`POSTHOG_API_KEY` and `POSTHOG_PROJECT_ID` env vars, or run `posthog config set`.
API key format: `phx_...` — personal API keys only (not project tokens).

## Architecture

```
src/
  index.ts        entry point, commander setup
  client.ts       API client — all HTTP calls go here
  config.ts       config read/write (~/.config/posthog/config.json)
  output.ts       stdout/stderr helpers
  commands/       one file per subcommand group
```

## Output contract

- **stdout**: always valid JSON
- **stderr**: human-readable errors + exit 1
- `--pretty`: indented JSON for humans

## Conventions

- **Commits**: conventional prefixes — `feat:`, `fix:`, `chore:` (match existing `git log`).
- **One milestone = one PR**, ≤500 LoC app code. Refuse to batch milestones; push back once, comply only if user insists.
- **When changing a command's JSON output**, update **both** `OUTPUT_SHAPES` in `src/commands/schema.ts` AND `OUTPUT.md`. They must not drift.
- **Dogfood the CLI**: for ad-hoc verification during dev, prefer `npm run dev -- <cmd>` over the PostHog MCP — this CLI is the agent-facing surface we're building.

## When to delegate to subagents

Selective, not default. The codebase is small enough to fit in main context; subagent output comes back as summaries and loses fidelity.

- **`Explore`** — open-ended "where/how" searches across the repo. Protects main context on wide investigation.
- **`code-reviewer`** — **mandatory before opening a PR for a milestone.** Independent eyes catch scope creep; aligns with the ≤500 LoC rule.
- **`senior-backend-engineer`** — multi-file milestones touching ≥3 files (e.g., adding a new resource: client + command + schema + OUTPUT.md + tests).
- **Skip subagents for**: typo fixes, one-line changes, renames, trivial test tweaks, single-file edits — main agent is faster and the diff is ground truth.
