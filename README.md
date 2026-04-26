# posthog-cli

> **Disclaimer:** This is an unofficial, community-built CLI tool. It is not affiliated with, endorsed by, or supported by [PostHog Inc](https://posthog.com). It interacts with PostHog through their public API. Use at your own risk.

PostHog CLI — manage PostHog projects from the terminal. JSON output by default, designed for scripting and AI agent tooling.

## Parity

`██████░░░░░░░░░░░░░░` **30%** — auth, schema, flags (full), experiments/insights/dashboards (read + control), HogQL basic shipped. Persons, cohorts, surveys, error-tracking, taxonomy, replays, and write-side of insights/dashboards remain (M5–M14). See [PARITY.md](PARITY.md). No third-party tool dependencies.

## Install

**One-line install (recommended)** — no Node.js required:

```bash
curl -sSL https://raw.githubusercontent.com/sapihav/posthog-cli/main/install.sh | bash
```

Downloads the latest standalone binary for your OS/arch (built with Bun), verifies SHA-256, installs `posthog` to `/usr/local/bin`. Override with `INSTALL_DIR=$HOME/.local/bin`. Requires `curl` + `jq`. Supports macOS + Linux (x86_64 / arm64).

**Via npm** (requires Node.js 18+):

```bash
npm install -g posthog-cli
```

## Setup

```bash
posthog login
```

This will walk you through region selection, open your browser to create an API key, and let you pick a project.

Alternatively, use environment variables:

```bash
export POSTHOG_API_KEY=phx_...
export POSTHOG_PROJECT_ID=12345
export POSTHOG_HOST=https://us.posthog.com   # or https://eu.posthog.com (optional, defaults to US)
```

Precedence: env vars → local `.posthog.json` (`projectId` only) → global `~/.config/posthog/config.json`.

Set `POSTHOG_CONFIG=env-only` to ignore both config files and rely purely on env vars (useful for CI sandboxes).

## Commands

```
posthog login
posthog config set|show
posthog flags list|get|create|update|enable|disable|delete|dependents
posthog experiments list|get|results|launch|pause|end
posthog insights list|get
posthog dashboards list|get
posthog query "<hogql>"
posthog schema
```

## Examples

```bash
# List active feature flags
posthog flags list --active --pretty

# Create and enable a flag
posthog flags create --key new-feature --name "New Feature" --rollout 50
posthog flags enable new-feature

# Run a HogQL query
posthog query "SELECT event, count() FROM events GROUP BY event LIMIT 10" --pretty

# Pipe JSON to jq
posthog flags list | jq '.[].key'
```

## Output

- **stdout**: Always valid JSON (for piping/scripting)
- **stderr**: Human-readable errors (structured: `{"error":{"message","code","hint?","docs_url?"}}`), exit code 1
- `--pretty`: Indented JSON for humans

## For agents and tooling

```bash
posthog schema                          # full command tree as JSON
posthog flags list --help --json        # per-command schema (works at every level)
posthog flags list --fields key,active  # trim output to specific fields
posthog flags list --limit 5            # cap list results (forwarded to PostHog API)
posthog flags create --key x --name X --rollout 10 --dry-run   # preview the API request, no network call
echo "my-flag" | posthog flags get -    # pipe a key/id/query via `-`
posthog schema --out schema.json        # write JSON payload to file instead of stdout
posthog flags list --verbose            # log request URLs to stderr (secrets redacted)
posthog flags list --quiet              # suppress progress messages on stderr
```

Error codes: `AUTH_MISSING`, `AUTH_INVALID`, `NOT_FOUND`, `RATE_LIMITED`, `API_ERROR`, `VALIDATION`.

See [`OUTPUT.md`](OUTPUT.md) for per-command JSON shapes.

## Postinstall banner

On install, this package prints a short unofficial-disclaimer banner to stderr. Opt out with `POSTHOG_CLI_NO_BANNER=1` or `npm install --ignore-scripts`.

## License

MIT
