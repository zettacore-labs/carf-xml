// The command line on real files: validate a golden file (exit 0) and an invalid one (exit 1).
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli, type Io } from "../src/cli/main.js";
import { CARF_SCHEMA_DIR, HAS_SCHEMAS, GOLDEN_DIR, TEST_DIR } from "./helpers.js";

function capture(
  env: Record<string, string | undefined> = {},
): Io & { lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return { lines, errors, env, out: (text) => lines.push(text), err: (text) => errors.push(text) };
}

describe.skipIf(!HAS_SCHEMAS)("carf-xml validate", () => {
  it("exits 0 on a golden file", async () => {
    const io = capture({ CARF_SCHEMA_DIR });
    expect(await runCli(["validate", join(GOLDEN_DIR, "new-data", "expected.xml")], io)).toBe(0);
    expect(io.lines[0]).toMatch(/: valid$/);
    expect(io.lines.join("\n")).toContain("V2-026: configuration required");
  });

  it("exits 1 on an invalid file with a readable report", async () => {
    const io = capture({ CARF_SCHEMA_DIR });
    expect(
      await runCli(["validate", join(TEST_DIR, "invalid", "v1-schema", "input.xml")], io),
    ).toBe(1);
    const report = io.lines.join("\n");
    expect(report).toContain("3 error(s)");
    expect(report).toContain(
      "[V1 XSD_MISSING_ELEMENT] line 46: Crypto-asset user record GB2027-GOLDEN-U-0001: address in fixed format is missing city.",
    );
    expect(report).toContain(
      "at /CARF_OECD/CARFBody[1]/CryptoUsers[1]/UserID[1]/Individual[1]/Address[1]/AddressFix[1]",
    );
  });

  it("prints the official code of V2 errors and supports --json", async () => {
    const io = capture({ CARF_SCHEMA_DIR });
    const file = join(TEST_DIR, "invalid", "v2-business-rules", "input.xml");
    expect(await runCli(["validate", file, "--json", "--disable-rule", "V2-010"], io)).toBe(1);
    const report = JSON.parse(io.lines.join("\n")) as {
      errors: { code: string; officialCode?: string }[];
    };
    expect(report.errors.find((e) => e.code === "V2-008")?.officialCode).toBe("60001");
    expect(report.errors.some((e) => e.code === "V2-010")).toBe(false);
  });

  it("checks DocRefIds against a given pattern and the reporting period", async () => {
    const io = capture({ CARF_SCHEMA_DIR });
    const file = join(GOLDEN_DIR, "new-data", "expected.xml");
    const code = await runCli(
      ["validate", file, "--docrefid-pattern", "^XX", "--reporting-period", "2026-12-31"],
      io,
    );
    expect(code).toBe(1);
    const report = io.lines.join("\n");
    expect(report).toContain("V2-026 (80001)");
    expect(report).toContain("V2-005");
  });
});
