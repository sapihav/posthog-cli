import { Command } from "commander";
import { requireConfig } from "../config.js";
import { PostHogClient } from "../client.js";
import { outputJson, outputError } from "../output.js";

function getClient(): PostHogClient {
  return new PostHogClient(requireConfig());
}

export function registerQueryCommand(program: Command): void {
  program
    .command("query <hogql>")
    .description("Run a HogQL query")
    .action(async (hogql: string) => {
      try {
        const results = await getClient().query(hogql);
        outputJson(results, program.opts().pretty);
      } catch (e) {
        outputError((e as Error).message);
      }
    });
}
