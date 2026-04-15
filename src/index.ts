#!/usr/bin/env node

import { Command } from "commander";
import { registerConfigCommand } from "./commands/config.js";
import { registerFlagsCommand } from "./commands/flags.js";
import { registerExperimentsCommand } from "./commands/experiments.js";
import { registerInsightsCommand } from "./commands/insights.js";
import { registerDashboardsCommand } from "./commands/dashboards.js";
import { registerQueryCommand } from "./commands/query.js";
import { registerLoginCommand } from "./commands/login.js";

const program = new Command();

program
  .name("posthog")
  .description("Unofficial PostHog CLI — manage PostHog projects from the terminal")
  .version("0.1.4")
  .option("--pretty", "Pretty-print JSON output");

registerLoginCommand(program);
registerConfigCommand(program);
registerFlagsCommand(program);
registerExperimentsCommand(program);
registerInsightsCommand(program);
registerDashboardsCommand(program);
registerQueryCommand(program);

program.parse();
