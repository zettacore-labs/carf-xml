// Runs the "Build a message" example of README.md, so the documentation stays correct.
import { describe, expect, it } from "vitest";

import {
  asDecimalString,
  buildCarfXml,
  checkBusinessRules,
  type CarfMessage,
} from "../src/index.js";

describe("README example", () => {
  it("builds a message that passes the business rules", () => {
    const message: CarfMessage = {
      messageSpec: {
        transmittingCountry: "GB",
        receivingCountry: "FR",
        messageType: "CARF",
        messageRefId: "GB2027FR0000000001",
        messageTypeIndic: "CARF701",
        reportingPeriod: "2027-12-31",
        timestamp: "2028-03-01T09:00:00",
      },
      carfBodies: [
        {
          rcasp: {
            rcaspId: {
              entity: {
                resCountryCodes: ["GB"],
                tins: [{ value: "EXAMPLE-TIN", issuedBy: "GB" }],
                names: [{ value: "Example Exchange Ltd" }],
                addresses: [{ countryCode: "GB", addressFix: { city: "London" } }],
              },
            },
            nexus: "CARF901",
            docSpec: { docTypeIndic: "OECD1", docRefId: "GB2027-R-0001" },
          },
          cryptoUsers: [
            {
              userId: {
                individual: {
                  resCountryCodes: ["FR"],
                  tins: [{ value: "EXAMPLE-TIN-FR", issuedBy: "FR" }],
                  names: [{ firstName: { value: "Alex" }, lastName: { value: "Example" } }],
                  addresses: [{ countryCode: "FR", addressFix: { city: "Paris" } }],
                  birthInfo: { birthDate: "1985-06-15" },
                },
              },
              relevantTransactions: [
                {
                  cryptoAsset: "BTC",
                  category: "CryptoFiatOut",
                  entries: [
                    {
                      numberOfTransactions: 1,
                      amount: { value: asDecimalString("4200.10"), currCode: "EUR" },
                      numberOfUnits: asDecimalString("0.1"),
                    },
                  ],
                },
              ],
              docSpec: { docTypeIndic: "OECD1", docRefId: "GB2027-U-0001" },
            },
          ],
        },
      ],
    };

    const { xml, sha256 } = buildCarfXml(message, {
      // The OECD user guide sets 2 decimal places for amounts and up to 6 for units,
      // but no rounding rule: supply the rule that applies in your jurisdiction.
      numberFormat: { roundingMode: "HALF_UP", amountFractionDigits: 2, unitsMaxFractionDigits: 6 },
      // Value of the optional CARF_OECD/@version attribute, or null to omit it.
      rootVersion: null,
    });
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(checkBusinessRules(xml).findings).toEqual([]);
  });
});
