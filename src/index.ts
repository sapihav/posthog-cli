#!/usr/bin/env node

import { Command } from "commander";
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

program
  .name("posthog")
  .description("Unofficial PostHog CLI — manage PostHog projects from the terminal")
  .version("0.1.4")
  .option("--pretty", "Pretty-print JSON output")
  .option("--json", "Emit machine-readable JSON (use with --help to print the schema)")
  .addHelpText(
    "after",
    "\nFor agent/tooling use, run `posthog schema` or append `--help --json` to any command\nfor a machine-readable description of the CLI surface."
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
