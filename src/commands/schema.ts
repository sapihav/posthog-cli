/**
 * `posthog schema` — emit the entire CLI command tree as JSON.
 *
 * Designed for AI agents and tooling that need to discover the CLI surface
 * without scraping --help text. Also powers `--help --json` at every level.
 *
 * Output shapes are colocated here as a static map keyed by command path
 * (e.g. "flags list"). Keep them in sync when adding/changing commands.
 */

import { Command, Option } from "commander";
import { outputJson, outputError, getOutputOptions } from "../output.js";

export interface OptionSchema {
  flags: string;
  description: string;
  /** True if the flag itself must be provided (commander's `mandatory`). */
  mandatory: boolean;
  /** True if the flag takes a required value (commander's `required`, e.g. `--key <val>`). */
  valueRequired: boolean;
  default?: unknown;
}

export interface CommandSchema {
  name: string;
  path: string;
  description: string;
  arguments: { name: string; required: boolean; description?: string }[];
  options: OptionSchema[];
  output?: OutputShape;
  subcommands: CommandSchema[];
}

export interface OutputShape {
  type: "object" | "array" | "scalar" | "void";
  description: string;
  /** Field map for object/array-of-object outputs. Values are TypeScript-style type names. */
  fields?: Record<string, string>;
}

/**
 * Output shape registry, keyed by full command path (e.g. "flags list").
 * Mirrors the TypeScript interfaces in each command file. Update when shapes change.
 */
export const OUTPUT_SHAPES: Record<string, OutputShape> = {
  "config set": {
    type: "object",
    description: "The saved config (apiKey is stored in plaintext on disk).",
    fields: { apiKey: "string", projectId: "string", host: "string" },
  },
  "config show": {
    type: "object",
    description: "The current effective config. apiKey is masked for display.",
    fields: { apiKey: "string", projectId: "string", host: "string" },
  },
  login: {
    type: "object",
    description: "The saved config after interactive login. apiKey is masked.",
    fields: { apiKey: "string", projectId: "string", host: "string" },
  },
  "flags list": {
    type: "array",
    description: "Array of feature flags.",
    fields: {
      id: "number",
      key: "string",
      name: "string",
      active: "boolean",
      rollout_percentage: "number | null",
    },
  },
  "flags get": {
    type: "object",
    description: "A single feature flag.",
    fields: {
      id: "number",
      key: "string",
      name: "string",
      active: "boolean",
      rollout_percentage: "number | null",
    },
  },
  "flags create": {
    type: "object",
    description: "The newly created feature flag.",
    fields: { id: "number", key: "string", name: "string", active: "boolean" },
  },
  "flags update": {
    type: "object",
    description: "The updated feature flag.",
    fields: { id: "number", key: "string", name: "string", active: "boolean" },
  },
  "flags enable": {
    type: "object",
    description: "The updated feature flag with active=true.",
    fields: { id: "number", key: "string", active: "boolean" },
  },
  "flags disable": {
    type: "object",
    description: "The updated feature flag with active=false.",
    fields: { id: "number", key: "string", active: "boolean" },
  },
  "flags delete": {
    type: "object",
    description: "Confirmation of deletion.",
    fields: { deleted: "boolean", key: "string", id: "number" },
  },
  "experiments list": {
    type: "array",
    description: "Array of experiments.",
    fields: {
      id: "number",
      name: "string",
      start_date: "string | null",
      end_date: "string | null",
    },
  },
  "experiments get": {
    type: "object",
    description: "A single experiment.",
    fields: {
      id: "number",
      name: "string",
      start_date: "string | null",
      end_date: "string | null",
    },
  },
  "experiments results": {
    type: "object",
    description: "Raw experiment results payload from the PostHog API.",
  },
  "experiments launch": {
    type: "object",
    description: "The experiment with start_date set to now.",
    fields: { id: "number", start_date: "string" },
  },
  "experiments pause": {
    type: "object",
    description: "The experiment with end_date set to now.",
    fields: { id: "number", end_date: "string" },
  },
  "experiments end": {
    type: "object",
    description: "The experiment with end_date set to now.",
    fields: { id: "number", end_date: "string" },
  },
  "insights list": {
    type: "array",
    description: "Array of insights.",
    fields: { id: "number", name: "string", short_id: "string" },
  },
  "insights get": {
    type: "object",
    description: "A single insight.",
    fields: { id: "number", name: "string", short_id: "string" },
  },
  "dashboards list": {
    type: "array",
    description: "Array of dashboards.",
    fields: { id: "number", name: "string" },
  },
  "dashboards get": {
    type: "object",
    description: "A single dashboard.",
    fields: { id: "number", name: "string" },
  },
  query: {
    type: "object",
    description:
      "Raw HogQL query result from PostHog. Typically { results: any[][], columns: string[], types: string[] }.",
  },
  schema: {
    type: "object",
    description: "The CLI schema itself (this command's output).",
  },
};

