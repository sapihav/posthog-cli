import { Command } from "commander";
import { clientFor, listParamsFor } from "../client.js";
import {
  outputJson,
  outputError,
  getOutputOptions,
  resolveStdinArg,
} from "../output.js";

interface Insight {
  id: number;
  name: string;
  short_id: string;
  [key: string]: unknown;
}

export function registerInsightsCommand(program: Command): void {
  const cmd = program.command("insights").description("View insights");
  const out = () => getOutputOptions(program);
  const getClient = () => clientFor(program);

  cmd
    .command("list")
    .description("List insights")
    .option("--search <text>", "Search by name")
    .option("--all", "Fetch all pages")
    .action(async (opts) => {
      try {
        const client = getClient();
        const params: Record<string, string> = { ...listParamsFor(program) };
        if (opts.search) params.search = opts.search;

        const insights = opts.all
          ? await client.listAll<Insight>("insights/", params, true)
          : await client.list<Insight>("insights/", params, true);
        outputJson(insights, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("get <id>")
    .description("Get insight details (pass `-` to read id from stdin)")
    .action(async (id: string) => {
      try {
        const insight = await getClient().get<Insight>(
          "insights/",
          resolveStdinArg(id),
          true
        );
        outputJson(insight, out());
      } catch (e) {
        outputError(e as Error);
      }
    });
}
