import { Command } from "commander";
import { requireConfig } from "../config.js";
import { PostHogClient } from "../client.js";
import { outputJson, outputError, getOutputOptions } from "../output.js";

interface Dashboard {
  id: number;
  name: string;
  [key: string]: unknown;
}

function getClient(): PostHogClient {
  return new PostHogClient(requireConfig());
}

export function registerDashboardsCommand(program: Command): void {
  const cmd = program.command("dashboards").description("View dashboards");
  const out = () => getOutputOptions(program);

  cmd
    .command("list")
    .description("List dashboards")
    .option("--all", "Fetch all pages")
    .action(async (opts) => {
      try {
        const client = getClient();
        const dashboards = opts.all
          ? await client.listAll<Dashboard>("dashboards/", undefined, true)
          : await client.list<Dashboard>("dashboards/", undefined, true);
        outputJson(dashboards, out());
      } catch (e) {
        outputError((e as Error).message);
      }
    });

  cmd
    .command("get <id>")
    .description("Get dashboard details")
    .action(async (id: string) => {
      try {
        const dashboard = await getClient().get<Dashboard>("dashboards/", id, true);
        outputJson(dashboard, out());
      } catch (e) {
        outputError((e as Error).message);
      }
    });
}
