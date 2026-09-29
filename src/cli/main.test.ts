import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { runCli, USAGE, type Io } from "./main.js";

const GOLDEN = join(import.meta.dirname, "../../test/golden");
const dir = mkdtempSync(join(tmpdir(), "carf-xml-cli-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function io(
  env: Record<string, string | undefined> = {},
): Io & { lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return { lines, errors, env, out: (t) => lines.push(t), err: (t) => errors.push(t) };
}

describe("carf-xml CLI", () => {
  it("prints help", async () => {
    const help = io();
    expect(await runCli(["--help"], help)).toBe(0);
    expect(help.lines).toEqual([USAGE]);
    expect(await runCli([], io())).toBe(2);
  });

  it("rejects unknown commands and options", async () => {
    const unknown = io();
    expect(await runCli(["frobnicate"], unknown)).toBe(2);
    expect(unknown.errors[0]).toBe('Unknown command "frobnicate".');
    expect(await runCli(["explain", "a.xml", "--bogus"], io())).toBe(2);
    expect(await runCli(["explain"], io())).toBe(2);
  });

  it("builds a golden message", async () => {
    const out = join(dir, "out.xml");
    const run = io();
    const code = await runCli(
      [
        "build",
        join(GOLDEN, "new-data", "message.json"),
        "--out",
        out,
        "--number-policy",
        join(GOLDEN, "number-policy.json"),
        "--omit-root-version",
      ],
      run,
    );
    expect(code).toBe(0);
    expect(readFileSync(out).equals(readFileSync(join(GOLDEN, "new-data", "expected.xml")))).toBe(
      true,
    );
    expect(run.lines[0]).toMatch(/bytes, sha256 [0-9a-f]{64}$/);
  });

  it("needs a decision on the version attribute and a policy", async () => {
    const input = join(GOLDEN, "new-data", "message.json");
    const policy = join(GOLDEN, "number-policy.json");
    const out = join(dir, "x.xml");
    expect(await runCli(["build", input, "--out", out, "--number-policy", policy], io())).toBe(2);
    expect(
      await runCli(
        [
          "build",
          input,
          "--out",
          out,
          "--number-policy",
          policy,
          "--root-version",
          "1",
          "--omit-root-version",
        ],
        io(),
      ),
    ).toBe(2);
    expect(await runCli(["build", input, "--out", out], io())).toBe(2);
    expect(
      await runCli(
        ["build", input, "--out", out, "--number-policy", policy, "--root-version", "v"],
        io(),
      ),
    ).toBe(0);
    expect(readFileSync(out, "utf8")).toContain('version="v"');
  });

  it("reports an invalid message (1), an invalid policy (2) and missing files (2)", async () => {
    const badMessage = join(dir, "bad.json");
    writeFileSync(badMessage, JSON.stringify({ messageSpec: {} }));
    const badPolicy = join(dir, "policy.json");
    writeFileSync(badPolicy, JSON.stringify({ roundingMode: "SOMETIMES" }));
    const policy = join(GOLDEN, "number-policy.json");
    const invalid = io();
    expect(
      await runCli(
        [
          "build",
          badMessage,
          "--out",
          join(dir, "y.xml"),
          "--number-policy",
          policy,
          "--omit-root-version",
        ],
        invalid,
      ),
    ).toBe(1);
    expect(invalid.errors[0]).toMatch(/^The CARF message is not valid: messageSpec/);
    const policyRun = io();
    expect(
      await runCli(
        [
          "build",
          badMessage,
          "--out",
          join(dir, "y.xml"),
          "--number-policy",
          badPolicy,
          "--omit-root-version",
        ],
        policyRun,
      ),
    ).toBe(2);
    expect(policyRun.errors[0]).toMatch(/^Invalid number policy: roundingMode/);
    const missing = io();
    expect(await runCli(["explain", join(dir, "missing.xml")], missing)).toBe(2);
    expect(missing.errors[0]).toMatch(/ENOENT/);
    const notJson = join(dir, "not.json");
    writeFileSync(notJson, "{");
    expect(
      await runCli(
        [
          "build",
          notJson,
          "--out",
          join(dir, "z.xml"),
          "--number-policy",
          policy,
          "--omit-root-version",
        ],
        io(),
      ),
    ).toBe(2);
  });

  it("explains a message as text and JSON", async () => {
    const text = io();
    expect(await runCli(["explain", join(GOLDEN, "all-categories", "expected.xml")], text)).toBe(0);
    expect(text.lines[0]).toBe("Message GB2027FRGOLDEN0002 (CARF701)");
    expect(text.lines.join("\n")).toContain("RRPT 1");
    const json = io();
    expect(
      await runCli(["explain", join(GOLDEN, "nil-no-body", "expected.xml"), "--json"], json),
    ).toBe(0);
    expect(JSON.parse(json.lines.join("\n"))).toMatchObject({
      carfBodies: 0,
      messageTypeIndic: "CARF703",
    });
    const empty = join(dir, "empty.xml");
    writeFileSync(empty, "<r/>");
    const bare = io();
    expect(await runCli(["explain", empty], bare)).toBe(0);
    expect(bare.lines[0]).toBe("Message (no MessageRefId) (no MessageTypeIndic)");
  });

  it("reports XML that is not well-formed", async () => {
    const broken = join(dir, "broken.xml");
    writeFileSync(broken, "<a><b></a>");
    const run = io();
    expect(await runCli(["explain", broken], run)).toBe(1);
    expect(run.errors[0]).toMatch(/^Not well-formed XML \(line 1\)/);
  });

  it("validate needs a schema folder and known rules", async () => {
    const file = join(GOLDEN, "new-data", "expected.xml");
    const noDir = io();
    expect(await runCli(["validate", file], noDir)).toBe(2);
    expect(noDir.errors[0]).toBe("Give the schema folder with --schema-dir or CARF_SCHEMA_DIR.");
    const badRule = io();
    expect(
      await runCli(["validate", file, "--schema-dir", dir, "--disable-rule", "V2-999"], badRule),
    ).toBe(2);
    expect(badRule.errors[0]).toBe("Unknown rule(s): V2-999.");
    const noSchemas = io();
    expect(await runCli(["validate", file, "--schema-dir", dir], noSchemas)).toBe(2);
    expect(noSchemas.errors[0]).toMatch(/^Official OECD XSD missing/);
  });
});
