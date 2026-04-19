/**
 * Output helpers — stdout is always JSON, stderr is structured JSON errors.
 */

import * as fs from "node:fs";
import type { Command } from "commander";
import {
  PostHogError,
  type ErrorCode,
  type ErrorPayload,
} from "./errors.js";

export interface OutputOptions {
  pretty?: boolean;
  /** Comma-separated list of fields to project from object/array-of-object outputs. */
  fields?: string;
  /** Suppress non-essential stderr progress messages (errors still emit). */
  quiet?: boolean;
  /** Emit detailed progress (e.g. request URLs) to stderr. Secrets redacted. */
  verbose?: boolean;
  /** Write stdout JSON payload to this file instead of process.stdout. */
  out?: string;
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
  if (options.out) {
    fs.writeFileSync(options.out, json + "\n");
    return;
  }
  process.stdout.write(json + "\n");
}

/** Human-readable progress line to stderr. Suppressed when --quiet. */
export function log(msg: string, options: OutputOptions = {}): void {
  if (options.quiet) return;
  process.stderr.write(msg + "\n");
}

/** Verbose-only stderr line (request URLs, timing). Skipped unless --verbose. */
export function vlog(msg: string, options: OutputOptions = {}): void {
  if (!options.verbose || options.quiet) return;
  process.stderr.write(msg + "\n");
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
    quiet: Boolean(opts.quiet),
    verbose: Boolean(opts.verbose),
    out: typeof opts.out === "string" ? opts.out : undefined,
  };
}

/**
 * Resolve a CLI argument that may be "-" (read from stdin).
 * Used for key/id/query args so agents can pipe values in.
 * Returns the original value unchanged when it isn't "-".
 *
 * Throws VALIDATION when stdin is a TTY (no pipe to read) or empty,
 * so we fail fast instead of blocking or sending malformed requests.
 */
export function resolveStdinArg(value: string): string {
  if (value !== "-") return value;
  if (process.stdin.isTTY) {
    throw new PostHogError({
      message: "`-` was passed but no data is piped on stdin.",
      code: "VALIDATION",
      hint: 'Pipe the value in, e.g. `echo "my-key" | posthog flags get -`.',
    });
  }
  const data = fs.readFileSync(0, "utf-8").trim();
  if (!data) {
    throw new PostHogError({
      message: "`-` was passed but stdin is empty.",
      code: "VALIDATION",
      hint: "Pipe a non-empty value or pass the argument literally.",
    });
  }
  return data;
}
