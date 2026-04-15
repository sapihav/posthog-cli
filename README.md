# posthog-cli

> **Disclaimer:** This is an unofficial, community-built CLI tool. It is not affiliated with, endorsed by, or supported by [PostHog Inc](https://posthog.com). It interacts with PostHog through their public API. Use at your own risk.

PostHog CLI — manage PostHog projects from the terminal. JSON output by default, designed for scripting and AI agent tooling.

## Install

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
```

## Commands

```
posthog login
posthog config set|show
posthog flags list|get|create|update|enable|disable|delete
posthog experiments list|get|results|launch|pause|end
posthog insights list|get
posthog dashboards list|get
posthog query "<hogql>"
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
- **stderr**: Human-readable errors, exit code 1
- `--pretty`: Indented JSON for humans

## License

MIT
