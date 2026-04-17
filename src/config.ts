import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { PostHogError } from "./errors.js";

export interface Config {
  apiKey: string;
  projectId: string;
  host: string;
}

const DEFAULT_HOST = "https://us.posthog.com";
const ALLOWED_HOSTS = new Set([
  "https://us.posthog.com",
  "https://eu.posthog.com",
]);
const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".config", "posthog");
export const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, "config.json");
const LOCAL_CONFIG_NAME = ".posthog.json";

function readJsonFile(filePath: string): Partial<Config> {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Resolve config with priority: env vars > local .posthog.json > global config.
 *
 * Security: local .posthog.json can only set projectId. apiKey and host
 * are restricted to env vars and global config to prevent credential
 * theft via malicious repositories.
 */
export function loadConfig(): Config {
  const global = readJsonFile(GLOBAL_CONFIG_PATH);
  const local = readJsonFile(path.join(process.cwd(), LOCAL_CONFIG_NAME));

  const apiKey =
    process.env.POSTHOG_API_KEY || global.apiKey || "";
  const projectId =
    process.env.POSTHOG_PROJECT_ID ||
    local.projectId ||
    global.projectId ||
    "";
  const host =
    process.env.POSTHOG_HOST || global.host || DEFAULT_HOST;

  return { apiKey, projectId, host };
}

export function requireConfig(): Config {
  const config = loadConfig();
  if (!config.apiKey) {
    throw new PostHogError({
      message: "No API key configured.",
      code: "AUTH_MISSING",
      hint: "Run `posthog login` or `posthog config set --api-key <key>`, or set POSTHOG_API_KEY.",
    });
  }
  if (!config.projectId) {
    throw new PostHogError({
      message: "No project ID configured.",
      code: "AUTH_MISSING",
      hint: "Run `posthog login` or `posthog config set --project-id <id>`, or set POSTHOG_PROJECT_ID.",
    });
  }
  return config;
}

export function saveGlobalConfig(partial: Partial<Config>): Config {
  if (partial.host && !ALLOWED_HOSTS.has(partial.host.replace(/\/$/, ""))) {
    throw new PostHogError({
      message: `Invalid host "${partial.host}". Allowed: ${[...ALLOWED_HOSTS].join(", ")}`,
      code: "VALIDATION",
    });
  }
  const existing = readJsonFile(GLOBAL_CONFIG_PATH);
  const merged: Config = {
    apiKey: partial.apiKey || existing.apiKey || "",
    projectId: partial.projectId || existing.projectId || "",
    host: partial.host || existing.host || DEFAULT_HOST,
  };

  fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(merged, null, 2) + "\n");
  return merged;
}