function serializeOption(opt: Option): OptionSchema {
  return {
    flags: opt.flags,
    description: opt.description ?? "",
    mandatory: opt.mandatory,
    valueRequired: opt.required,
    default: opt.defaultValue,
  };
}

function pathOf(cmd: Command): string {
  const parts: string[] = [];
  let cur: Command | null = cmd;
  while (cur && cur.parent) {
    parts.unshift(cur.name());
    cur = cur.parent;
  }
  return parts.join(" ");
}

export function serializeCommand(cmd: Command): CommandSchema {
  const path = pathOf(cmd);
  return {
    name: cmd.name(),
    path,
    description: cmd.description() ?? "",
    arguments: cmd.registeredArguments.map((a) => ({
      name: a.name(),
      required: a.required,
      description: a.description || undefined,
    })),
    options: cmd.options.map(serializeOption),
    output: OUTPUT_SHAPES[path],
    subcommands: cmd.commands
      .filter((c) => c.name() !== "help")
      .map(serializeCommand),
  };
}

export interface CliSchema {
  cli: string;
  version: string;
  description: string;
  globalOptions: OptionSchema[];
  commands: CommandSchema[];
}

export function serializeProgram(program: Command): CliSchema {
  return {
    cli: program.name(),
    version: program.version() ?? "",
    description: program.description() ?? "",
    globalOptions: program.options.map(serializeOption),
    commands: program.commands
      .filter((c) => c.name() !== "help")
      .map(serializeCommand),
  };
}

/**
 * Find a subcommand by argv path (e.g. ["flags", "list"] → the `list` subcommand).
 * Returns null if no match.
 */
export function findCommand(program: Command, path: string[]): Command | null {
  let cur: Command = program;
  for (const part of path) {
    const next = cur.commands.find((c) => c.name() === part);
    if (!next) return null;
    cur = next;
  }
  return cur === program ? null : cur;
}

/**
 * Pre-parse argv to detect `--help --json` (in any order, at any depth).
 * If detected, emit the schema for the targeted command and exit.
 * Otherwise, do nothing and let commander parse normally.
 */
export function maybeEmitJsonHelp(program: Command, argv: string[]): void {
  const wantsHelp = argv.includes("--help") || argv.includes("-h");
  const wantsJson = argv.includes("--json");
  if (!(wantsHelp && wantsJson)) return;

  const pretty = argv.includes("--pretty");
  const fieldsIdx = argv.indexOf("--fields");
  const fields = fieldsIdx >= 0 ? argv[fieldsIdx + 1] : undefined;
  // Flags that take a value — derived from program.options so new value-options
  // (--out, --limit, --fields, …) are skipped automatically and the pre-parser
  // doesn't drift from the real command definition.
  const valueFlags = new Set<string>();
  for (const opt of program.options) {
    if (!opt.required && !opt.optional) continue;
    if (opt.long) valueFlags.add(opt.long);
    if (opt.short) valueFlags.add(opt.short);
  }
  // Strip flags (and their values) to find the command path (e.g. ["flags", "list"]).
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("-")) {
      if (valueFlags.has(a)) i++;
      continue;
    }
    positional.push(a);
  }
  const target = positional.length === 0 ? null : findCommand(program, positional);

  try {
    if (!target) {
      outputJson(serializeProgram(program), { pretty, fields });
    } else {
      outputJson(serializeCommand(target), { pretty, fields });
    }
    process.exit(0);
  } catch (e) {
    outputError((e as Error).message);
  }
}

export function registerSchemaCommand(program: Command): void {
  program
    .command("schema")
    .description("Emit the full CLI schema as JSON (commands, options, output shapes)")
    .action(() => {
      try {
        outputJson(serializeProgram(program), getOutputOptions(program));
      } catch (e) {
        outputError(e as Error);
      }
    });
}
