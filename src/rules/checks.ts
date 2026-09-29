// The checks behind each V2 rule (catalogue.ts). Each returns the elements that break the rule
// with a plain-language message. They never read values they do not need.
import { isDecimalString, signOf } from "../decimal.js";
import {
  childNamed,
  childrenNamed,
  childText,
  descendantsNamed,
  type XmlElement,
} from "../xml/tree.js";
import type { RuleId } from "./catalogue.js";
import { partyOf, resCountryCodes, type MessageContext, type RecordInfo } from "./context.js";

export interface RawFinding {
  readonly element: XmlElement;
  readonly message: string;
}

export interface CheckOptions {
  readonly expectedReportingPeriod?: string;
  readonly docRefIdFormat?: RegExp | ((docRefId: string) => boolean);
}

/** A check returns findings, or "not_checked" / "configuration_required" with a reason. */
export type CheckOutcome =
  | readonly RawFinding[]
  | { readonly status: "not_checked" | "configuration_required"; readonly note: string };

type Check = (ctx: MessageContext, options: CheckOptions) => CheckOutcome;

const TIMESTAMP_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?$/;
const CARF_CODE = /^CARF9(\d{2})$/;

function at(record: RecordInfo): XmlElement {
  return record.docSpec.element ?? record.element;
}

function indicElement(record: RecordInfo): XmlElement {
  const docSpec = record.docSpec.element;
  return (docSpec === undefined ? undefined : childNamed(docSpec, "DocTypeIndic")) ?? at(record);
}

function recordsWith(ctx: MessageContext, indics: readonly string[]): RecordInfo[] {
  return ctx.records.filter(
    (r) => r.docSpec.baseIndic !== undefined && indics.includes(r.docSpec.baseIndic),
  );
}

function individualUsers(ctx: MessageContext): RecordInfo[] {
  return ctx.records.filter(
    (r) => r.kind === "CryptoUsers" && partyOf(r.element)?.name === "Individual",
  );
}

function controllingIndividuals(user: XmlElement): XmlElement[] {
  return childrenNamed(user, "ControllingPerson")
    .map((cp) => childNamed(cp, "Individual"))
    .filter((person): person is XmlElement => person !== undefined);
}

function duplicates(
  values: readonly { key: string | undefined; element: XmlElement }[],
): XmlElement[] {
  const seen = new Set<string>();
  const repeated: XmlElement[] = [];
  for (const { key, element } of values) {
    if (key === undefined || key === "") {
      continue;
    }
    if (seen.has(key)) {
      repeated.push(element);
    }
    seen.add(key);
  }
  return repeated;
}

