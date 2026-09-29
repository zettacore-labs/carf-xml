import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  asDecimalString,
  canonicalDecimal,
  fractionDigits,
  isDecimalString,
  roundToPlaces,
  ROUNDING_MODES,
  signOf,
  type DecimalString,
  type RoundingMode,
} from "./decimal.js";

const d = (value: string): DecimalString => asDecimalString(value);

describe("decimal strings", () => {
  it.each(["0", "-1", "12.5000", "0.000001", "123456789012345678901234567890.123456789"])(
    "accepts %s",
    (value) => {
      expect(isDecimalString(value)).toBe(true);
    },
  );

  it.each(["", "+1", "1e3", "01", ".5", "5.", "1,5", " 1", "NaN", 1.5, null])(
    "rejects %j",
    (value) => {
      expect(isDecimalString(value)).toBe(false);
    },
  );

  it("asDecimalString throws on anything else", () => {
    expect(() => asDecimalString("1e3")).toThrow(TypeError);
  });
});

describe("roundToPlaces", () => {
  it.each([
    // value, places, UP, DOWN, CEIL, FLOOR, HALF_UP, HALF_DOWN, HALF_EVEN
    ["2.345", 2, "2.35", "2.34", "2.35", "2.34", "2.35", "2.34", "2.34"],
    ["2.355", 2, "2.36", "2.35", "2.36", "2.35", "2.36", "2.35", "2.36"],
    ["-2.345", 2, "-2.35", "-2.34", "-2.34", "-2.35", "-2.35", "-2.34", "-2.34"],
    ["2.3451", 2, "2.35", "2.34", "2.35", "2.34", "2.35", "2.35", "2.35"],
    ["2.3449", 2, "2.35", "2.34", "2.35", "2.34", "2.34", "2.34", "2.34"],
    ["-0.004", 2, "-0.01", "0.00", "0.00", "-0.01", "0.00", "0.00", "0.00"],
    ["9.995", 2, "10.00", "9.99", "10.00", "9.99", "10.00", "9.99", "10.00"],
    ["1000", 2, "1000.00", "1000.00", "1000.00", "1000.00", "1000.00", "1000.00", "1000.00"],
    ["0.5", 0, "1", "0", "1", "0", "1", "0", "0"],
    ["1.5", 0, "2", "1", "2", "1", "2", "1", "2"],
  ] as const)("%s to %d places", (value, places, ...expected) => {
    ROUNDING_MODES.forEach((mode, index) => {
      expect(roundToPlaces(d(value), places, mode)).toBe(expected[index]);
    });
  });

  it("rejects places outside 0–18", () => {
    expect(() => roundToPlaces(d("1"), -1, "UP")).toThrow(RangeError);
    expect(() => roundToPlaces(d("1"), 19, "UP")).toThrow(RangeError);
    expect(() => roundToPlaces(d("1"), 1.5, "UP")).toThrow(RangeError);
  });

  // Oracle: scale to an integer count of 10^-places with BigInt and apply the mode by division.
  function oracle(value: string, places: number, mode: RoundingMode): string {
    const negative = value.startsWith("-");
    const [integer = "0", fraction = ""] = value.replace("-", "").split(".");
    const scale = 10n ** BigInt(fraction.length);
    const numerator = BigInt(integer + fraction) * 10n ** BigInt(places);
    const quotient = numerator / scale;
    const remainder = numerator % scale;
    const twice = remainder * 2n;
    let up: boolean;
    switch (mode) {
      case "UP":
        up = remainder > 0n;
        break;
      case "DOWN":
        up = false;
        break;
      case "CEIL":
        up = remainder > 0n && !negative;
        break;
      case "FLOOR":
        up = remainder > 0n && negative;
        break;
      case "HALF_UP":
        up = twice >= scale && remainder > 0n;
        break;
      case "HALF_DOWN":
        up = twice > scale;
        break;
      case "HALF_EVEN":
        up = twice > scale || (twice === scale && quotient % 2n === 1n);
        break;
    }
    const magnitude = up ? quotient + 1n : quotient;
    const digits = magnitude.toString().padStart(places + 1, "0");
    const text = places === 0 ? digits : `${digits.slice(0, -places)}.${digits.slice(-places)}`;
    return negative && magnitude !== 0n ? `-${text}` : text;
  }

  const decimal = fc
    .tuple(fc.boolean(), fc.bigInt({ min: 0n, max: 10n ** 30n }), fc.integer({ min: 0, max: 12 }))
    .map(([negative, digits, scale]) => {
      const raw = digits.toString().padStart(scale + 1, "0");
      const text = scale === 0 ? raw : `${raw.slice(0, -scale)}.${raw.slice(-scale)}`;
      return negative && digits !== 0n ? `-${text}` : text;
    });

  it("matches the BigInt oracle for every mode", () => {
    fc.assert(
      fc.property(
        decimal,
        fc.integer({ min: 0, max: 8 }),
        fc.constantFrom(...ROUNDING_MODES),
        (value, places, mode) => {
          expect(roundToPlaces(d(value), places, mode)).toBe(oracle(value, places, mode));
        },
      ),
      { numRuns: 2000 },
    );
  });
});

describe("helpers", () => {
  it.each([
    ["1.500", "1.5"],
    ["-0.00", "0"],
    ["10", "10"],
    ["-2.10", "-2.1"],
    ["0.0", "0"],
  ])("canonicalDecimal(%s) = %s", (value, expected) => {
    expect(canonicalDecimal(d(value))).toBe(expected);
  });

  it("counts fraction digits and reads the sign exactly", () => {
    expect(fractionDigits(d("1.230"))).toBe(3);
    expect(fractionDigits(d("7"))).toBe(0);
    expect(signOf(d("-0.000"))).toBe(0);
    expect(signOf(d("-0.001"))).toBe(-1);
    expect(signOf(d("0.001"))).toBe(1);
  });
});
