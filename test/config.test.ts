import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let tmpDir: string;
const globalConfigPath = path.join(os.homedir(), ".config", "posthog", "config.json");
const globalConfigBackup = globalConfigPath + ".test-backup";

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "posthog-test-"));
  // Temporarily hide real config so tests run in isolation
  if (fs.existsSync(globalConfigPath)) {
    fs.renameSync(globalConfigPath, globalConfigBackup);
  }
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  // Restore real config
  if (fs.existsSync(globalConfigBackup)) {
    fs.renameSync(globalConfigBackup, globalConfigPath);
  }
  delete process.env.POSTHOG_API_KEY;
  delete process.env.POSTHOG_PROJECT_ID;
  delete process.env.POSTHOG_HOST;
});

describe("config", () => {
  it("loadConfig returns defaults when nothing is set", async () => {
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

  it("requireConfig throws AUTH_MISSING when apiKey is missing", async () => {
    delete process.env.POSTHOG_API_KEY;
    delete process.env.POSTHOG_PROJECT_ID;

    const { requireConfig } = await import("../src/config.js");
    const { PostHogError } = await import("../src/errors.js");

    assert.throws(
      () => requireConfig(),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "AUTH_MISSING");
        assert.match(err.message, /No API key configured/);
        assert.match(err.hint ?? "", /posthog login/);
        return true;
      }
    );
  });

  it("requireConfig throws AUTH_MISSING when projectId is missing", async () => {
    process.env.POSTHOG_API_KEY = "phx_test";
    delete process.env.POSTHOG_PROJECT_ID;

    const { requireConfig } = await import("../src/config.js");
    const { PostHogError } = await import("../src/errors.js");

    assert.throws(
      () => requireConfig(),
      (err: unknown) => {
        assert.ok(err instanceof PostHogError);
        assert.equal(err.code, "AUTH_MISSING");
        assert.match(err.message, /No project ID configured/);
        return true;
      }
    );
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
