import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { PostHogClient } from "../src/client.js";
import { PostHogError } from "../src/errors.js";
import type { Config } from "../src/config.js";

const TEST_CONFIG: Config = {
  apiKey: "phx_test_key",
  projectId: "12345",
  host: "https://us.posthog.com",
};

// Helper to create a mock Response
function mockResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (body ? JSON.stringify(body) : ""),
    headers: new Headers(),
  } as Response;
}

describe("PostHogClient", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("constructs correct project-scoped URLs", async () => {
    let capturedUrl = "";
    globalThis.fetch = async (input: string | URL | Request) => {
      capturedUrl = input.toString();
      return mockResponse(200, { results: [] });
    };

    const client = new PostHogClient(TEST_CONFIG);
    await client.list("feature_flags/");

    assert.equal(
      capturedUrl,
      "https://us.posthog.com/api/projects/12345/feature_flags/"
    );
  });

  it("constructs correct environment-scoped URLs", async () => {
    let capturedUrl = "";
    globalThis.fetch = async (input: string | URL | Request) => {
      capturedUrl = input.toString();
      return mockResponse(200, { results: [] });
    };

    const client = new PostHogClient(TEST_CONFIG);
    await client.list("insights/", undefined, true);

    assert.equal(
      capturedUrl,
      "https://us.posthog.com/api/environments/12345/insights/"
    );
  });

  it("sends correct auth header", async () => {
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = Object.fromEntries(
        Object.entries(init?.headers ?? {})
      );
      return mockResponse(200, { results: [] });
    };

    const client = new PostHogClient(TEST_CONFIG);
    await client.list("feature_flags/");

    assert.equal(capturedHeaders["Authorization"], "Bearer phx_test_key");
    assert.equal(capturedHeaders["Content-Type"], "application/json");
  });

  it("list returns results array", async () => {
    globalThis.fetch = async () =>
      mockResponse(200, {
        results: [{ id: 1, key: "flag-1" }, { id: 2, key: "flag-2" }],
      });

    const client = new PostHogClient(TEST_CONFIG);
    const items = await client.list<{ id: number; key: string }>("feature_flags/");

    assert.equal(items.length, 2);
    assert.equal(items[0].key, "flag-1");
  });

  it("get fetches single resource by ID", async () => {
    let capturedUrl = "";
    globalThis.fetch = async (input: string | URL | Request) => {
      capturedUrl = input.toString();
      return mockResponse(200, { id: 42, key: "my-flag" });
    };

    const client = new PostHogClient(TEST_CONFIG);
    const item = await client.get<{ id: number; key: string }>("feature_flags/", 42);

    assert.match(capturedUrl, /feature_flags\/42\/$/);
    assert.equal(item.key, "my-flag");
  });

  it("create sends POST with body", async () => {
    let capturedMethod = "";
    let capturedBody = "";
    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      capturedMethod = init?.method ?? "";
      capturedBody = init?.body as string ?? "";
      return mockResponse(201, { id: 1, key: "new-flag" });
    };

    const client = new PostHogClient(TEST_CONFIG);
    await client.create("feature_flags/", { key: "new-flag", name: "New" });

    assert.equal(capturedMethod, "POST");
    const body = JSON.parse(capturedBody);
    assert.equal(body.key, "new-flag");
  });

  it("update sends PATCH", async () => {
    let capturedMethod = "";
    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      capturedMethod = init?.method ?? "";
      return mockResponse(200, { id: 1, active: true });
    };

    const client = new PostHogClient(TEST_CONFIG);
    await client.update("feature_flags/", 1, { active: true });

    assert.equal(capturedMethod, "PATCH");
  });

  it("delete sends DELETE and handles 204", async () => {
    let capturedMethod = "";
    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      capturedMethod = init?.method ?? "";
      return mockResponse(204);
    };

    const client = new PostHogClient(TEST_CONFIG);
    await client.delete("feature_flags/", 1);

    assert.equal(capturedMethod, "DELETE");
  });

  it("throws PostHogError with NOT_FOUND code on 404", async () => {
    globalThis.fetch = async () =>
      mockResponse(404, { detail: "Not found" });

    const client = new PostHogClient(TEST_CONFIG);

    await assert.rejects(
      () => client.get("feature_flags/", 999),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "NOT_FOUND");
        assert.equal(err.status, 404);
        assert.match(err.message, /Not found/);
        return true;
      }
    );
  });

  it("throws PostHogError with AUTH_INVALID code on 401", async () => {
    globalThis.fetch = async () =>
      mockResponse(401, { detail: "Invalid API key" });

    const client = new PostHogClient(TEST_CONFIG);

    await assert.rejects(
      () => client.list("feature_flags/"),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "AUTH_INVALID");
        assert.match(err.hint ?? "", /posthog login/);
        return true;
      }
    );
  });

  it("throws PostHogError with VALIDATION code on 400", async () => {
    globalThis.fetch = async () =>
      mockResponse(400, { detail: "Bad request" });

    const client = new PostHogClient(TEST_CONFIG);

    await assert.rejects(
      () => client.list("feature_flags/"),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "VALIDATION");
        return true;
      }
    );
  });

  it("throws PostHogError with API_ERROR code on 500", async () => {
    globalThis.fetch = async () =>
      mockResponse(500, { detail: "Server boom" });

    const client = new PostHogClient(TEST_CONFIG);

    await assert.rejects(
      () => client.list("feature_flags/"),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "API_ERROR");
        return true;
      }
    );
  });

  it("retries on 429 and succeeds", async () => {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      if (attempts === 1) return mockResponse(429, {});
      return mockResponse(200, { results: [{ id: 1 }] });
    };

    const client = new PostHogClient(TEST_CONFIG);
    const items = await client.list("feature_flags/");

    assert.equal(attempts, 2);
    assert.equal(items.length, 1);
  });

  it("listAll paginates through multiple pages", async () => {
    let callCount = 0;
    globalThis.fetch = async (input: string | URL | Request) => {
      callCount++;
      const url = input.toString();
      if (!url.includes("offset")) {
        return mockResponse(200, {
          results: [{ id: 1 }],
          next: "https://us.posthog.com/api/projects/12345/feature_flags/?offset=100",
        });
      }
      return mockResponse(200, {
        results: [{ id: 2 }],
        next: null,
      });
    };

    const client = new PostHogClient(TEST_CONFIG);
    const items = await client.listAll<{ id: number }>("feature_flags/");

    assert.equal(callCount, 2);
    assert.equal(items.length, 2);
    assert.equal(items[0].id, 1);
    assert.equal(items[1].id, 2);
  });

  it("query sends HogQL POST to environments endpoint", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = input.toString();
      capturedBody = init?.body as string ?? "";
      return mockResponse(200, { columns: ["event"], results: [["pageview"]] });
    };

    const client = new PostHogClient(TEST_CONFIG);
    await client.query("SELECT event FROM events LIMIT 1");

    assert.match(capturedUrl, /environments\/12345\/query/);
    const body = JSON.parse(capturedBody);
    assert.equal(body.query.kind, "HogQLQuery");
    assert.equal(body.query.query, "SELECT event FROM events LIMIT 1");
  });

  it("strips trailing slash from host", async () => {
    let capturedUrl = "";
    globalThis.fetch = async (input: string | URL | Request) => {
      capturedUrl = input.toString();
      return mockResponse(200, { results: [] });
    };

    const client = new PostHogClient({ ...TEST_CONFIG, host: "https://us.posthog.com/" });
    await client.list("feature_flags/");

    assert.ok(!capturedUrl.includes("//api"), "should not have double slash");
  });

  it("appends query params to list URL", async () => {
    let capturedUrl = "";
    globalThis.fetch = async (input: string | URL | Request) => {
      capturedUrl = input.toString();
      return mockResponse(200, { results: [] });
    };

    const client = new PostHogClient(TEST_CONFIG);
    await client.list("feature_flags/", { search: "test", limit: "50" });

    assert.match(capturedUrl, /search=test/);
    assert.match(capturedUrl, /limit=50/);
  });

  it("omits the query string when params is empty", async () => {
    let capturedUrl = "";
    globalThis.fetch = async (input: string | URL | Request) => {
      capturedUrl = input.toString();
      return mockResponse(200, { results: [] });
    };

    const client = new PostHogClient(TEST_CONFIG);
    await client.list("feature_flags/", {});

    assert.ok(
      !capturedUrl.endsWith("?"),
      `expected no dangling '?', got ${capturedUrl}`
    );
    assert.equal(
      capturedUrl,
      "https://us.posthog.com/api/projects/12345/feature_flags/"
    );
  });

  it("emits verbose request line to stderr without leaking the API key", async () => {
    globalThis.fetch = async () => mockResponse(200, { results: [] });
    let captured = "";
    const originalErr = process.stderr.write;
    process.stderr.write = ((chunk: string) => {
      captured += chunk;
      return true;
    }) as typeof process.stderr.write;
    try {
      const client = new PostHogClient(TEST_CONFIG, { verbose: true });
      await client.list("feature_flags/");
    } finally {
      process.stderr.write = originalErr;
    }
    assert.match(captured, /\[posthog\] GET https:\/\/us\.posthog\.com/);
    assert.ok(!captured.includes("phx_test_key"));
  });
});

