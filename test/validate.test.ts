// validateCarfXml end to end with xmllint and the official XSD.
import { describe, expect, it } from "vitest";

import { validateCarfXml } from "../src/index.js";
import { CARF_SCHEMA_DIR, goldenXml, HAS_SCHEMAS } from "./helpers.js";

describe.skipIf(!HAS_SCHEMAS)("validateCarfXml", () => {
  const schemaDir = CARF_SCHEMA_DIR ?? "";

  it("reports XML that is not well-formed and skips the business rules", async () => {
    const report = await validateCarfXml(
      '<carf:CARF_OECD xmlns:carf="urn:oecd:ties:carf:v1"><carf:MessageSpec></carf:CARF_OECD>',
      { schemaDir },
    );
    expect(report.valid).toBe(false);
    expect(report.errors[0]?.code).toBe("XML_NOT_WELL_FORMED");
    expect(report.rules).toEqual([]);
  });

  it("reports a file of another format", async () => {
    const report = await validateCarfXml('<?xml version="1.0"?>\n<Other xmlns="urn:example"/>\n', {
      schemaDir,
    });
    expect(report.errors[0]?.code).toBe("XSD_WRONG_ROOT");
  });

  it("accepts a string as well as bytes", async () => {
    const report = await validateCarfXml(goldenXml("nil-no-body").toString("utf8"), { schemaDir });
    expect(report.valid).toBe(true);
  });
});
