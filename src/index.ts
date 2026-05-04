#!/usr/bin/env node

import { Command } from "commander";
import pkg from "../package.json";
import { registerConfigCommand } from "./commands/config.js";
import { registerFlagsCommand } from "./commands/flags.js";
import { registerExperimentsCommand } from "./commands/experiments.js";
import { registerInsightsCommand } from "./commands/insights.js";
import { registerDashboardsCommand } from "./commands/dashboards.js";
import { registerQueryCommand } from "./commands/query.js";
import { registerLoginCommand } from "./commands/login.js";
import {
  registerSchemaCommand,
  maybeEmitJsonHelp,
} from "./commands/schema.js";

const program = new Command();

// Read version from package.json so the tag-triggered release workflow's
// `npm version --no-git-tag-version` propagates into the binary at build
// time. Previously this was hardcoded to "0.2.0", which shipped stale
// once the workflow stopped committing version bumps to source.
program
  .name("posthog")
  .description(
    "Community-built CLI for PostHog. Not affiliated with or endorsed by PostHog Inc. — manage PostHog projects from the terminal."
  )
  .version(pkg.version)
  .option("--pretty", "Pretty-print JSON output")
  .option("--json", "Emit machine-readable JSON (use with --help to print the schema)")
  .option(
    "--fields <list>",
    "Comma-separated list of fields to keep in object outputs (e.g. --fields key,active)"
  )
  .option(
    "--dry-run",
    "For mutating commands: print the planned API request as JSON and exit without sending it"
  )
  .option("--quiet", "Suppress non-essential stderr progress (errors still emit)")
  .option(
    "--verbose",
    "Log request URLs and progress to stderr (secrets redacted)"
  )
  .option("--out <file>", "Write stdout JSON payload to this file instead of the terminal")
  .option(
    "--limit <n>",
    "Cap result count for list commands (forwarded to the PostHog API)"
  )
  .option(
    "--json-errors",
    "Force structured JSON error output (always on — accepted for workspace CLI compat)"
  )
  .addHelpText(
    "after",
    "\nDisclaimer: posthog-cli is community-built and unofficial. It is not affiliated\nwith or endorsed by PostHog Inc. Interacts with PostHog via the public API.\n\nFor agent/tooling use, run `posthog schema` or append `--help --json` to any command\nfor a machine-readable description of the CLI surface."
  );

registerLoginCommand(program);
registerConfigCommand(program);
registerFlagsCommand(program);
registerExperimentsCommand(program);
registerInsightsCommand(program);
registerDashboardsCommand(program);
registerQueryCommand(program);
registerSchemaCommand(program);

// Intercept `--help --json` before commander runs its own help handler.
maybeEmitJsonHelp(program, process.argv.slice(2));

program.parse();
