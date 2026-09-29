// XSD simple types used by the model. String lengths count characters (Unicode code points),
// as XML Schema does, not UTF-16 code units.
import { z } from "zod";

import { isDecimalString, type DecimalString } from "../decimal.js";

/** True if every character is allowed in XML 1.0 (production [2] Char). */
export function isXmlText(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    const allowed =
      code === 0x9 ||
      code === 0xa ||
      code === 0xd ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff);
    if (!allowed) {
      return false;
    }
  }
  return true;
}

const SURROGATE_PAIR = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

/** Length as XML Schema counts it: in characters (Unicode code points), not UTF-16 units. */
export function xsdLength(value: string): number {
  return value.replace(SURROGATE_PAIR, "_").length;
}

/** A string of `min`..`max` characters (stf:StringMinXMaxY_Type) that XML 1.0 can carry. */
export function xsdString(min: number, max: number) {
  return z
    .string()
    .refine(isXmlText, { message: "contains a character that XML 1.0 does not allow" })
    .refine(
      (value) => {
        const length = xsdLength(value);
        return length >= min && length <= max;
      },
      { message: `must be ${String(min)} to ${String(max)} characters` },
    );
}

export const string1to10 = xsdString(1, 10);
export const string1to170 = xsdString(1, 170);
export const string1to200 = xsdString(1, 200);
export const string0to200 = xsdString(0, 200);
export const string1to4000 = xsdString(1, 4000);

export const decimalString = z.custom<DecimalString>(isDecimalString, {
  message: 'must be a decimal string in plain notation, e.g. "1234.5"',
});

/** xsd:integer, limited to JavaScript's safe integers. Counts only, never money. */
export const xsdInteger = z.number().int().refine(Number.isSafeInteger, {
  message: "must be a safe integer",
});

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (match === null) {
    return false;
  }
  const [, year, month, day] = match;
  const date = new Date(`${year ?? ""}-${month ?? ""}-${day ?? ""}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** xsd:date in the YYYY-MM-DD form the OECD user guide uses. */
export const xsdDate = z.string().refine(isCalendarDate, { message: "must be a date YYYY-MM-DD" });

/** xsd:dateTime lexical form (the user guide's stricter format is checked by rule V2-006). */
export const xsdDateTime = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
    "must be a date and time YYYY-MM-DDThh:mm:ss",
  );
