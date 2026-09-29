// Golden files (docs: each case has message.json, expected.xml and must validate against the
// official XSD). A difference of one byte fails.
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildCarfXml, checkBusinessRules, validateCarfXml } from "../src/index.js";
import {
  CARF_SCHEMA_DIR,
  HAS_SCHEMAS,
  GOLDEN_CASES,
  GOLDEN_POLICY,
  goldenMessage,
  goldenXml,
} from "./helpers.js";

describe.each(GOLDEN_CASES)("golden case %s", (name) => {
  const built = buildCarfXml(goldenMessage(name), {
    numberFormat: GOLDEN_POLICY,
    rootVersion: null,
  });

  it("builds byte-identical XML", () => {
    expect(built.xml.equals(goldenXml(name))).toBe(true);
  });

  it("reports the SHA-256 of the bytes", () => {
    expect(built.sha256).toBe(createHash("sha256").update(goldenXml(name)).digest("hex"));
  });

  it("passes every V2 business rule", () => {
    expect(checkBusinessRules(built.xml).findings).toEqual([]);
  });
});

describe.skipIf(!HAS_SCHEMAS)("golden cases against the official XSD", () => {
  it.each(GOLDEN_CASES)("%s validates with xmllint", async (name) => {
    const report = await validateCarfXml(goldenXml(name), { schemaDir: CARF_SCHEMA_DIR ?? "" });
    expect(report.errors).toEqual([]);
    expect(report.valid).toBe(true);
    expect(report.schemaSetId).toBe("carf-v1.5-2025-07");
  });
});
