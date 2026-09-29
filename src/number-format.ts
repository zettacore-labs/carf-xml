// How amounts and units are written in the XML. The OECD CARF XML Schema User Guide (July 2025,
// p. 22 and each category's Amount/NumberofUnits) says amounts have 2 decimal places and units
// are reported "up to the sixth decimal place". It gives no rounding rule, so the caller must
// supply one confirmed for its jurisdiction; until then formatting throws.
import { z } from "zod";

import {
  asDecimalString,
  canonicalDecimal,
  fractionDigits,
  roundToPlaces,
  ROUNDING_MODES,
  type DecimalString,
  type RoundingMode,
} from "./decimal.js";
import { ConfigurationRequiredError } from "./errors.js";

export interface NumberFormatPolicy {
  /** "CONFIGURATION_REQUIRED" until a rounding rule confirmed for the jurisdiction is supplied. */
  readonly roundingMode: RoundingMode | "CONFIGURATION_REQUIRED";
  /** Fraction digits of every Amount (OECD user guide: 2). */
  readonly amountFractionDigits: number;
  /** Maximum fraction digits of NumberofUnits (OECD user guide: 6). */
  readonly unitsMaxFractionDigits: number;
  /** Where the rounding rule comes from, recorded for evidence (free text). */
  readonly source?: string;
}

/** The OECD CARF XML Schema User Guide v2.0 (July 2025), p. 22. */
export const OECD_AMOUNT_FRACTION_DIGITS = 2;
export const OECD_UNITS_MAX_FRACTION_DIGITS = 6;

/** Decimal places from the OECD user guide; rounding not configured. */
export const DEFAULT_NUMBER_FORMAT_POLICY: NumberFormatPolicy = {
  roundingMode: "CONFIGURATION_REQUIRED",
  amountFractionDigits: OECD_AMOUNT_FRACTION_DIGITS,
  unitsMaxFractionDigits: OECD_UNITS_MAX_FRACTION_DIGITS,
};

const fractionDigitsSchema = z.number().int().min(0).max(18);

/** Schema for a policy file (CLI `--number-policy`). Places default to the OECD values. */
export const numberFormatPolicySchema = z.strictObject({
  roundingMode: z.enum(ROUNDING_MODES),
  amountFractionDigits: fractionDigitsSchema.default(OECD_AMOUNT_FRACTION_DIGITS),
  unitsMaxFractionDigits: fractionDigitsSchema.default(OECD_UNITS_MAX_FRACTION_DIGITS),
  source: z.string().min(1).optional(),
});

function modeOf(policy: NumberFormatPolicy): RoundingMode {
  if (policy.roundingMode === "CONFIGURATION_REQUIRED") {
    throw new ConfigurationRequiredError(
      "numberFormat.roundingMode",
      "No rounding mode is set for XML amounts and units. The OECD user guide gives the number of decimal places but no rounding rule: supply a NumberFormatPolicy with a rounding mode confirmed for your jurisdiction.",
    );
  }
  return policy.roundingMode;
}

/** An Amount with exactly `amountFractionDigits` places, e.g. "1000" → "1000.00". */
export function formatAmount(value: DecimalString, policy: NumberFormatPolicy): string {
  return roundToPlaces(value, policy.amountFractionDigits, modeOf(policy));
}

/** NumberofUnits with at most `unitsMaxFractionDigits` places and no trailing zeros. */
export function formatUnits(value: DecimalString, policy: NumberFormatPolicy): string {
  const mode = modeOf(policy);
  const rounded =
    fractionDigits(value) > policy.unitsMaxFractionDigits
      ? roundToPlaces(value, policy.unitsMaxFractionDigits, mode)
      : asDecimalString(value);
  return canonicalDecimal(rounded);
}
