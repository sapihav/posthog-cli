# poshog-cli

PostHog CLI (`posthog` binary) — manage PostHog projects from the terminal.
MCPs are not a good fit for AI agent tooling — a CLI is more predictable and composable. See DESIGN.md for full spec.

## Dev commands

```
npm run build   # compile TypeScript → dist/
npm run dev     # run via tsx (no build step)
```

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
