/**
 * Typed CLI errors with codes agents can branch on.
 *
 * Code taxonomy:
 * - AUTH_MISSING   — no API key / project ID configured
 * - AUTH_INVALID   — API key rejected by PostHog (401/403)
 * - NOT_FOUND      — resource does not exist (404)
 * - RATE_LIMITED   — rate limit hit and retries exhausted (429)
 * - VALIDATION     — bad input from the caller (4xx other than the above, or local CLI validation)
 * - API_ERROR      — server-side or network failure (5xx, transport errors, fallback)
 */

export type ErrorCode =
  | "AUTH_MISSING"
  | "AUTH_INVALID"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "VALIDATION"
  | "API_ERROR";

export interface ErrorPayload {
  message: string;
  code: ErrorCode;
  hint?: string;
  docs_url?: string;
}

export class PostHogError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;
  readonly docs_url?: string;
  /** HTTP status code, when the error originated from an API response. */
  readonly status?: number;

  constructor(opts: {
    message: string;
    code: ErrorCode;
    hint?: string;
    docs_url?: string;
    status?: number;
  }) {
    super(opts.message);
    this.name = "PostHogError";
    this.code = opts.code;
    this.hint = opts.hint;
    this.docs_url = opts.docs_url;
    this.status = opts.status;
  }

  toPayload(): ErrorPayload {
    return {
      message: this.message,
      code: this.code,
      hint: this.hint,
      docs_url: this.docs_url,
    };
  }
}

/**
 * Classify an HTTP status into an error code. Used by the API client and
 * also exported so tests / future callers can stay consistent.
 */
export function classifyHttpStatus(status: number): ErrorCode {
  if (status === 401 || status === 403) return "AUTH_INVALID";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 400 && status < 500) return "VALIDATION";
  return "API_ERROR";
}
