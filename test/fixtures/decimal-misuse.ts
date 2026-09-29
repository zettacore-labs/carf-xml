// Deliberate decimal misuse: every line below must be reported by the package's ESLint config
// (test/eslint-decimal.test.ts). This file is excluded from the normal lint run.
import { asDecimalString } from "../../src/decimal.js";

const amount = asDecimalString("10.50");
const fee = asDecimalString("0.25");

export const viaNumber = Number(amount);
export const viaParseFloat = parseFloat(amount);
export const viaNumberParseFloat = Number.parseFloat(amount);
export const viaUnaryPlus = +amount;
export const viaAddition = amount + fee;
