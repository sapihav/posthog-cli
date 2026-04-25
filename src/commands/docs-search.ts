/**
 * `posthog docs-search "<query>"` — search PostHog documentation.
 *
 * Wraps the same Inkeep-backed endpoint that the upstream PostHog MCP
 * `docs-search` tool uses (https://github.com/PostHog/mcp,
 * `typescript/src/inkeepApi.ts`): a POST to
 * `https://api.inkeep.com/v1/chat/completions` with model `inkeep-qa-expert`,
 * returning a single consolidated answer string.
 *
 * Auth model deliberately diverges from the rest of the CLI:
 *   - This endpoint is NOT part of the PostHog REST API. It is hosted by
 *     Inkeep (PostHog's docs-search provider) and requires a separate
 *     `INKEEP_API_KEY` env var, exactly as the upstream MCP does.
 *   - `POSTHOG_API_KEY` / `posthog login` is intentionally not used here —
 *     it would be sent to a third party that wouldn't accept it anyway.
 *
 * Output: a JSON object `{ query, answer }`. No `--limit` flag — the
 * underlying Inkeep API returns one consolidated answer, not a paginated
 * result list, so a limit knob would be a no-op.
 */

import { Command } from "commander";
import {
  outputJson,
  outputError,
  getOutputOptions,
  resolveStdinArg,
} from "../output.js";
import { PostHogError } from "../errors.js";

const INKEEP_URL = "https://api.inkeep.com/v1/chat/completions";
const INKEEP_MODEL = "inkeep-qa-expert";

export interface DocsSearchResult {
  query: string;
  answer: string;
}

interface InkeepResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface PlannedDocsRequest {
  dryRun: true;
  method: "POST";
  url: string;
  body: { model: string; messages: { role: string; content: string }[] };
}

/**
 * Perform the Inkeep docs-search call. Exported for direct unit tests.
 * Throws PostHogError on auth/transport/shape failures so the standard
 * error formatter can render them.
 */
export async function searchDocs(
  apiKey: string,
  query: string,
  verbose = false
): Promise<string> {
  if (verbose) {
    process.stderr.write(`[posthog] POST ${INKEEP_URL}\n`);
  }
  const res = await fetch(INKEEP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: INKEEP_MODEL,
      messages: [{ role: "user", content: query }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new PostHogError({
        message: `Inkeep rejected the API key (HTTP ${res.status}).`,
        code: "AUTH_INVALID",
        status: res.status,
        hint: "Set INKEEP_API_KEY to a valid Inkeep API key. This is separate from POSTHOG_API_KEY.",
      });
    }
    if (res.status >= 500) {
      throw new PostHogError({
        message: `Inkeep API error (HTTP ${res.status}): ${text || "no body"}`,
        code: "API_ERROR",
        status: res.status,
      });
    }
    throw new PostHogError({
      message: `Inkeep request failed (HTTP ${res.status}): ${text || "no body"}`,
      code: "VALIDATION",
      status: res.status,
    });
  }

  const data = (await res.json().catch(() => null)) as InkeepResponse | null;
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new PostHogError({
      message: "Unexpected response shape from Inkeep API (missing choices[0].message.content).",
      code: "API_ERROR",
    });
  }
  return content;
}

export function registerDocsSearchCommand(program: Command): void {
  program
    .command("docs-search <query>")
    .description(
      "Search PostHog documentation (pass `-` to read the query from stdin). Requires INKEEP_API_KEY env var; this is separate from POSTHOG_API_KEY because the underlying endpoint is hosted by Inkeep, not PostHog."
    )
    .action(async (rawQuery: string) => {
      try {
        const query = resolveStdinArg(rawQuery);
        const opts = program.opts();
        const verbose = Boolean(opts.verbose) && !opts.quiet;
        const dryRun = Boolean(opts.dryRun);

        if (dryRun) {
          const planned: PlannedDocsRequest = {
            dryRun: true,
            method: "POST",
            url: INKEEP_URL,
            body: {
              model: INKEEP_MODEL,
              messages: [{ role: "user", content: query }],
            },
          };
          outputJson(planned, getOutputOptions(program));
          return;
        }

        const apiKey = process.env.INKEEP_API_KEY || "";
        if (!apiKey) {
          throw new PostHogError({
            message: "No Inkeep API key configured for docs-search.",
            code: "AUTH_MISSING",
            hint: "Set INKEEP_API_KEY. This is separate from POSTHOG_API_KEY: docs-search is hosted by Inkeep, not PostHog. See https://github.com/PostHog/mcp for the upstream tool this wraps.",
          });
        }

        const answer = await searchDocs(apiKey, query, verbose);
        const result: DocsSearchResult = { query, answer };
        outputJson(result, getOutputOptions(program));
      } catch (e) {
        outputError(e as Error);
      }
    });
}
