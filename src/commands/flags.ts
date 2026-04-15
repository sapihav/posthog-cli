import { Command } from "commander";
import { requireConfig } from "../config.js";
import { PostHogClient } from "../client.js";
import { outputJson, outputError } from "../output.js";

interface Flag {
  id: number;
  key: string;
  name: string;
  active: boolean;
  rollout_percentage: number | null;
  [key: string]: unknown;
}

function getClient(): PostHogClient {
  return new PostHogClient(requireConfig());
}

async function resolveFlag(client: PostHogClient, keyOrId: string): Promise<Flag> {
  // Try numeric ID first
  if (/^\d+$/.test(keyOrId)) {
    return client.get<Flag>("feature_flags/", keyOrId);
  }
  // Search by key
  const flags = await client.list<Flag>("feature_flags/", { search: keyOrId });
  const match = flags.find((f) => f.key === keyOrId);
  if (!match) throw new Error(`Flag not found: ${keyOrId}`);
  return match;
}

export function registerFlagsCommand(program: Command): void {
  const cmd = program.command("flags").description("Manage feature flags");
  const pretty = () => program.opts().pretty;

  cmd
    .command("list")
    .description("List feature flags")
    .option("--search <text>", "Filter by name/key")
    .option("--active", "Show only active flags")
    .option("--all", "Fetch all pages")
    .action(async (opts) => {
      try {
        const client = getClient();
        const params: Record<string, string> = {};
        if (opts.search) params.search = opts.search;

        const flags = opts.all
          ? await client.listAll<Flag>("feature_flags/", params)
          : await client.list<Flag>("feature_flags/", params);

        const result = opts.active ? flags.filter((f) => f.active) : flags;
        outputJson(result, pretty());
      } catch (e) {
        outputError((e as Error).message);
      }
    });

  cmd
    .command("get <key-or-id>")
    .description("Get a feature flag by key or ID")
    .action(async (keyOrId: string) => {
      try {
        const flag = await resolveFlag(getClient(), keyOrId);
        outputJson(flag, pretty());
      } catch (e) {
        outputError((e as Error).message);
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
        const flag = await client.create<Flag>("feature_flags/", {
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
        outputJson(flag, pretty());
      } catch (e) {
        outputError((e as Error).message);
      }
    });

  cmd
    .command("update <key-or-id>")
    .description("Update a feature flag")
    .option("--name <name>", "New name")
    .option("--rollout <percentage>", "New rollout percentage")
    .option("--active <bool>", "Set active status")
    .action(async (keyOrId: string, opts) => {
      try {
        const client = getClient();
        const flag = await resolveFlag(client, keyOrId);
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
        const updated = await client.update<Flag>("feature_flags/", flag.id, body);
        outputJson(updated, pretty());
      } catch (e) {
        outputError((e as Error).message);
      }
    });

  cmd
    .command("enable <key-or-id>")
    .description("Enable a feature flag")
    .action(async (keyOrId: string) => {
      try {
        const client = getClient();
        const flag = await resolveFlag(client, keyOrId);
        const updated = await client.update<Flag>("feature_flags/", flag.id, {
          active: true,
        });
        outputJson(updated, pretty());
      } catch (e) {
        outputError((e as Error).message);
      }
    });

  cmd
    .command("disable <key-or-id>")
    .description("Disable a feature flag")
    .action(async (keyOrId: string) => {
      try {
        const client = getClient();
        const flag = await resolveFlag(client, keyOrId);
        const updated = await client.update<Flag>("feature_flags/", flag.id, {
          active: false,
        });
        outputJson(updated, pretty());
      } catch (e) {
        outputError((e as Error).message);
      }
    });

  cmd
    .command("delete <key-or-id>")
    .description("Delete a feature flag")
    .action(async (keyOrId: string) => {
      try {
        const client = getClient();
        const flag = await resolveFlag(client, keyOrId);
        await client.delete("feature_flags/", flag.id);
        outputJson({ deleted: true, key: flag.key, id: flag.id }, pretty());
      } catch (e) {
        outputError((e as Error).message);
      }
    });
}
