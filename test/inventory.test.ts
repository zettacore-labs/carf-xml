// The committed inventory and generated files match what the official XSDs produce, and the
// inventory holds the enumerations the M02 specification names.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildInventory,
  enumsModule,
  inventoryJson,
  schemaSetsModule,
} from "../scripts/inventory/generate.ts";
import inventory from "../src/generated/inventory.json" with { type: "json" };
import * as enums from "../src/generated/enums.js";
import { CARF_SCHEMA_DIR, CARF_STATUS_SCHEMA_DIR, HAS_SCHEMAS } from "./helpers.js";

const GENERATED = resolve(import.meta.dirname, "../src/generated");

describe("generated enumerations", () => {
  it.each([
    [
      "OECDDocTypeIndic",
      ["OECD0", "OECD1", "OECD2", "OECD3", "OECD10", "OECD11", "OECD12", "OECD13"],
    ],
    ["ExchangeType", ["CARF401", "CARF402", "CARF403", "CARF404"]],
    [
      "TransferType",
      [
        "CARF501",
        "CARF502",
        "CARF503",
        "CARF504",
        "CARF505",
        "CARF506",
        "CARF507",
        "CARF508",
        "CARF509",
      ],
    ],
    ["TransferOutType", ["CARF601", "CARF602", "CARF603", "CARF604", "CARF605", "CARF606"]],
    ["Nexus", ["CARF901", "CARF902", "CARF903", "CARF904", "CARF905", "CARF906", "CARF907"]],
    ["AltValuation", ["CARF1001", "CARF1002", "CARF1003", "CARF1004"]],
    ["CarfMessageTypeIndic", ["CARF701", "CARF702", "CARF703"]],
    ["MessageType", ["CARF"]],
    ["INType", ["LEI", "EIN", "BRN", "Other"]],
    ["CsmFileAcceptanceStatus", ["Accepted", "Rejected"]],
  ] as const)("%s", (name, values) => {
    expect(enums[name]).toEqual(values);
  });

  it("has the 13 controlling-person types and the ISO lists", () => {
    expect(enums.CarfCtrlgPersonType).toHaveLength(13);
    expect(enums.CarfCtrlgPersonType[0]).toBe("CARF801");
    expect(enums.CountryCode).toContain("GB");
    expect(enums.CurrCode).toContain("EUR");
    expect(enums.OECDNameType).toHaveLength(8);
    expect(enums.OECDLegalAddressType).toHaveLength(5);
  });

  it("keeps the XSD's own documentation as labels", () => {
    expect(enums.AltValuationLabels.CARF1001).toBe("Book value");
    expect(enums.TransferTypeLabels.CARF509).toMatch(/^Unknown/);
  });
});

describe("inventory", () => {
  it("records both official sets with their file hashes", () => {
    expect(inventory.sets.map((set) => set.id)).toEqual([
      "carf-v1.5-2025-07",
      "carf-status-v1.1-2025-06",
    ]);
    for (const set of inventory.sets) {
      for (const file of set.files) {
        expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });
});

describe.skipIf(!HAS_SCHEMAS)("generated files are up to date", () => {
  it("regenerating from the official XSDs gives the committed files", () => {
    const sets = inventory.sets.map((set, index) => ({
      id: set.id,
      dir: (index === 0 ? CARF_SCHEMA_DIR : CARF_STATUS_SCHEMA_DIR) ?? "",
      rootSchema: set.rootSchema,
      rootElement: set.rootElement,
      enumPrefix: set.enumPrefix,
    }));
    const fresh = buildInventory(sets);
    expect(inventoryJson(fresh)).toBe(readFileSync(join(GENERATED, "inventory.json"), "utf8"));
    expect(enumsModule(fresh)).toBe(readFileSync(join(GENERATED, "enums.ts"), "utf8"));
    expect(schemaSetsModule(fresh)).toBe(readFileSync(join(GENERATED, "schema-sets.ts"), "utf8"));
  });
});
