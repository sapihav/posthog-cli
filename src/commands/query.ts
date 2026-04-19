import { Command } from "commander";
import { clientFor } from "../client.js";
import {
  outputJson,
  outputError,
  getOutputOptions,
  resolveStdinArg,
} from "../output.js";

export function registerQueryCommand(program: Command): void {
  program
    .command("query <hogql>")
    .description("Run a HogQL query (pass `-` to read the query from stdin)")
    .action(async (hogql: string) => {
      try {
        const results = await clientFor(program).query(resolveStdinArg(hogql));
        outputJson(results, getOutputOptions(program));
      } catch (e) {
        outputError(e as Error);
      }
    });
}
