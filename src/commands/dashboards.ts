import { Command } from "commander";
import { clientFor, listParamsFor } from "../client.js";
import {
  outputJson,
  outputError,
  getOutputOptions,
  resolveStdinArg,
} from "../output.js";

interface Dashboard {
  id: number;
  name: string;
  [key: string]: unknown;
}

export function registerDashboardsCommand(program: Command): void {
  const cmd = program.command("dashboards").description("View dashboards");
  const out = () => getOutputOptions(program);
  const getClient = () => clientFor(program);

  cmd
    .command("list")
    .description("List dashboards")
    .option("--all", "Fetch all pages")
    .action(async (opts) => {
      try {
        const client = getClient();
        const params: Record<string, string> = { ...listParamsFor(program) };
        const dashboards = opts.all
          ? await client.listAll<Dashboard>("dashboards/", params, true)
          : await client.list<Dashboard>("dashboards/", params, true);
        outputJson(dashboards, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("get <id>")
    .description("Get dashboard details (pass `-` to read id from stdin)")
    .action(async (id: string) => {
      try {
        const dashboard = await getClient().get<Dashboard>(
          "dashboards/",
          resolveStdinArg(id),
          true
        );
        outputJson(dashboard, out());
      } catch (e) {
        outputError(e as Error);
      }
    });
}
