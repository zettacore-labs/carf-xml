// A summary of a CARF message: header, records per DocTypeIndic, users, controlling persons,
// crypto-assets and entries per transaction category. It reads only what it counts.
import { TRANSACTION_CATEGORIES, type TransactionCategory } from "./model/transactions.js";
import { buildContext, partyOf } from "./rules/context.js";
import {
  childrenNamed,
  childText,
  descendantsNamed,
  parseXml,
  type XmlElement,
} from "./xml/tree.js";

export interface MessageSummary {
  readonly messageRefId: string | undefined;
  readonly messageTypeIndic: string | undefined;
  readonly transmittingCountry: string | undefined;
  readonly receivingCountry: string | undefined;
  readonly reportingPeriod: string | undefined;
  readonly carfBodies: number;
  readonly rcaspRecords: number;
  /** Records (RCASP and CryptoUsers) per DocTypeIndic. */
  readonly docTypeIndics: Readonly<Record<string, number>>;
  readonly cryptoUsers: { readonly individual: number; readonly entity: number };
  readonly controllingPersons: number;
  /** Distinct CryptoAsset values. */
  readonly cryptoAssets: number;
  /** Category elements (entries) per transaction category. */
  readonly categories: Readonly<Record<TransactionCategory, number>>;
}

export function explainCarfXml(xml: string | Uint8Array | XmlElement): MessageSummary {
  const root = typeof xml === "string" || xml instanceof Uint8Array ? parseXml(xml) : xml;
  const ctx = buildContext(root);
  const docTypeIndics: Record<string, number> = {};
  for (const record of ctx.records) {
    const indic = record.docSpec.docTypeIndic ?? "(missing)";
    docTypeIndics[indic] = (docTypeIndics[indic] ?? 0) + 1;
  }
  const users = ctx.records.filter((r) => r.kind === "CryptoUsers");
  const categories = Object.fromEntries(
    TRANSACTION_CATEGORIES.map((category) => [category, descendantsNamed(root, category).length]),
  ) as Record<TransactionCategory, number>;
  const assets = new Set(
    descendantsNamed(root, "RelevantTransactions").map((rt) => childText(rt, "CryptoAsset") ?? ""),
  );
  return {
    messageRefId:
      ctx.messageSpec === undefined ? undefined : childText(ctx.messageSpec, "MessageRefId"),
    messageTypeIndic: ctx.messageTypeIndic,
    transmittingCountry: ctx.transmittingCountry,
    receivingCountry: ctx.receivingCountry,
    reportingPeriod: ctx.reportingPeriod,
    carfBodies: ctx.bodies.length,
    rcaspRecords: ctx.records.filter((r) => r.kind === "RCASP").length,
    docTypeIndics,
    cryptoUsers: {
      individual: users.filter((u) => partyOf(u.element)?.name === "Individual").length,
      entity: users.filter((u) => partyOf(u.element)?.name === "Entity").length,
    },
    controllingPersons: users.reduce(
      (total, u) => total + childrenNamed(u.element, "ControllingPerson").length,
      0,
    ),
    cryptoAssets: assets.size,
    categories,
  };
}
