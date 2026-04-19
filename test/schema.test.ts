import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";

describe("schema serialization", () => {
  function buildProgram(): Command {
    const program = new Command();
    program
      .name("posthog")
      .description("Test CLI")
      .version("0.0.0-test")
      .option("--pretty", "Pretty print")
      .option("--json", "JSON output");

    const flags = program.command("flags").description("Manage feature flags");
    flags
      .command("list")
      .description("List feature flags")
      .option("--search <text>", "Filter by name/key")
      .option("--all", "Fetch all pages")
      .action(() => {});
    flags
      .command("get <key-or-id>")
      .description("Get a feature flag")
      .action(() => {});

    return program;
  }

  it("serializeProgram returns CLI metadata + commands", async () => {
    const { serializeProgram } = await import("../src/commands/schema.js");
    const program = buildProgram();
    const schema = serializeProgram(program);

    assert.equal(schema.cli, "posthog");
    assert.equal(schema.version, "0.0.0-test");
    assert.equal(schema.description, "Test CLI");
    assert.ok(schema.globalOptions.some((o) => o.flags === "--pretty"));
    assert.ok(schema.globalOptions.some((o) => o.flags === "--json"));
    assert.ok(schema.commands.find((c) => c.name === "flags"));
  });

  it("serializeCommand walks subcommands recursively", async () => {
    const { serializeProgram } = await import("../src/commands/schema.js");
    const program = buildProgram();
    const schema = serializeProgram(program);

    const flags = schema.commands.find((c) => c.name === "flags")!;
    assert.equal(flags.subcommands.length, 2);

    const list = flags.subcommands.find((c) => c.name === "list")!;
    assert.equal(list.path, "flags list");
    assert.ok(list.options.some((o) => o.flags === "--search <text>"));
    assert.ok(list.options.some((o) => o.flags === "--all"));

    const get = flags.subcommands.find((c) => c.name === "get")!;
    assert.equal(get.arguments.length, 1);
    assert.equal(get.arguments[0].name, "key-or-id");
    assert.equal(get.arguments[0].required, true);

    // --search <text> takes a required value but is not itself mandatory
    const search = list.options.find((o) => o.flags === "--search <text>")!;
    assert.equal(search.valueRequired, true);
    assert.equal(search.mandatory, false);
    // --all is a boolean flag with no value
    const all = list.options.find((o) => o.flags === "--all")!;
    assert.equal(all.valueRequired, false);
    assert.equal(all.mandatory, false);
  });

  it("findCommand resolves a multi-level path", async () => {
    const { findCommand } = await import("../src/commands/schema.js");
    const program = buildProgram();

    const list = findCommand(program, ["flags", "list"]);
    assert.ok(list);
    assert.equal(list!.name(), "list");

    assert.equal(findCommand(program, ["flags", "missing"]), null);
    assert.equal(findCommand(program, []), null);
  });

  it("maybeEmitJsonHelp skips values for every global value-option (not just --fields)", async () => {
    const { maybeEmitJsonHelp } = await import("../src/commands/schema.js");
    const program = new Command();
    program
      .name("posthog")
      .option("--pretty", "pretty")
      .option("--json", "json")
      .option("--fields <list>", "fields projection")
      .option("--out <file>", "write payload to file")
      .option("--limit <n>", "cap list result count");
    program.command("flags").command("list").action(() => {});

    // Capture stdout + intercept process.exit so the pre-parser doesn't nuke the test runner.
    let captured = "";
    const originalWrite = process.stdout.write;
    const originalExit = process.exit;
    process.stdout.write = ((chunk: string) => {
      captured += chunk;
      return true;
    }) as typeof process.stdout.write;
    process.exit = ((_code?: number) => {
      throw new Error("__exit__");
    }) as typeof process.exit;

    try {
      assert.throws(() =>
        maybeEmitJsonHelp(program, [
          "--limit",
          "50",
          "--out",
          "/tmp/x.json",
          "--help",
          "--json",
          "flags",
          "list",
        ])
      );
    } finally {
      process.stdout.write = originalWrite;
      process.exit = originalExit;
    }

    const parsed = JSON.parse(captured);
    assert.equal(
      parsed.path,
      "flags list",
      `expected scoped schema for 'flags list', got path='${parsed.path}'`
    );
  });

  it("OUTPUT_SHAPES has an entry for every documented command", async () => {
    const { OUTPUT_SHAPES } = await import("../src/commands/schema.js");
    // Spot-check a few critical commands an agent would care about.
    const required = [
      "flags list",
      "flags get",
      "flags create",
      "flags update",
      "flags enable",
      "flags disable",
      "flags delete",
      "experiments list",
      "experiments get",
      "insights list",
      "dashboards list",
      "query",
      "schema",
      "config show",
      "login",
    ];
    for (const path of required) {
      assert.ok(
        OUTPUT_SHAPES[path],
        `Missing OUTPUT_SHAPES entry for "${path}"`
      );
    }
  });
});
