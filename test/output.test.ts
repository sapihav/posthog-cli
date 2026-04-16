import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

describe("outputJson", () => {
  let written: string;
  let originalWrite: typeof process.stdout.write;

  beforeEach(() => {
    written = "";
    originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      written += chunk;
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
  });

  it("writes compact JSON by default", async () => {
    const { outputJson } = await import("../src/output.js");
    outputJson({ key: "value", num: 42 });

    assert.equal(written, '{"key":"value","num":42}\n');
  });

  it("writes pretty JSON when pretty=true", async () => {
    const { outputJson } = await import("../src/output.js");
    outputJson({ key: "value" }, { pretty: true });

    assert.equal(written, '{\n  "key": "value"\n}\n');
  });

  it("handles arrays", async () => {
    const { outputJson } = await import("../src/output.js");
    outputJson([1, 2, 3]);

    assert.equal(written, "[1,2,3]\n");
  });

  it("handles null", async () => {
    const { outputJson } = await import("../src/output.js");
    outputJson(null);

    assert.equal(written, "null\n");
  });

  it("projects fields on a single object", async () => {
    const { outputJson } = await import("../src/output.js");
    outputJson(
      { id: 1, key: "my-flag", name: "My Flag", active: true },
      { fields: "key,active" }
    );

    assert.equal(written, '{"key":"my-flag","active":true}\n');
  });

  it("projects fields on an array of objects", async () => {
    const { outputJson } = await import("../src/output.js");
    outputJson(
      [
        { id: 1, key: "a", active: true, extra: "x" },
        { id: 2, key: "b", active: false, extra: "y" },
      ],
      { fields: "key,active" }
    );

    assert.equal(
      written,
      '[{"key":"a","active":true},{"key":"b","active":false}]\n'
    );
  });

  it("silently omits missing fields", async () => {
    const { outputJson } = await import("../src/output.js");
    outputJson({ id: 1, key: "x" }, { fields: "key,nope" });

    assert.equal(written, '{"key":"x"}\n');
  });

  it("trims whitespace in fields list", async () => {
    const { outputJson } = await import("../src/output.js");
    outputJson({ a: 1, b: 2, c: 3 }, { fields: " a , c " });

    assert.equal(written, '{"a":1,"c":3}\n');
  });

  it("passes scalar values through unchanged when fields set", async () => {
    const { outputJson } = await import("../src/output.js");
    outputJson(42, { fields: "key" });

    assert.equal(written, "42\n");
  });

  it("combines pretty and fields", async () => {
    const { outputJson } = await import("../src/output.js");
    outputJson({ id: 1, key: "x", name: "X" }, { pretty: true, fields: "key" });

    assert.equal(written, '{\n  "key": "x"\n}\n');
  });
});

describe("outputError", () => {
  let stderrChunks: string;
  let originalErr: typeof process.stderr.write;
  let originalExit: typeof process.exit;
  let exitCode: number | undefined;

  beforeEach(() => {
    stderrChunks = "";
    originalErr = process.stderr.write;
    originalExit = process.exit;
    exitCode = undefined;
    process.stderr.write = ((chunk: string) => {
      stderrChunks += chunk;
      return true;
    }) as typeof process.stderr.write;
    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error("__exit__");
    }) as typeof process.exit;
  });

  afterEach(() => {
    process.stderr.write = originalErr;
    process.exit = originalExit;
  });

  it("emits structured JSON for a string with default API_ERROR code", async () => {
    const { outputError } = await import("../src/output.js");
    assert.throws(() => outputError("Something broke"));

    assert.equal(exitCode, 1);
    const parsed = JSON.parse(stderrChunks);
    assert.deepEqual(parsed, {
      error: { message: "Something broke", code: "API_ERROR" },
    });
  });

  it("preserves PostHogError code, hint, and docs_url", async () => {
    const { outputError } = await import("../src/output.js");
    const { PostHogError } = await import("../src/errors.js");

    const err = new PostHogError({
      message: "Nope",
      code: "AUTH_INVALID",
      hint: "Run posthog login",
      docs_url: "https://example.com/docs",
    });
    assert.throws(() => outputError(err));

    const parsed = JSON.parse(stderrChunks);
    assert.deepEqual(parsed, {
      error: {
        message: "Nope",
        code: "AUTH_INVALID",
        hint: "Run posthog login",
        docs_url: "https://example.com/docs",
      },
    });
  });

  it("falls back to API_ERROR for plain Error instances", async () => {
    const { outputError } = await import("../src/output.js");
    assert.throws(() => outputError(new Error("Boom")));

    const parsed = JSON.parse(stderrChunks);
    assert.equal(parsed.error.message, "Boom");
    assert.equal(parsed.error.code, "API_ERROR");
  });

  it("accepts an explicit ErrorPayload", async () => {
    const { outputError } = await import("../src/output.js");
    assert.throws(() =>
      outputError({ message: "Bad input", code: "VALIDATION" })
    );

    const parsed = JSON.parse(stderrChunks);
    assert.deepEqual(parsed, {
      error: { message: "Bad input", code: "VALIDATION" },
    });
  });

  it("omits hint and docs_url when not present", async () => {
    const { outputError } = await import("../src/output.js");
    assert.throws(() =>
      outputError({ message: "x", code: "API_ERROR" })
    );

    const parsed = JSON.parse(stderrChunks);
    assert.equal(parsed.error.hint, undefined);
    assert.equal(parsed.error.docs_url, undefined);
  });
});

describe("projectFields", () => {
  it("returns input unchanged when fields is undefined", async () => {
    const { projectFields } = await import("../src/output.js");
    const obj = { a: 1, b: 2 };
    assert.equal(projectFields(obj, undefined), obj);
  });

  it("returns input unchanged when fields is empty string", async () => {
    const { projectFields } = await import("../src/output.js");
    const obj = { a: 1, b: 2 };
    assert.deepEqual(projectFields(obj, ""), obj);
  });

  it("preserves null values inside objects", async () => {
    const { projectFields } = await import("../src/output.js");
    assert.deepEqual(
      projectFields({ a: null, b: 1 }, "a,b"),
      { a: null, b: 1 }
    );
  });
});
