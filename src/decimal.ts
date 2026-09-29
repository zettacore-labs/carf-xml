// Exact decimal strings. Amounts and quantities are never JavaScript numbers: they stay strings
// in plain decimal notation, and rounding is done digit by digit with BigInt.

/** A decimal in plain notation: optional "-", digits, optional fraction. No exponent, no "+". */
export type DecimalString = string & { readonly __brand: "DecimalString" };

const DECIMAL_PATTERN = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;

export function isDecimalString(value: unknown): value is DecimalString {
  return typeof value === "string" && DECIMAL_PATTERN.test(value);
}

export function asDecimalString(value: string): DecimalString {
  if (!isDecimalString(value)) {
    throw new TypeError(`Not a plain decimal string: ${JSON.stringify(value)}`);
  }
  return value;
}

export const ROUNDING_MODES = [
  "UP",
  "DOWN",
  "CEIL",
  "FLOOR",
  "HALF_UP",
  "HALF_DOWN",
  "HALF_EVEN",
] as const;

/**
 * UP / DOWN round away from / towards zero; CEIL / FLOOR towards +∞ / −∞; HALF_* round to the
 * nearest value and differ only on an exact half.
 */
export type RoundingMode = (typeof ROUNDING_MODES)[number];

interface Parts {
  readonly negative: boolean;
  readonly integer: string;
  readonly fraction: string;
}

function split(value: DecimalString): Parts {
  const negative = value.startsWith("-");
  const [integer = "0", fraction = ""] = (negative ? value.slice(1) : value).split(".");
  return { negative, integer, fraction };
}

function join(negative: boolean, magnitude: bigint, places: number): string {
  const digits = magnitude.toString().padStart(places + 1, "0");
  const integer = digits.slice(0, digits.length - places);
  const fraction = digits.slice(digits.length - places);
  const text = places === 0 ? integer : `${integer}.${fraction}`;
  return negative && magnitude !== 0n ? `-${text}` : text;
}

function roundUp(mode: RoundingMode, negative: boolean, kept: bigint, dropped: string): boolean {
  if (/^0*$/.test(dropped)) {
    return false;
  }
  const first = dropped.charAt(0);
  const half = first > "5" ? 1 : first < "5" ? -1 : /^0*$/.test(dropped.slice(1)) ? 0 : 1;
  switch (mode) {
    case "UP":
      return true;
    case "DOWN":
      return false;
    case "CEIL":
      return !negative;
    case "FLOOR":
      return negative;
    case "HALF_UP":
      return half >= 0;
    case "HALF_DOWN":
      return half > 0;
    case "HALF_EVEN":
      return half > 0 || (half === 0 && kept % 2n === 1n);
  }
}

/** Rounds to exactly `places` fraction digits (padding with zeros when shorter). */
export function roundToPlaces(
  value: DecimalString,
  places: number,
  mode: RoundingMode,
): DecimalString {
  if (!Number.isSafeInteger(places) || places < 0 || places > 18) {
    throw new RangeError("places must be an integer from 0 to 18");
  }
  const { negative, integer, fraction } = split(value);
  const kept = BigInt(integer + fraction.slice(0, places).padEnd(places, "0"));
  const magnitude = roundUp(mode, negative, kept, fraction.slice(places)) ? kept + 1n : kept;
  return asDecimalString(join(negative, magnitude, places));
}

/** Removes trailing fraction zeros and a "-0" sign: "1.500" → "1.5", "-0.00" → "0". */
export function canonicalDecimal(value: DecimalString): DecimalString {
  const { negative, integer, fraction } = split(value);
  const trimmed = fraction.replace(/0+$/, "");
  const zero = /^0+$/.test(integer) && trimmed === "";
  const text = trimmed === "" ? integer : `${integer}.${trimmed}`;
  return asDecimalString(negative && !zero ? `-${text}` : text);
}

/** Number of digits after the decimal point. */
export function fractionDigits(value: DecimalString): number {
  return split(value).fraction.length;
}

/** Sign of the value: -1, 0 or 1 (exact, no conversion to number). */
export function signOf(value: DecimalString): -1 | 0 | 1 {
  const { negative, integer, fraction } = split(value);
  if (/^0*$/.test(integer + fraction)) {
    return 0;
  }
  return negative ? -1 : 1;
}
