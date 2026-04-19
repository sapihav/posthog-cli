import { Command } from "commander";
import { clientFor, listParamsFor } from "../client.js";
import {
  outputJson,
  outputError,
  getOutputOptions,
  resolveStdinArg,
} from "../output.js";

interface Experiment {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  [key: string]: unknown;
}

export function registerExperimentsCommand(program: Command): void {
  const cmd = program.command("experiments").description("Manage experiments");
  const out = () => getOutputOptions(program);
  const getClient = () => clientFor(program);

  cmd
    .command("list")
    .description("List experiments")
    .option("--status <status>", "Filter by status (draft, running, complete)")
    .option("--all", "Fetch all pages")
    .action(async (opts) => {
      try {
        const client = getClient();
        const params: Record<string, string> = { ...listParamsFor(program) };
        if (opts.status) params.status = opts.status;

        const experiments = opts.all
          ? await client.listAll<Experiment>("experiments/", params)
          : await client.list<Experiment>("experiments/", params);
        outputJson(experiments, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("get <id>")
    .description("Get experiment details (pass `-` to read id from stdin)")
    .action(async (id: string) => {
      try {
        const exp = await getClient().get<Experiment>(
          "experiments/",
          resolveStdinArg(id)
        );
        outputJson(exp, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("results <id>")
    .description("Get experiment results (pass `-` to read id from stdin)")
    .action(async (id: string) => {
      try {
        const client = getClient();
        const resolved = resolveStdinArg(id);
        // Results is a sub-resource
        const results = await client.get<unknown>("experiments/", `${resolved}/results`);
        outputJson(results, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("launch <id>")
    .description("Launch a draft experiment (pass `-` to read id from stdin)")
    .action(async (id: string) => {
      try {
        const result = await getClient().update<Experiment>(
          "experiments/",
          resolveStdinArg(id),
          { start_date: new Date().toISOString() }
        );
        outputJson(result, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("pause <id>")
    .description("Pause a running experiment (pass `-` to read id from stdin)")
    .action(async (id: string) => {
      try {
        const result = await getClient().update<Experiment>(
          "experiments/",
          resolveStdinArg(id),
          { end_date: new Date().toISOString() }
        );
        outputJson(result, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("end <id>")
    .description("End an experiment (pass `-` to read id from stdin)")
    .action(async (id: string) => {
      try {
        const result = await getClient().update<Experiment>(
          "experiments/",
          resolveStdinArg(id),
          { end_date: new Date().toISOString() }
        );
        outputJson(result, out());
      } catch (e) {
        outputError(e as Error);
      }
    });
}
