import { Command } from "commander";
import { requireConfig } from "../config.js";
import { PostHogClient } from "../client.js";
import { outputJson, outputError, getOutputOptions } from "../output.js";

interface Experiment {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  [key: string]: unknown;
}

function getClient(): PostHogClient {
  return new PostHogClient(requireConfig());
}

export function registerExperimentsCommand(program: Command): void {
  const cmd = program.command("experiments").description("Manage experiments");
  const out = () => getOutputOptions(program);

  cmd
    .command("list")
    .description("List experiments")
    .option("--status <status>", "Filter by status (draft, running, complete)")
    .option("--all", "Fetch all pages")
    .action(async (opts) => {
      try {
        const client = getClient();
        const params: Record<string, string> = {};
        if (opts.status) params.status = opts.status;

        const experiments = opts.all
          ? await client.listAll<Experiment>("experiments/", params)
          : await client.list<Experiment>("experiments/", params);
        outputJson(experiments, out());
      } catch (e) {
        outputError((e as Error).message);
      }
    });

  cmd
    .command("get <id>")
    .description("Get experiment details")
    .action(async (id: string) => {
      try {
        const exp = await getClient().get<Experiment>("experiments/", id);
        outputJson(exp, out());
      } catch (e) {
        outputError((e as Error).message);
      }
    });

  cmd
    .command("results <id>")
    .description("Get experiment results")
    .action(async (id: string) => {
      try {
        const client = getClient();
        // Results is a sub-resource
        const results = await client.get<unknown>("experiments/", `${id}/results`);
        outputJson(results, out());
      } catch (e) {
        outputError((e as Error).message);
      }
    });

  cmd
    .command("launch <id>")
    .description("Launch a draft experiment")
    .action(async (id: string) => {
      try {
        const updated = await getClient().update<Experiment>("experiments/", id, {
          start_date: new Date().toISOString(),
        });
        outputJson(updated, out());
      } catch (e) {
        outputError((e as Error).message);
      }
    });

  cmd
    .command("pause <id>")
    .description("Pause a running experiment")
    .action(async (id: string) => {
      try {
        const updated = await getClient().update<Experiment>("experiments/", id, {
          end_date: new Date().toISOString(),
        });
        outputJson(updated, out());
      } catch (e) {
        outputError((e as Error).message);
      }
    });

  cmd
    .command("end <id>")
    .description("End an experiment")
    .action(async (id: string) => {
      try {
        const updated = await getClient().update<Experiment>("experiments/", id, {
          end_date: new Date().toISOString(),
        });
        outputJson(updated, out());
      } catch (e) {
        outputError((e as Error).message);
      }
    });
}
