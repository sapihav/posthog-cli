/**
 * Output helpers — stdout is always JSON, stderr is structured JSON errors.
 */

import type { Command } from "commander";
import { PostHogError, type ErrorCode, type ErrorPayload } from "./errors.js";

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

/**
 * Emit a structured JSON error to stderr and exit with code 1.
 *
 * Accepts a string (back-compat — coerced to API_ERROR), an `Error`
 * (PostHogError keeps its code/hint/docs_url; plain Errors fall back to
 * API_ERROR), or a fully-formed `ErrorPayload`.
 *
 * Output shape: `{"error":{"message":"...","code":"...","hint":"?","docs_url":"?"}}`
 */
export function outputError(
  input: string | Error | ErrorPayload,
  fallbackCode: ErrorCode = "API_ERROR"
): never {
  let payload: ErrorPayload;
  if (typeof input === "string") {
    payload = { message: input, code: fallbackCode };
  } else if (input instanceof PostHogError) {
    payload = input.toPayload();
  } else if (input instanceof Error) {
    payload = { message: input.message, code: fallbackCode };
  } else {
    payload = input;
  }

  // Strip undefined keys so the JSON is minimal.
  const clean: Record<string, unknown> = { message: payload.message, code: payload.code };
  if (payload.hint) clean.hint = payload.hint;
  if (payload.docs_url) clean.docs_url = payload.docs_url;

  process.stderr.write(JSON.stringify({ error: clean }) + "\n");
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
