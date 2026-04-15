import { Command } from "commander";
import { loadConfig, saveGlobalConfig } from "../config.js";
import { outputJson, outputError } from "../output.js";

export function registerConfigCommand(program: Command): void {
  const cmd = program.command("config").description("Manage CLI configuration");

  cmd
    .command("set")
    .description("Set global config values")
    .option("--api-key <key>", "PostHog personal API key (phx_...)")
    .option("--project-id <id>", "PostHog project ID")
    .option("--host <url>", "PostHog host: us.posthog.com (default) or eu.posthog.com")
    .action((opts) => {
      try {
        if (!opts.apiKey && !opts.projectId && !opts.host) {
          outputError("Provide at least one of --api-key, --project-id, or --host");
        }
        const saved = saveGlobalConfig({
          apiKey: opts.apiKey,
          projectId: opts.projectId,
          host: opts.host,
        });
        outputJson(saved, program.opts().pretty);
      } catch (e) {
        outputError((e as Error).message);
      }
    });

  cmd
    .command("show")
    .description("Show current effective config")
    .action(() => {
      try {
        const config = loadConfig();
        // Mask the API key for display
        const display = {
          ...config,
          apiKey: config.apiKey
            ? config.apiKey.slice(0, 7) + "..." + config.apiKey.slice(-4)
            : "(not set)",
        };
        outputJson(display, program.opts().pretty);
      } catch (e) {
        outputError((e as Error).message);
      }
    });
}
