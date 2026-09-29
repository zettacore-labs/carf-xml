// Every element of the official schema (as listed in the generated inventory) can be produced
// from the model: the golden cases and the maximal fixture together emit every element path.
import { describe, expect, it } from "vitest";

import inventory from "../src/generated/inventory.json" with { type: "json" };
import { buildCarfXml, validateCarfXml } from "../src/index.js";
import { allElements, parseXml } from "../src/xml/tree.js";
import {
  CARF_SCHEMA_DIR,
  HAS_SCHEMAS,
  fixtureMessage,
  GOLDEN_CASES,
  GOLDEN_POLICY,
  goldenXml,
} from "./helpers.js";

const carfSet = inventory.sets.find((set) => set.id === "carf-v1.5-2025-07");
const maximal = buildCarfXml(fixtureMessage("maximal"), {
  numberFormat: GOLDEN_POLICY,
  rootVersion: "1.5",
});

function paths(xml: Buffer): Set<string> {
  return new Set(allElements(parseXml(xml)).map((element) => element.path));
}

describe("model reachability", () => {
  const produced = new Set<string>([
    ...paths(maximal.xml),
    ...GOLDEN_CASES.flatMap((name) => [...paths(goldenXml(name))]),
  ]);

  it("the inventory lists the CARF set", () => {
    expect(carfSet?.elementPaths.length).toBeGreaterThan(200);
  });

  it("reaches every mandatory element of the schema", () => {
    const mandatory = (carfSet?.elementPaths ?? []).filter((p) => p.required).map((p) => p.path);
    expect(mandatory.filter((path) => !produced.has(path))).toEqual([]);
  });

  it("reaches every element of the schema, optional ones included", () => {
    const all = (carfSet?.elementPaths ?? []).map((p) => p.path);
    expect(all.filter((path) => !produced.has(path))).toEqual([]);
  });

  it("produces no element the schema does not have", () => {
    const known = new Set((carfSet?.elementPaths ?? []).map((p) => p.path));
    expect([...produced].filter((path) => !known.has(path))).toEqual([]);
  });
});

describe.skipIf(!HAS_SCHEMAS)("maximal fixture", () => {
  it("validates against the official XSD", async () => {
    const report = await validateCarfXml(maximal.xml, { schemaDir: CARF_SCHEMA_DIR ?? "" });
    expect(report.errors.filter((e) => e.layer === "V1")).toEqual([]);
  });
});
