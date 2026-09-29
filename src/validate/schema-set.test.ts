import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { resolveSchemaSet, SchemaSetError } from "./schema-set.js";

const dir = mkdtempSync(join(tmpdir(), "carf-schema-set-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("resolveSchemaSet", () => {
  it("reports missing official files", () => {
    expect(() => resolveSchemaSet(dir, "carf")).toThrow(
      /Official OECD XSD missing: none of CARFXML_v1.5.xsd/,
    );
    expect(() => resolveSchemaSet(dir, "status")).toThrow(SchemaSetError);
  });

  it("refuses files that differ from the official ones", () => {
    writeFileSync(join(dir, "CARFXML_v1.5.xsd"), "<changed/>");
    expect(() => resolveSchemaSet(dir, "carf")).toThrow(
      /CARFXML_v1.5.xsd differs from the official file; isocarftypes_v1.1.xsd is missing; oecdcarftypes_v5.0.xsd is missing/,
    );
  });
});
