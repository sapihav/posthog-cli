import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { HOSTS, fetchProjects } from "../src/commands/login.js";

describe("login", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("HOSTS", () => {
    it("maps '1' to US", () => {
      assert.equal(HOSTS["1"], "https://us.posthog.com");
    });

    it("maps '2' to EU", () => {
      assert.equal(HOSTS["2"], "https://eu.posthog.com");
    });

    it("returns undefined for invalid selection", () => {
      assert.equal(HOSTS["3"], undefined);
      assert.equal(HOSTS[""], undefined);
    });
  });

  describe("fetchProjects", () => {
    function mockResponse(status: number, body?: unknown): Response {
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => (body ? JSON.stringify(body) : ""),
        headers: new Headers(),
      } as Response;
    }

    it("fetches orgs then projects", async () => {
      const calls: string[] = [];
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = input.toString();
        calls.push(url);
        if (url.includes("/api/organizations/") && !url.includes("/projects/")) {
          return mockResponse(200, {
            results: [{ id: "org-1", name: "My Org" }],
          });
        }
        if (url.includes("/projects/")) {
          return mockResponse(200, {
            results: [
              { id: 100, name: "Prod" },
              { id: 200, name: "Staging" },
            ],
          });
        }
        return mockResponse(404);
      };

      const projects = await fetchProjects("https://us.posthog.com", "phx_test");

      assert.equal(calls.length, 2);
      assert.match(calls[0], /\/api\/organizations\/$/);
      assert.match(calls[1], /\/api\/organizations\/org-1\/projects\/$/);
      assert.equal(projects.length, 2);
      assert.equal(projects[0].name, "Prod");
      assert.equal(projects[1].name, "Staging");
    });

    it("aggregates projects across multiple orgs", async () => {
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = input.toString();
        if (url.includes("/api/organizations/") && !url.includes("/projects/")) {
          return mockResponse(200, {
            results: [
              { id: "org-1", name: "Org A" },
              { id: "org-2", name: "Org B" },
            ],
          });
        }
        if (url.includes("org-1/projects/")) {
          return mockResponse(200, { results: [{ id: 1, name: "P1" }] });
        }
        if (url.includes("org-2/projects/")) {
          return mockResponse(200, { results: [{ id: 2, name: "P2" }] });
        }
        return mockResponse(404);
      };

      const projects = await fetchProjects("https://us.posthog.com", "phx_test");
      assert.equal(projects.length, 2);
      assert.equal(projects[0].id, 1);
      assert.equal(projects[1].id, 2);
    });

    it("sends auth header", async () => {
      let capturedHeaders: Record<string, string> = {};
      globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
        capturedHeaders = Object.fromEntries(
          Object.entries(init?.headers ?? {})
        );
        return mockResponse(200, { results: [] });
      };

      await fetchProjects("https://us.posthog.com", "phx_my_key");
      assert.equal(capturedHeaders["Authorization"], "Bearer phx_my_key");
    });

    it("falls back to /api/projects/ when orgs returns 403", async () => {
      const calls: string[] = [];
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = input.toString();
        calls.push(url);
        if (url.endsWith("/api/organizations/")) {
          return mockResponse(403, { detail: "permission_denied" });
        }
        if (url.endsWith("/api/projects/")) {
          return mockResponse(200, {
            results: [{ id: 42, name: "Scoped Project" }],
          });
        }
        return mockResponse(404);
      };

      const projects = await fetchProjects("https://us.posthog.com", "phx_scoped");
      assert.equal(projects.length, 1);
      assert.equal(projects[0].name, "Scoped Project");
      assert.equal(calls.length, 2);
      assert.match(calls[1], /\/api\/projects\/$/);
    });

    it("throws when both org and project endpoints fail", async () => {
      globalThis.fetch = async () =>
        mockResponse(401, { detail: "Invalid token" });

      await assert.rejects(
        () => fetchProjects("https://us.posthog.com", "phx_bad"),
        { message: /Failed to fetch projects \(401\)/ }
      );
    });

    it("throws on project fetch failure", async () => {
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = input.toString();
        if (url.includes("/api/organizations/") && !url.includes("/projects/")) {
          return mockResponse(200, {
            results: [{ id: "org-1", name: "My Org" }],
          });
        }
        return mockResponse(500, { detail: "Server error" });
      };

      await assert.rejects(
        () => fetchProjects("https://us.posthog.com", "phx_test"),
        { message: /Failed to fetch projects for org "My Org" \(500\)/ }
      );
    });

    it("returns empty array when org has no projects", async () => {
      globalThis.fetch = async (input: string | URL | Request) => {
        const url = input.toString();
        if (url.includes("/api/organizations/") && !url.includes("/projects/")) {
          return mockResponse(200, {
            results: [{ id: "org-1", name: "Empty Org" }],
          });
        }
        return mockResponse(200, { results: [] });
      };

      const projects = await fetchProjects("https://us.posthog.com", "phx_test");
      assert.equal(projects.length, 0);
    });
  });
});
