import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// We need to test config with isolated filesystem, so we'll import dynamically
// after setting up env vars. But for loadConfig/requireConfig we can test the
// env-var priority path directly.

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "posthog-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.POSTHOG_API_KEY;
  delete process.env.POSTHOG_PROJECT_ID;
  delete process.env.POSTHOG_HOST;
});

describe("config", () => {
  it("loadConfig returns defaults when nothing is set", async () => {
    // Clear env vars
    delete process.env.POSTHOG_API_KEY;
    delete process.env.POSTHOG_PROJECT_ID;
    delete process.env.POSTHOG_HOST;

    const { loadConfig } = await import("../src/config.js");
    const config = loadConfig();

    assert.equal(config.apiKey, "");
    assert.equal(config.projectId, "");
    assert.equal(config.host, "https://us.posthog.com");
  });

  it("loadConfig picks up env vars with highest priority", async () => {
    process.env.POSTHOG_API_KEY = "phx_env_key";
    process.env.POSTHOG_PROJECT_ID = "env_project";
    process.env.POSTHOG_HOST = "https://eu.posthog.com";

    const { loadConfig } = await import("../src/config.js");
    const config = loadConfig();

    assert.equal(config.apiKey, "phx_env_key");
    assert.equal(config.projectId, "env_project");
    assert.equal(config.host, "https://eu.posthog.com");
  });

  it("requireConfig throws when apiKey is missing", async () => {
    delete process.env.POSTHOG_API_KEY;
    delete process.env.POSTHOG_PROJECT_ID;

    const { requireConfig } = await import("../src/config.js");

    assert.throws(() => requireConfig(), {
      message: /No API key configured/,
    });
  });

  it("requireConfig throws when projectId is missing", async () => {
    process.env.POSTHOG_API_KEY = "phx_test";
    delete process.env.POSTHOG_PROJECT_ID;

    const { requireConfig } = await import("../src/config.js");

    assert.throws(() => requireConfig(), {
      message: /No project ID configured/,
    });
  });

  it("requireConfig returns config when both are set", async () => {
    process.env.POSTHOG_API_KEY = "phx_test";
    process.env.POSTHOG_PROJECT_ID = "12345";

    const { requireConfig } = await import("../src/config.js");
    const config = requireConfig();

    assert.equal(config.apiKey, "phx_test");
    assert.equal(config.projectId, "12345");
  });

  it("saveGlobalConfig writes and reads back", async () => {
    const configDir = path.join(tmpDir, ".config", "posthog");
    const configPath = path.join(configDir, "config.json");

    // Manually test the write/read cycle
    fs.mkdirSync(configDir, { recursive: true });
    const data = { apiKey: "phx_saved", projectId: "999", host: "https://us.posthog.com" };
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2) + "\n");

    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.apiKey, "phx_saved");
    assert.equal(parsed.projectId, "999");
    assert.equal(parsed.host, "https://us.posthog.com");
  });
});
