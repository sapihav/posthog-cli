import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { searchDocs } from "../src/commands/docs-search.js";
import { PostHogError } from "../src/errors.js";

function mockResponse(status: number, body?: unknown, raw?: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () =>
      raw !== undefined
        ? (() => {
            throw new Error("not json");
          })()
        : body,
    text: async () =>
      raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : "",
    headers: new Headers(),
  } as Response;
}

describe("searchDocs (Inkeep wrapper)", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts to the Inkeep chat-completions endpoint with the right model + bearer", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";
    globalThis.fetch = async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      capturedUrl = input.toString();
      capturedHeaders = Object.fromEntries(
        Object.entries(init?.headers ?? {})
      );
      capturedBody = (init?.body as string) ?? "";
      return mockResponse(200, {
        choices: [{ message: { content: "Use feature flags via the API." } }],
      });
    };

    const answer = await searchDocs("ink_test_key", "how do flags work?");

    assert.equal(capturedUrl, "https://api.inkeep.com/v1/chat/completions");
    assert.equal(capturedHeaders["Authorization"], "Bearer ink_test_key");
    assert.equal(capturedHeaders["Content-Type"], "application/json");
    const body = JSON.parse(capturedBody);
    assert.equal(body.model, "inkeep-qa-expert");
    assert.equal(body.messages[0].role, "user");
    assert.equal(body.messages[0].content, "how do flags work?");
    assert.equal(answer, "Use feature flags via the API.");
  });

  it("throws AUTH_INVALID on 401", async () => {
    globalThis.fetch = async () =>
      mockResponse(401, { error: "bad key" });

    await assert.rejects(
      () => searchDocs("bad_key", "anything"),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "AUTH_INVALID");
        assert.equal(err.status, 401);
        assert.match(err.hint ?? "", /INKEEP_API_KEY/);
        return true;
      }
    );
  });

  it("throws AUTH_INVALID on 403", async () => {
    globalThis.fetch = async () => mockResponse(403, { error: "forbidden" });
    await assert.rejects(
      () => searchDocs("k", "q"),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "AUTH_INVALID");
        return true;
      }
    );
  });

  it("throws VALIDATION on 4xx other than 401/403", async () => {
    globalThis.fetch = async () =>
      mockResponse(400, { error: "bad query" });
    await assert.rejects(
      () => searchDocs("k", ""),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "VALIDATION");
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  it("throws API_ERROR on 5xx", async () => {
    globalThis.fetch = async () =>
      mockResponse(503, { error: "down" });
    await assert.rejects(
      () => searchDocs("k", "q"),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "API_ERROR");
        assert.equal(err.status, 503);
        return true;
      }
    );
  });

  it("throws API_ERROR on malformed response (missing choices)", async () => {
    globalThis.fetch = async () => mockResponse(200, { something: "else" });
    await assert.rejects(
      () => searchDocs("k", "q"),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "API_ERROR");
        assert.match(err.message, /Unexpected response shape/);
        return true;
      }
    );
  });

  it("throws API_ERROR on malformed response (empty content)", async () => {
    globalThis.fetch = async () =>
      mockResponse(200, { choices: [{ message: { content: "" } }] });
    await assert.rejects(
      () => searchDocs("k", "q"),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "API_ERROR");
        return true;
      }
    );
  });

  it("throws API_ERROR when JSON body fails to parse", async () => {
    globalThis.fetch = async () => mockResponse(200, undefined, "not json");
    await assert.rejects(
      () => searchDocs("k", "q"),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "API_ERROR");
        return true;
      }
    );
  });

  it("emits a verbose request line without leaking the API key", async () => {
    globalThis.fetch = async () =>
      mockResponse(200, {
        choices: [{ message: { content: "ok" } }],
      });
    let captured = "";
    const originalErr = process.stderr.write;
    process.stderr.write = ((chunk: string) => {
      captured += chunk;
      return true;
    }) as typeof process.stderr.write;
    try {
      await searchDocs("ink_secret_dont_leak", "q", true);
    } finally {
      process.stderr.write = originalErr;
    }
    assert.match(captured, /\[posthog\] POST https:\/\/api\.inkeep\.com/);
    assert.ok(!captured.includes("ink_secret_dont_leak"));
  });
});

