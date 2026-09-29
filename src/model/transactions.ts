// carf:RelevantTransactions_Type. After CryptoAsset the XSD has a single xsd:choice between the
// eight category elements, each repeatable: one RelevantTransactions element holds entries of
// ONE category only. Report several categories for the same crypto-asset in separate
// RelevantTransactions elements with the same CryptoAsset.
//
// Codes are allowed only where the XSD has them: ExchangeType on the four exchange categories,
// TransferType on the two transfer categories, AltValuation on CryptoTransferIn,
// CryptoTransferOut and TransferWallet. Every object is strict, so a code anywhere else is
// rejected.
import { z } from "zod";

import {
  AltValuation,
  CurrCode,
  ExchangeType,
  TransferOutType,
  TransferType,
} from "../generated/enums.js";
import { decimalString, string1to200, xsdInteger } from "./primitives.js";
import type { RelevantTransactions } from "./types.js";

/** carf:MonAmnt_Type: a decimal amount with its ISO 4217 currency code. */
const monAmntSchema = z.strictObject({
  value: decimalString,
  currCode: z.enum(CurrCode),
});

/** CryptoToCryptoIn / CryptoToCryptoOut / CryptoFiatIn / CryptoFiatOut entries. */
const exchangeEntrySchema = z.strictObject({
  exchangeType: z.enum(ExchangeType).optional(),
  numberOfTransactions: xsdInteger,
  amount: monAmntSchema,
  numberOfUnits: decimalString,
});

const transferInEntrySchema = z.strictObject({
  transferType: z.enum(TransferType),
  numberOfTransactions: xsdInteger,
  amount: monAmntSchema,
  numberOfUnits: decimalString,
  altValuation: z.enum(AltValuation).optional(),
});

const transferOutEntrySchema = z.strictObject({
  transferType: z.enum(TransferOutType),
  numberOfTransactions: xsdInteger,
  amount: monAmntSchema,
  numberOfUnits: decimalString,
  altValuation: z.enum(AltValuation).optional(),
});

const transferWalletEntrySchema = z.strictObject({
  amount: monAmntSchema,
  numberOfUnits: decimalString,
  altValuation: z.enum(AltValuation).optional(),
});

const rrptEntrySchema = z.strictObject({
  numberOfTransactions: xsdInteger,
  amount: monAmntSchema,
  numberOfUnits: decimalString,
});

/** The eight category element names, in XSD order. */
export const TRANSACTION_CATEGORIES = [
  "CryptoToCryptoIn",
  "CryptoToCryptoOut",
  "CryptoFiatIn",
  "CryptoFiatOut",
  "CryptoTransferIn",
  "CryptoTransferOut",
  "TransferWallet",
  "RRPT",
] as const;
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

function category<C extends TransactionCategory, E extends z.ZodType>(name: C, entry: E) {
  return z.strictObject({
    cryptoAsset: string1to200,
    category: z.literal(name),
    entries: z.array(entry),
  });
}

/** carf:RelevantTransactions_Type: CryptoAsset plus the entries of one category. */
export const relevantTransactionsSchema: z.ZodType<RelevantTransactions> = z.discriminatedUnion(
  "category",
  [
    category("CryptoToCryptoIn", exchangeEntrySchema),
    category("CryptoToCryptoOut", exchangeEntrySchema),
    category("CryptoFiatIn", exchangeEntrySchema),
    category("CryptoFiatOut", exchangeEntrySchema),
    category("CryptoTransferIn", transferInEntrySchema),
    category("CryptoTransferOut", transferOutEntrySchema),
    category("TransferWallet", transferWalletEntrySchema),
    category("RRPT", rrptEntrySchema),
  ],
);
