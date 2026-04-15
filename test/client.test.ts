import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { PostHogClient } from "../src/client.js";
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

  it("throws on non-ok response", async () => {
    globalThis.fetch = async () =>
      mockResponse(404, { detail: "Not found" });

    const client = new PostHogClient(TEST_CONFIG);

    await assert.rejects(
      () => client.get("feature_flags/", 999),
      { message: /API 404: Not found/ }
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
});