function nexusNumber(code: string | undefined): number | undefined {
  const match = code === undefined ? null : CARF_CODE.exec(code);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

export const CHECKS: Readonly<Record<RuleId, Check>> = {
  "V2-001": (ctx) =>
    ctx.messageTypeIndic !== "CARF702"
      ? []
      : recordsWith(ctx, ["OECD1"]).map((r) => ({
          element: indicElement(r),
          message: "a correction message (CARF702) contains a new record (OECD1)",
        })),

  "V2-002": (ctx) =>
    recordsWith(ctx, ["OECD2", "OECD3"])
      .filter((r) => r.docSpec.corrDocRefId === undefined || r.docSpec.corrDocRefId === "")
      .map((r) => ({
        element: at(r),
        message:
          "a corrected or deleted record has no reference to the record it replaces (CorrDocRefId)",
      })),

  "V2-003": (ctx) =>
    duplicates(ctx.records.map((r) => ({ key: r.docSpec.docRefId, element: at(r) }))).map(
      (element) => ({
        element,
        message: "the document reference ID (DocRefId) is used by another record in this message",
      }),
    ),

  "V2-004": (ctx) => {
    const element =
      ctx.messageSpec === undefined ? undefined : childNamed(ctx.messageSpec, "MessageType");
    return element === undefined || ctx.messageType === "CARF"
      ? []
      : [{ element, message: 'the message type is not "CARF"' }];
  },

  "V2-005": (ctx, options) => {
    if (options.expectedReportingPeriod === undefined) {
      return { status: "not_checked", note: "no expected reporting period was given" };
    }
    const element =
      ctx.messageSpec === undefined ? undefined : childNamed(ctx.messageSpec, "ReportingPeriod");
    return element === undefined || ctx.reportingPeriod === options.expectedReportingPeriod
      ? []
      : [
          {
            element,
            message: `the reporting period is not ${options.expectedReportingPeriod}, the last day of the period this message is for`,
          },
        ];
  },

  "V2-006": (ctx) => {
    const element =
      ctx.messageSpec === undefined ? undefined : childNamed(ctx.messageSpec, "Timestamp");
    return element === undefined || TIMESTAMP_FORMAT.test(element.text.trim())
      ? []
      : [
          {
            element,
            message:
              "the timestamp is not in the format YYYY-MM-DDThh:mm:ss or YYYY-MM-DDThh:mm:ss.nnn",
          },
        ];
  },

  "V2-007": (ctx) =>
    ctx.messageTypeIndic !== "CARF701"
      ? []
      : recordsWith(ctx, ["OECD2", "OECD3"]).map((r) => ({
          element: indicElement(r),
          message: "a new-data message (CARF701) contains a correction or deletion",
        })),

  "V2-008": (ctx) =>
    descendantsNamed(ctx.root, "Amount")
      .filter((amount) => {
        const value = amount.text.trim();
        return isDecimalString(value) && signOf(value) < 0;
      })
      .map((element) => ({ element, message: "the amount is negative" })),

  "V2-009": (ctx) =>
    individualUsers(ctx).flatMap((user) =>
      childrenNamed(user.element, "ControllingPerson").map((element) => ({
        element,
        message: "an individual crypto-asset user has a controlling person",
      })),
    ),

  "V2-010": (ctx) => {
    const receiving = ctx.receivingCountry;
    if (receiving === undefined) {
      return [];
    }
    const findings: RawFinding[] = [];
    for (const user of ctx.records.filter((r) => r.kind === "CryptoUsers")) {
      const party = partyOf(user.element);
      if (party?.name === "Individual" && !resCountryCodes(party).includes(receiving)) {
        findings.push({
          element: party,
          message: `the user has no country of residence equal to the receiving country ${receiving}`,
        });
      }
      for (const person of controllingIndividuals(user.element)) {
        if (!resCountryCodes(person).includes(receiving)) {
          findings.push({
            element: person,
            message: `a controlling person has no country of residence equal to the receiving country ${receiving}`,
          });
        }
      }
    }
    return findings;
  },

  "V2-011": (ctx) => {
    const receiving = ctx.receivingCountry;
    if (receiving === undefined) {
      return [];
    }
    return ctx.records
      .filter((r) => r.kind === "CryptoUsers" && partyOf(r.element)?.name === "Entity")
      .filter((user) => {
        const codes = [
          ...resCountryCodes(partyOf(user.element)),
          ...controllingIndividuals(user.element).flatMap(resCountryCodes),
        ];
        return !codes.includes(receiving);
      })
      .map((user) => ({
        element: partyOf(user.element) ?? user.element,
        message: `neither the entity nor its controlling persons have a country of residence equal to the receiving country ${receiving}`,
      }));
  },

  "V2-012": (ctx) => {
    const sending = ctx.transmittingCountry;
    if (sending === undefined) {
      return [];
    }
    return ctx.records
      .filter((r) => r.kind === "RCASP")
      .flatMap((r) => {
        const party = partyOf(r.element);
        return party === undefined ? [] : childrenNamed(party, "ResCountryCode");
      })
      .filter((code) => code.text.trim() !== sending)
      .map((element) => ({
        element,
        message: `the RCASP's country of residence ${element.text.trim()} is not the sending country ${sending}`,
      }));
  },

  "V2-013": (ctx) =>
    ctx.receivingCountry === undefined
      ? []
      : ctx.records
          .filter((r) => r.kind === "RCASP")
          .map((r) => childNamed(r.element, "OtherNexus"))
          .filter((element): element is XmlElement => element !== undefined)
          .filter((element) => element.attributes.ResCountryCode !== ctx.receivingCountry)
          .map((element) => ({
            element,
            message: `the other nexus country is not the receiving country ${ctx.receivingCountry ?? ""}`,
          })),

  "V2-014": (ctx) =>
    descendantsNamed(ctx.root, "BirthDate")
      .filter((element) => {
        const value = element.text.trim();
        return (
          /^\d{4}-\d{2}-\d{2}$/.test(value) &&
          (value < "1900-01-01" ||
            (ctx.reportingPeriod !== undefined && value > ctx.reportingPeriod))
        );
      })
      .map((element) => ({
        element,
        message: "the date of birth is before 1900 or after the reporting period",
      })),

  "V2-015": (ctx) =>
    descendantsNamed(ctx.root, "TIN")
      .filter((tin) => {
        const unknown = tin.attributes.unknown;
        return (unknown === "true" || unknown === "1") && tin.text !== "NOTIN";
      })
      .map((element) => ({
        element,
        message: 'a TIN flagged unknown does not have the value "NOTIN"',
      })),

  "V2-016": (ctx) =>
    ctx.records
      .filter((r) => r.kind === "RCASP" && partyOf(r.element)?.name === "Individual")
      .map((r) => {
        const birthInfo = childNamed(partyOf(r.element) ?? r.element, "BirthInfo");
        return birthInfo === undefined ? undefined : childNamed(birthInfo, "BirthDate");
      })
      .filter(
        (element): element is XmlElement =>
          element !== undefined && element.text.trim() !== "1900-01-01",
      )
      .map((element) => ({
        element,
        message: "the birth date of an individual RCASP is not 1900-01-01",
      })),

  "V2-017": (ctx) =>
    ctx.records
      .filter((r) => r.kind === "RCASP")
      .flatMap((r) => {
        const other = childNamed(r.element, "OtherNexus");
        if (other === undefined || other.attributes.Nexus === "CARF906") {
          return [];
        }
        const otherNumber = nexusNumber(other.attributes.Nexus);
        const nexusNumberValue = nexusNumber(childText(r.element, "Nexus"));
        if (otherNumber === undefined) {
          return [];
        }
        if (nexusNumberValue === undefined) {
          return [
            {
              element: other,
              message: "the record has an other nexus but no nexus to compare it with",
            },
          ];
        }
        return otherNumber <= nexusNumberValue
          ? []
          : [
              {
                element: other,
                message: "the other nexus is weaker than the nexus and is not CARF906",
              },
            ];
      }),

  "V2-018": (ctx) =>
    ctx.messageTypeIndic !== "CARF701"
      ? []
      : ctx.bodies
          .filter((body) => childrenNamed(body, "CryptoUsers").length === 0)
          .filter((body) => {
            const rcasp = childNamed(body, "RCASP");
            return rcasp === undefined || childNamed(rcasp, "OtherNexus") === undefined;
          })
          .map((body) => ({
            element: childNamed(body, "RCASP") ?? body,
            message:
              "a new-data message (CARF701) has a CARF body without crypto-asset users and without an other nexus",
          })),

  "V2-019": (ctx) =>
    recordsWith(ctx, ["OECD1"])
      .filter((r) => r.docSpec.corrDocRefId !== undefined)
      .map((r) => ({
        element: at(r),
        message: "a new record (OECD1) refers to a corrected record (CorrDocRefId)",
      })),

  "V2-020": (ctx) =>
    ctx.records
      .filter((r) => r.docSpec.corrMessageRefId !== undefined)
      .map((r) => ({
        element: at(r),
        message: "the record's document specification has a CorrMessageRefId",
      })),

  "V2-021": (ctx) =>
    recordsWith(ctx, ["OECD0"])
      .filter((r) => r.kind === "CryptoUsers")
      .map((r) => ({
        element: indicElement(r),
        message: "a crypto-asset user record uses the resend option (OECD0)",
      })),

  "V2-022": (ctx) =>
    duplicates(
      recordsWith(ctx, ["OECD2", "OECD3"]).map((r) => ({
        key: r.docSpec.corrDocRefId,
        element: at(r),
      })),
    ).map((element) => ({
      element,
      message: "the same record is corrected or deleted twice in this message",
    })),

  "V2-023": (ctx) =>
    ctx.bodies.length > 0 || ctx.messageTypeIndic === "CARF703"
      ? []
      : [
          {
            element: ctx.messageSpec ?? ctx.root,
            message: "the message has no CARF body and is not a nil report (CARF703)",
          },
        ],

  "V2-024": (ctx) => {
    if (ctx.messageTypeIndic !== "CARF702") {
      return [];
    }
    const findings: RawFinding[] = [];
    for (const body of ctx.bodies) {
      const records = ctx.records.filter((r) => r.body === body);
      const rcasp = records.find((r) => r.kind === "RCASP");
      // OECD1 anywhere is V2-001; OECD0 on a user is V2-021. Only the remaining pairings are checked here.
      const users = records.filter(
        (r) =>
          r.kind === "CryptoUsers" &&
          (r.docSpec.baseIndic === "OECD2" || r.docSpec.baseIndic === "OECD3"),
      );
      const indic = rcasp?.docSpec.baseIndic;
      if (rcasp === undefined) {
        continue;
      }
      if (indic === "OECD3") {
        for (const user of users.filter((u) => u.docSpec.baseIndic === "OECD2")) {
          findings.push({
            element: indicElement(user),
            message: "a crypto-asset user is corrected (OECD2) while its RCASP is deleted (OECD3)",
          });
        }
      } else if (
        indic === "OECD0" &&
        records.filter((r) => r.kind === "CryptoUsers").length === 0
      ) {
        findings.push({
          element: indicElement(rcasp),
          message:
            "an RCASP is resent (OECD0) in a correction message without any corrected or deleted crypto-asset user",
        });
      }
    }
    return findings;
  },

  "V2-025": (ctx) => {
    const periods =
      ctx.messageSpec === undefined ? [] : childrenNamed(ctx.messageSpec, "ReportingPeriod");
    return periods
      .slice(1)
      .map((element) => ({ element, message: "the message has more than one reporting period" }));
  },

  "V2-026": (ctx, options) => {
    const format = options.docRefIdFormat;
    if (format === undefined) {
      return {
        status: "configuration_required",
        note: "the DocRefId format of the receiving jurisdiction was not given",
      };
    }
    const matches = (id: string): boolean =>
      typeof format === "function" ? format(id) : format.test(id);
    return ctx.records
      .filter((r) => r.docSpec.docRefId !== undefined && !matches(r.docSpec.docRefId))
      .map((r) => {
        const docSpec = r.docSpec.element;
        return {
          element: (docSpec === undefined ? undefined : childNamed(docSpec, "DocRefId")) ?? at(r),
          message: "the document reference ID (DocRefId) does not have the required format",
        };
      });
  },
};
