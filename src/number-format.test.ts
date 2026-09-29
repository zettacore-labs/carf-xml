import { describe, expect, it } from "vitest";

import { asDecimalString } from "./decimal.js";
import { ConfigurationRequiredError } from "./errors.js";
import {
  DEFAULT_NUMBER_FORMAT_POLICY,
  formatAmount,
  formatUnits,
  numberFormatPolicySchema,
  type NumberFormatPolicy,
} from "./number-format.js";

const policy: NumberFormatPolicy = { ...DEFAULT_NUMBER_FORMAT_POLICY, roundingMode: "HALF_EVEN" };

describe("number format", () => {
  it("uses the OECD decimal places and no rounding mode by default", () => {
    expect(DEFAULT_NUMBER_FORMAT_POLICY).toEqual({
      roundingMode: "CONFIGURATION_REQUIRED",
      amountFractionDigits: 2,
      unitsMaxFractionDigits: 6,
    });
  });

  it("refuses to format with the default policy", () => {
    expect(() => formatAmount(asDecimalString("1"), DEFAULT_NUMBER_FORMAT_POLICY)).toThrow(
      ConfigurationRequiredError,
    );
    expect(() => formatUnits(asDecimalString("1"), DEFAULT_NUMBER_FORMAT_POLICY)).toThrow(
      /No rounding mode is set/,
    );
    try {
      formatAmount(asDecimalString("1"), DEFAULT_NUMBER_FORMAT_POLICY);
    } catch (error) {
      expect(error).toMatchObject({
        code: "CONFIGURATION_REQUIRED",
        setting: "numberFormat.roundingMode",
      });
    }
  });

  it("writes amounts with exactly the configured places", () => {
    expect(formatAmount(asDecimalString("1000"), policy)).toBe("1000.00");
    expect(formatAmount(asDecimalString("2.345"), policy)).toBe("2.34");
    expect(formatAmount(asDecimalString("1"), { ...policy, amountFractionDigits: 0 })).toBe("1");
  });

  it("writes units with at most the configured places and no trailing zeros", () => {
    expect(formatUnits(asDecimalString("0.1234565"), policy)).toBe("0.123456");
    expect(formatUnits(asDecimalString("0.1234575"), policy)).toBe("0.123458");
    expect(formatUnits(asDecimalString("1.500"), policy)).toBe("1.5");
    expect(formatUnits(asDecimalString("3"), policy)).toBe("3");
    expect(formatUnits(asDecimalString("0.0000004"), policy)).toBe("0");
  });

  it("reads a policy file, defaulting the places to the OECD values", () => {
    expect(numberFormatPolicySchema.parse({ roundingMode: "HALF_UP" })).toEqual({
      roundingMode: "HALF_UP",
      amountFractionDigits: 2,
      unitsMaxFractionDigits: 6,
    });
    expect(() =>
      numberFormatPolicySchema.parse({ roundingMode: "CONFIGURATION_REQUIRED" }),
    ).toThrow();
    expect(() =>
      numberFormatPolicySchema.parse({ roundingMode: "HALF_UP", extra: true }),
    ).toThrow();
    expect(() =>
      numberFormatPolicySchema.parse({ roundingMode: "HALF_UP", amountFractionDigits: 19 }),
    ).toThrow();
  });
});
