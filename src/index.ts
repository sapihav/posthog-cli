#!/usr/bin/env node

import { Command } from "commander";
import { registerConfigCommand } from "./commands/config.js";
import { registerFlagsCommand } from "./commands/flags.js";
import { registerExperimentsCommand } from "./commands/experiments.js";
import { registerInsightsCommand } from "./commands/insights.js";
import { registerDashboardsCommand } from "./commands/dashboards.js";
import { registerQueryCommand } from "./commands/query.js";

const program = new Command();

program
  .name("posthog")
  .description("PostHog CLI — manage PostHog projects from the terminal")
  .version("0.1.0")
  .option("--pretty", "Pretty-print JSON output");

registerConfigCommand(program);
registerFlagsCommand(program);
registerExperimentsCommand(program);
registerInsightsCommand(program);
registerDashboardsCommand(program);
registerQueryCommand(program);

program.parse();