describe("docs-search command registration", () => {
  it("registers a top-level command with required <query> arg and is wired into the schema", async () => {
    const { Command } = await import("commander");
    const { registerDocsSearchCommand } = await import(
      "../src/commands/docs-search.js"
    );
    const { serializeProgram, OUTPUT_SHAPES } = await import(
      "../src/commands/schema.js"
    );

    const program = new Command();
    program.name("posthog").version("0.0.0-test").option("--pretty");
    registerDocsSearchCommand(program);

    const schema = serializeProgram(program);
    const cmd = schema.commands.find((c) => c.name === "docs-search");
    assert.ok(cmd, "docs-search not registered");
    assert.equal(cmd!.arguments.length, 1);
    assert.equal(cmd!.arguments[0].name, "query");
    assert.equal(cmd!.arguments[0].required, true);

    // Output shape registered for `posthog schema` consumers.
    assert.ok(OUTPUT_SHAPES["docs-search"]);
    assert.equal(OUTPUT_SHAPES["docs-search"].type, "object");
    assert.deepEqual(OUTPUT_SHAPES["docs-search"].fields, {
      query: "string",
      answer: "string",
    });
  });

  it("--dry-run prints the planned Inkeep request and skips network", async () => {
    const { Command } = await import("commander");
    const { registerDocsSearchCommand } = await import(
      "../src/commands/docs-search.js"
    );

    const program = new Command();
    program
      .name("posthog")
      .option("--pretty")
      .option("--dry-run")
      .option("--quiet")
      .option("--verbose")
      .option("--out <file>")
      .option("--fields <list>");
    registerDocsSearchCommand(program);

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error("must not be called");
    };

    let stdout = "";
    const originalOut = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      stdout += chunk;
      return true;
    }) as typeof process.stdout.write;

    try {
      await program.parseAsync(
        ["node", "posthog", "--dry-run", "docs-search", "how do flags work?"],
      );
    } finally {
      process.stdout.write = originalOut;
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalled, false);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.dryRun, true);
    assert.equal(parsed.method, "POST");
    assert.equal(parsed.url, "https://api.inkeep.com/v1/chat/completions");
    assert.equal(parsed.body.model, "inkeep-qa-expert");
    assert.equal(parsed.body.messages[0].content, "how do flags work?");
  });

  it("happy path: emits {query, answer} JSON to stdout", async () => {
    const { Command } = await import("commander");
    const { registerDocsSearchCommand } = await import(
      "../src/commands/docs-search.js"
    );

    const program = new Command();
    program
      .name("posthog")
      .option("--pretty")
      .option("--dry-run")
      .option("--quiet")
      .option("--verbose")
      .option("--out <file>")
      .option("--fields <list>");
    registerDocsSearchCommand(program);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Flags are great." } }],
        }),
        text: async () => "",
        headers: new Headers(),
      }) as Response;

    let stdout = "";
    const originalOut = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      stdout += chunk;
      return true;
    }) as typeof process.stdout.write;

    const previousKey = process.env.INKEEP_API_KEY;
    process.env.INKEEP_API_KEY = "ink_real";

    try {
      await program.parseAsync([
        "node",
        "posthog",
        "docs-search",
        "what are flags?",
      ]);
    } finally {
      process.stdout.write = originalOut;
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.INKEEP_API_KEY;
      else process.env.INKEEP_API_KEY = previousKey;
    }

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.query, "what are flags?");
    assert.equal(parsed.answer, "Flags are great.");
  });

  it("missing INKEEP_API_KEY exits 1 with AUTH_MISSING (no network call)", async () => {
    const { Command } = await import("commander");
    const { registerDocsSearchCommand } = await import(
      "../src/commands/docs-search.js"
    );

    const program = new Command();
    program
      .name("posthog")
      .option("--pretty")
      .option("--dry-run")
      .option("--quiet")
      .option("--verbose")
      .option("--out <file>")
      .option("--fields <list>");
    registerDocsSearchCommand(program);

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error("must not be called");
    };

    let stderr = "";
    const originalErr = process.stderr.write;
    process.stderr.write = ((chunk: string) => {
      stderr += chunk;
      return true;
    }) as typeof process.stderr.write;

    let exitCode: number | undefined;
    const originalExit = process.exit;
    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error("__exit__");
    }) as typeof process.exit;

    const previousKey = process.env.INKEEP_API_KEY;
    delete process.env.INKEEP_API_KEY;

    try {
      await assert.rejects(
        program.parseAsync(["node", "posthog", "docs-search", "q"])
      );
    } finally {
      process.stdout.write = process.stdout.write; // no-op symmetry
      process.stderr.write = originalErr;
      process.exit = originalExit;
      globalThis.fetch = originalFetch;
      if (previousKey !== undefined) process.env.INKEEP_API_KEY = previousKey;
    }

    assert.equal(fetchCalled, false);
    assert.equal(exitCode, 1);
    const parsed = JSON.parse(stderr.trim().split("\n").pop()!);
    assert.equal(parsed.error.code, "AUTH_MISSING");
    assert.match(parsed.error.hint, /INKEEP_API_KEY/);
  });
});