describe("PostHogClient dryRun", () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalled: boolean;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error("network call should not happen in dry-run");
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("create returns a PlannedRequest and skips fetch", async () => {
    const client = new PostHogClient(TEST_CONFIG, { dryRun: true });
    const result = await client.create("feature_flags/", { key: "x", name: "X" });

    assert.equal(fetchCalled, false);
    assert.deepEqual(result, {
      dryRun: true,
      method: "POST",
      url: "https://us.posthog.com/api/projects/12345/feature_flags/",
      body: { key: "x", name: "X" },
    });
  });

  it("update returns a PlannedRequest and skips fetch", async () => {
    const client = new PostHogClient(TEST_CONFIG, { dryRun: true });
    const result = await client.update("feature_flags/", 42, { active: true });

    assert.equal(fetchCalled, false);
    assert.deepEqual(result, {
      dryRun: true,
      method: "PATCH",
      url: "https://us.posthog.com/api/projects/12345/feature_flags/42/",
      body: { active: true },
    });
  });

  it("delete returns a PlannedRequest and skips fetch", async () => {
    const client = new PostHogClient(TEST_CONFIG, { dryRun: true });
    const result = await client.delete("feature_flags/", 99);

    assert.equal(fetchCalled, false);
    assert.deepEqual(result, {
      dryRun: true,
      method: "DELETE",
      url: "https://us.posthog.com/api/projects/12345/feature_flags/99/",
      body: undefined,
    });
  });

  it("list still fetches in dry-run (read-only)", async () => {
    let listFetchCalled = false;
    globalThis.fetch = async () => {
      listFetchCalled = true;
      return mockResponse(200, { results: [] });
    };

    const client = new PostHogClient(TEST_CONFIG, { dryRun: true });
    await client.list("feature_flags/");

    assert.equal(listFetchCalled, true);
  });
});
