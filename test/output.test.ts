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
    outputJson({ key: "value" }, true);

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
});
