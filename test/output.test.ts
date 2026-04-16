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
