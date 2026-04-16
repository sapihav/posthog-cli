/**
 * Output helpers — stdout is always JSON, stderr is human-readable errors.
 */

import type { Command } from "commander";

export interface OutputOptions {
  pretty?: boolean;
  /** Comma-separated list of fields to project from object/array-of-object outputs. */
  fields?: string;
}

/**
 * Project an object (or array of objects) down to only the listed fields.
 * Non-object values pass through unchanged. Missing fields are silently omitted.
 */
export function projectFields<T>(data: T, fields?: string): T {
  if (!fields) return data;
  const keys = fields
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (keys.length === 0) return data;

  const project = (val: unknown): unknown => {
    if (val === null || typeof val !== "object" || Array.isArray(val)) return val;
    const out: Record<string, unknown> = {};
    const obj = val as Record<string, unknown>;
    for (const k of keys) {
      if (k in obj) out[k] = obj[k];
    }
    return out;
  };

  if (Array.isArray(data)) {
    return (data as unknown[]).map(project) as T;
  }
  return project(data) as T;
}

export function outputJson(data: unknown, options: OutputOptions = {}): void {
  const projected = projectFields(data, options.fields);
  const json = options.pretty
    ? JSON.stringify(projected, null, 2)
    : JSON.stringify(projected);
  process.stdout.write(json + "\n");
}

export function outputError(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

/**
 * Pull the global output options (--pretty, --fields) from the root program.
 * Use this in command actions so callers don't have to know the option names.
 */
export function getOutputOptions(program: Command): OutputOptions {
  const opts = program.opts();
  return {
    pretty: Boolean(opts.pretty),
    fields: typeof opts.fields === "string" ? opts.fields : undefined,
  };
}
