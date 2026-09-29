// One deliberately invalid message per layer. The expected errors (code, official code, line,
// XPath, record and human message) are committed next to each input.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildCarfXml, parseCarfMessage, validateCarfXml } from "../src/index.js";
import { CARF_SCHEMA_DIR, HAS_SCHEMAS, GOLDEN_POLICY, TEST_DIR } from "./helpers.js";

const INVALID_DIR = join(TEST_DIR, "invalid");

it("the V2 input is built from its message.json", () => {
  const message = parseCarfMessage(
    JSON.parse(readFileSync(join(INVALID_DIR, "v2-business-rules", "message.json"), "utf8")),
  );
  const built = buildCarfXml(message, { numberFormat: GOLDEN_POLICY, rootVersion: null });
  expect(built.xml.equals(readFileSync(join(INVALID_DIR, "v2-business-rules", "input.xml")))).toBe(
    true,
  );
});

describe.skipIf(!HAS_SCHEMAS)("invalid messages", () => {
  it.each(["v1-schema", "v2-business-rules"])("%s produces the expected errors", async (name) => {
    const input = readFileSync(join(INVALID_DIR, name, "input.xml"));
    const expected: unknown = JSON.parse(
      readFileSync(join(INVALID_DIR, name, "expected-errors.json"), "utf8"),
    );
    const report = await validateCarfXml(input, { schemaDir: CARF_SCHEMA_DIR ?? "" });
    expect(report.valid).toBe(false);
    expect(
      report.errors.map(({ layer, code, officialCode, line, xpath, recordRef, humanMessage }) => ({
        layer,
        code,
        ...(officialCode === undefined ? {} : { officialCode }),
        line,
        xpath,
        ...(recordRef === undefined ? {} : { recordRef }),
        humanMessage,
      })),
    ).toEqual(expected);
    for (const error of report.errors) {
      expect(error.fixHint.length).toBeGreaterThan(0);
      if (error.layer === "V2" && error.code !== "V2-006") {
        expect(error.officialCode).toMatch(/^\d{5}$/);
      }
    }
  });
});
