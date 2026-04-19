import { Command } from "commander";
import { PostHogClient, clientFor, listParamsFor } from "../client.js";
import {
  outputJson,
  outputError,
  getOutputOptions,
  resolveStdinArg,
} from "../output.js";
import { PostHogError } from "../errors.js";

interface Flag {
  id: number;
  key: string;
  name: string;
  active: boolean;
  rollout_percentage: number | null;
  [key: string]: unknown;
}

async function resolveFlag(client: PostHogClient, keyOrId: string): Promise<Flag> {
  // Try numeric ID first
  if (/^\d+$/.test(keyOrId)) {
    return client.get<Flag>("feature_flags/", keyOrId);
  }
  // Search by key
  const flags = await client.list<Flag>("feature_flags/", { search: keyOrId });
  const match = flags.find((f) => f.key === keyOrId);
  if (!match) {
    throw new PostHogError({
      message: `Flag not found: ${keyOrId}`,
      code: "NOT_FOUND",
      hint: "Run `posthog flags list` to see available flags.",
    });
  }
  return match;
}

export function registerFlagsCommand(program: Command): void {
  const cmd = program.command("flags").description("Manage feature flags");
  const out = () => getOutputOptions(program);
  const getClient = () => clientFor(program);

  cmd
    .command("list")
    .description("List feature flags")
    .option("--search <text>", "Filter by name/key")
    .option("--active", "Show only active flags")
    .option("--all", "Fetch all pages")
    .action(async (opts) => {
      try {
        const client = getClient();
        const params: Record<string, string> = { ...listParamsFor(program) };
        if (opts.search) params.search = opts.search;

        const flags = opts.all
          ? await client.listAll<Flag>("feature_flags/", params)
          : await client.list<Flag>("feature_flags/", params);

        const result = opts.active ? flags.filter((f) => f.active) : flags;
        outputJson(result, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("get <key-or-id>")
    .description(
      "Get a feature flag by key or ID (pass `-` to read from stdin)"
    )
    .action(async (keyOrId: string) => {
      try {
        const flag = await resolveFlag(getClient(), resolveStdinArg(keyOrId));
        outputJson(flag, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("create")
    .description("Create a new feature flag")
    .requiredOption("--key <key>", "Flag key")
    .requiredOption("--name <name>", "Flag name")
    .option("--rollout <percentage>", "Rollout percentage (0-100)", "0")
    .action(async (opts) => {
      try {
        const client = getClient();
        const rollout = parseInt(opts.rollout, 10);
        const result = await client.create<Flag>("feature_flags/", {
          key: opts.key,
          name: opts.name,
          filters: {
            groups: [
              {
                rollout_percentage: rollout,
                properties: [],
              },
            ],
          },
          active: rollout > 0,
        });
        outputJson(result, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("update <key-or-id>")
    .description("Update a feature flag (pass `-` to read key-or-id from stdin)")
    .option("--name <name>", "New name")
    .option("--rollout <percentage>", "New rollout percentage")
    .option("--active <bool>", "Set active status")
    .action(async (keyOrId: string, opts) => {
      try {
        const client = getClient();
        const flag = await resolveFlag(client, resolveStdinArg(keyOrId));
        const body: Record<string, unknown> = {};
        if (opts.name) body.name = opts.name;
        if (opts.active !== undefined) body.active = opts.active === "true";
        if (opts.rollout !== undefined) {
          body.filters = {
            groups: [
              {
                rollout_percentage: parseInt(opts.rollout, 10),
                properties: [],
              },
            ],
          };
        }
        const result = await client.update<Flag>("feature_flags/", flag.id, body);
        outputJson(result, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("enable <key-or-id>")
    .description("Enable a feature flag (pass `-` to read from stdin)")
    .action(async (keyOrId: string) => {
      try {
        const client = getClient();
        const flag = await resolveFlag(client, resolveStdinArg(keyOrId));
        const result = await client.update<Flag>("feature_flags/", flag.id, {
          active: true,
        });
        outputJson(result, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("disable <key-or-id>")
    .description("Disable a feature flag (pass `-` to read from stdin)")
    .action(async (keyOrId: string) => {
      try {
        const client = getClient();
        const flag = await resolveFlag(client, resolveStdinArg(keyOrId));
        const result = await client.update<Flag>("feature_flags/", flag.id, {
          active: false,
        });
        outputJson(result, out());
      } catch (e) {
        outputError(e as Error);
      }
    });

  cmd
    .command("delete <key-or-id>")
    .description("Delete a feature flag (pass `-` to read from stdin)")
    .action(async (keyOrId: string) => {
      try {
        const client = getClient();
        const flag = await resolveFlag(client, resolveStdinArg(keyOrId));
        const result = await client.delete("feature_flags/", flag.id);
        // In dry-run, client.delete returns the planned request; pass through.
        // Otherwise it returns void — synthesize a success payload.
        outputJson(
          result ?? { deleted: true, key: flag.key, id: flag.id },
          out()
        );
      } catch (e) {
        outputError(e as Error);
      }
    });
}
