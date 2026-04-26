/**
 * Tests for `posthog flags dependents <key-or-id>`.
 *
 * Wraps the `feature-flags-dependent-flags-retrieve` MCP tool over
 * `GET /api/projects/:id/feature_flags/:flag_id/dependent_flags/`.
 *
 * Following the project pattern (see client.test.ts / output.test.ts), we
 * unit-test the building blocks the new command relies on: client URL
 * composition, error propagation, and the OUTPUT_SHAPES schema entry. The
 * wiring of those into a commander action is identical to `flags get` and
 * exercised at `npm run dev` smoke time.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { PostHogClient } from "../src/client.js";
import { PostHogError } from "../src/errors.js";
import type { Config } from "../src/config.js";

const TEST_CONFIG: Config = {
  apiKey: "phx_test_key",
  projectId: "12345",
  host: "https://us.posthog.com",
};

function mockResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (body !== undefined ? JSON.stringify(body) : ""),
    headers: new Headers(),
  } as Response;
}

describe("flags dependents — client URL composition", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("hits /api/projects/:id/feature_flags/:flag/dependent_flags/", async () => {
    let captured = "";
    globalThis.fetch = async (input: string | URL | Request) => {
      captured = input.toString();
      return mockResponse(200, []);
    };

    const client = new PostHogClient(TEST_CONFIG);
    // Mirror what the command does: pass `<id>/dependent_flags` to client.get.
    await client.get("feature_flags/", "42/dependent_flags");

    assert.equal(
      captured,
      "https://us.posthog.com/api/projects/12345/feature_flags/42/dependent_flags/"
    );
  });

  it("returns the bare array shape PostHog emits", async () => {
    globalThis.fetch = async () =>
      mockResponse(200, [
        { id: 5, key: "child-a", name: "Child A" },
        { id: 6, key: "child-b", name: "Child B" },
      ]);

    const client = new PostHogClient(TEST_CONFIG);
    const dependents = await client.get<
      { id: number; key: string; name: string }[]
    >("feature_flags/", "42/dependent_flags");

    assert.equal(dependents.length, 2);
    assert.equal(dependents[0].key, "child-a");
    assert.equal(dependents[1].name, "Child B");
  });

  it("returns an empty array when no flags depend on the target", async () => {
    globalThis.fetch = async () => mockResponse(200, []);
    const client = new PostHogClient(TEST_CONFIG);
    const dependents = await client.get<unknown[]>(
      "feature_flags/",
      "42/dependent_flags"
    );
    assert.deepEqual(dependents, []);
  });

  it("propagates NOT_FOUND when the parent flag is missing", async () => {
    globalThis.fetch = async () =>
      mockResponse(404, { detail: "Not found" });
    const client = new PostHogClient(TEST_CONFIG);
    await assert.rejects(
      () => client.get("feature_flags/", "999/dependent_flags"),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "NOT_FOUND");
        return true;
      }
    );
  });

  it("propagates AUTH_INVALID on 401", async () => {
    globalThis.fetch = async () =>
      mockResponse(401, { detail: "Invalid API key" });
    const client = new PostHogClient(TEST_CONFIG);
    await assert.rejects(
      () => client.get("feature_flags/", "42/dependent_flags"),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "AUTH_INVALID");
        return true;
      }
    );
  });
});

describe("flags dependents — schema registration", () => {
  it("OUTPUT_SHAPES registers `flags dependents` as an array shape", async () => {
    const { OUTPUT_SHAPES } = await import("../src/commands/schema.js");
    const shape = OUTPUT_SHAPES["flags dependents"];
    assert.ok(shape, "expected OUTPUT_SHAPES['flags dependents'] to exist");
    assert.equal(shape.type, "array");
    assert.deepEqual(shape.fields, {
      id: "number",
      key: "string",
      name: "string",
    });
    assert.match(shape.description, /depend/i);
  });

  it("the dependents subcommand is registered on `flags`", async () => {
    const { Command } = await import("commander");
    const { registerFlagsCommand } = await import(
      "../src/commands/flags.js"
    );
    const program = new Command();
    program.name("posthog");
    registerFlagsCommand(program);
    const flags = program.commands.find((c) => c.name() === "flags");
    assert.ok(flags, "expected `flags` command group");
    const dependents = flags.commands.find((c) => c.name() === "dependents");
    assert.ok(dependents, "expected `flags dependents` subcommand");
    // Argument is the parent flag's key-or-id, required.
    assert.equal(dependents.registeredArguments.length, 1);
    assert.equal(dependents.registeredArguments[0].name(), "key-or-id");
    assert.equal(dependents.registeredArguments[0].required, true);
    assert.match(dependents.description() ?? "", /depend/i);
  });
});
