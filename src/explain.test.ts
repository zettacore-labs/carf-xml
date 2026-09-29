import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { explainCarfXml } from "./explain.js";

const golden = (name: string): Buffer =>
  readFileSync(join(import.meta.dirname, "../test/golden", name, "expected.xml"));

describe("explainCarfXml", () => {
  it("summarises a message", () => {
    expect(explainCarfXml(golden("new-data"))).toEqual({
      messageRefId: "GB2027FRGOLDEN0001",
      messageTypeIndic: "CARF701",
      transmittingCountry: "GB",
      receivingCountry: "FR",
      reportingPeriod: "2027-12-31",
      carfBodies: 1,
      rcaspRecords: 1,
      docTypeIndics: { OECD1: 3 },
      cryptoUsers: { individual: 1, entity: 1 },
      controllingPersons: 1,
      cryptoAssets: 2,
      categories: {
        CryptoToCryptoIn: 1,
        CryptoToCryptoOut: 0,
        CryptoFiatIn: 1,
        CryptoFiatOut: 1,
        CryptoTransferIn: 0,
        CryptoTransferOut: 0,
        TransferWallet: 0,
        RRPT: 0,
      },
    });
  });

  it("counts corrections and every category", () => {
    expect(explainCarfXml(golden("correction").toString("utf8")).docTypeIndics).toEqual({
      OECD0: 1,
      OECD2: 1,
    });
    expect(
      Object.values(explainCarfXml(golden("all-categories")).categories).every(
        (count) => count > 0,
      ),
    ).toBe(true);
    expect(
      explainCarfXml(
        '<carf:CARF_OECD xmlns:carf="urn:oecd:ties:carf:v1"><carf:CARFBody><carf:RCASP/></carf:CARFBody></carf:CARF_OECD>',
      ).docTypeIndics,
    ).toEqual({ "(missing)": 1 });
  });
});
