import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CarfModelError } from "../errors.js";
import { carfMessageSchema, parseCarfMessage } from "./message.js";
import { isXmlText, xsdLength } from "./primitives.js";
import type { CarfMessage, ExchangeEntry, RrptEntry } from "./types.js";

const golden = (name: string): unknown =>
  JSON.parse(
    readFileSync(join(import.meta.dirname, "../../test/golden", name, "message.json"), "utf8"),
  );

function withEntry(category: string, entry: Record<string, unknown>): unknown {
  const message = golden("new-data") as CarfMessage;
  const clone = structuredClone(message) as unknown as {
    carfBodies: { cryptoUsers: { relevantTransactions: unknown[] }[] }[];
  };
  const user = clone.carfBodies[0]?.cryptoUsers[0];
  if (user !== undefined) {
    user.relevantTransactions = [{ cryptoAsset: "BTC", category, entries: [entry] }];
  }
  return clone;
}

const amount = { value: "1.00", currCode: "EUR" };
const exchange = { numberOfTransactions: 1, amount, numberOfUnits: "1" };

describe("CARF message model", () => {
  it("accepts every golden message", () => {
    for (const name of [
      "new-data",
      "all-categories",
      "multiple-residencies",
      "correction",
      "deletion",
      "nil-rcasp-only",
      "nil-no-body",
    ]) {
      expect(carfMessageSchema.safeParse(golden(name)).success).toBe(true);
    }
  });

  it.each(["CryptoToCryptoIn", "CryptoToCryptoOut", "CryptoFiatIn", "CryptoFiatOut"])(
    "rejects AltValuation on %s",
    (category) => {
      expect(() =>
        parseCarfMessage(withEntry(category, { ...exchange, altValuation: "CARF1001" })),
      ).toThrow(CarfModelError);
    },
  );

  it("rejects AltValuation on RRPT", () => {
    expect(() =>
      parseCarfMessage(withEntry("RRPT", { ...exchange, altValuation: "CARF1001" })),
    ).toThrow(/Unrecognized key/);
  });

  it.each([
    ["CryptoTransferIn", { transferType: "CARF505", ...exchange, altValuation: "CARF1001" }],
    ["CryptoTransferOut", { transferType: "CARF601", ...exchange, altValuation: "CARF1002" }],
    ["TransferWallet", { amount, numberOfUnits: "1", altValuation: "CARF1004" }],
  ])("accepts AltValuation on %s", (category, entry) => {
    expect(() => parseCarfMessage(withEntry(category, entry))).not.toThrow();
  });

  it("allows codes only where the XSD has them", () => {
    expect(() =>
      parseCarfMessage(withEntry("RRPT", { ...exchange, exchangeType: "CARF401" })),
    ).toThrow(CarfModelError);
    expect(() =>
      parseCarfMessage(withEntry("CryptoTransferIn", { transferType: "CARF601", ...exchange })),
    ).toThrow(CarfModelError);
    expect(() =>
      parseCarfMessage(withEntry("CryptoTransferOut", { transferType: "CARF505", ...exchange })),
    ).toThrow(CarfModelError);
    expect(() =>
      parseCarfMessage(withEntry("CryptoFiatIn", { ...exchange, transferType: "CARF505" })),
    ).toThrow(CarfModelError);
    expect(() => parseCarfMessage(withEntry("TransferWallet", { ...exchange }))).toThrow(
      CarfModelError,
    );
  });

  it("types the rule too: AltValuation does not exist on exchange or RRPT entries", () => {
    const onExchange: ExchangeEntry = {
      numberOfTransactions: 1,
      amount: { value: "1" as never, currCode: "EUR" },
      numberOfUnits: "1" as never,
      // @ts-expect-error AltValuation is not an ExchangeEntry field.
      altValuation: "CARF1001",
    };
    const onRrpt: RrptEntry = {
      numberOfTransactions: 1,
      amount: { value: "1" as never, currCode: "EUR" },
      numberOfUnits: "1" as never,
      // @ts-expect-error AltValuation is not an RrptEntry field.
      altValuation: "CARF1001",
    };
    expect([onExchange, onRrpt]).toHaveLength(2);
  });

  it("rejects numbers for amounts and units, and unknown codes", () => {
    expect(() =>
      parseCarfMessage(withEntry("CryptoFiatIn", { ...exchange, numberOfUnits: 1 })),
    ).toThrow(/decimal string/);
    expect(() =>
      parseCarfMessage(
        withEntry("CryptoFiatIn", { ...exchange, amount: { value: 1, currCode: "EUR" } }),
      ),
    ).toThrow(CarfModelError);
    expect(() =>
      parseCarfMessage(
        withEntry("CryptoFiatIn", { ...exchange, amount: { value: "1", currCode: "EURO" } }),
      ),
    ).toThrow(CarfModelError);
    expect(() =>
      parseCarfMessage(withEntry("CryptoFiatIn", { ...exchange, numberOfTransactions: 1.5 })),
    ).toThrow(CarfModelError);
  });

  it("names the invalid field", () => {
    const message = structuredClone(golden("nil-no-body")) as {
      messageSpec: Record<string, unknown>;
    };
    message.messageSpec.reportingPeriod = "2027-02-30";
    message.messageSpec.timestamp = "2028-3-1T09:00:00";
    message.messageSpec.extra = "x";
    try {
      parseCarfMessage(message);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CarfModelError);
      const issues = (error as CarfModelError).issues.map((issue) => issue.path);
      expect(issues).toContain("messageSpec.reportingPeriod");
      expect(issues).toContain("messageSpec.timestamp");
      expect(issues).toContain("messageSpec");
    }
  });

  it("accepts only YYYY-MM-DD calendar dates", () => {
    const message = structuredClone(golden("nil-no-body")) as {
      messageSpec: Record<string, unknown>;
    };
    for (const bad of ["2027-1-01", "27-12-31", "2027-13-01"]) {
      message.messageSpec.reportingPeriod = bad;
      expect(carfMessageSchema.safeParse(message).success).toBe(false);
    }
    message.messageSpec.reportingPeriod = "2028-02-29";
    expect(carfMessageSchema.safeParse(message).success).toBe(true);
  });

  it("counts string length in characters and rejects characters XML cannot carry", () => {
    expect(xsdLength("😀a")).toBe(2);
    expect(isXmlText("tab\tand\nnewline")).toBe(true);
    expect(isXmlText("bell\u0007")).toBe(false);
    expect(isXmlText("￾")).toBe(false);
    expect(isXmlText("lone \uD800")).toBe(false);
    expect(isXmlText("\u{10000}")).toBe(true);
    const message = structuredClone(golden("nil-no-body")) as {
      messageSpec: Record<string, unknown>;
    };
    message.messageSpec.messageRefId = "😀".repeat(170);
    expect(carfMessageSchema.safeParse(message).success).toBe(true);
    message.messageSpec.messageRefId = "😀".repeat(171);
    expect(carfMessageSchema.safeParse(message).success).toBe(false);
    message.messageSpec.messageRefId = "bad\u0001";
    expect(carfMessageSchema.safeParse(message).success).toBe(false);
  });
});
