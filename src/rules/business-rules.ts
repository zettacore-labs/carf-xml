// Runs the V2 business rules on a CARF message and reports each failure with the record it
// belongs to, the element's line and XPath, the official Status Message code and a fix hint.
import { parseXml, type XmlElement } from "../xml/tree.js";
import { RULE_IDS, RULES, type RuleDefinition, type RuleId, type RuleSource } from "./catalogue.js";
import { CHECKS, type CheckOptions } from "./checks.js";
import { buildContext, enclosingRecord, recordRefOf } from "./context.js";

export interface BusinessRulesOptions {
  /** Rules to skip, e.g. the country checks V2-010 to V2-013 where the jurisdiction does not apply them. */
  readonly disabledRules?: readonly RuleId[];
  /** V2-005: the last day of the reporting period the message should be for (YYYY-MM-DD). */
  readonly expectedReportingPeriod?: string;
  /** V2-026: the DocRefId format required by the receiving jurisdiction. */
  readonly docRefIdFormat?: RegExp | ((docRefId: string) => boolean);
}

export interface BusinessRuleFinding {
  readonly layer: "V2";
  readonly ruleId: RuleId;
  readonly officialCode?: string;
  readonly severity: "error";
  readonly line: number;
  readonly xpath: string;
  readonly element: string;
  /** DocRefId of the RCASP or CryptoUsers record the problem is in, when it can be read. */
  readonly recordRef?: string;
  readonly humanMessage: string;
  readonly fixHint: string;
  readonly sources: readonly RuleSource[];
}

export type RuleStatus =
  "passed" | "failed" | "disabled" | "not_checked" | "configuration_required";

export interface RuleResult {
  readonly ruleId: RuleId;
  readonly status: RuleStatus;
  readonly note?: string;
}

export interface BusinessRulesResult {
  readonly findings: readonly BusinessRuleFinding[];
  readonly rules: readonly RuleResult[];
}

function withoutStatefulFlags(
  format: BusinessRulesOptions["docRefIdFormat"],
): CheckOptions["docRefIdFormat"] {
  return format instanceof RegExp
    ? new RegExp(format.source, format.flags.replace(/[gy]/g, ""))
    : format;
}

function recordLabel(element: XmlElement): string | undefined {
  const record = enclosingRecord(element);
  const ref = recordRefOf(element);
  if (record === undefined) {
    return undefined;
  }
  const kind = record.name === "RCASP" ? "RCASP record" : "Crypto-asset user record";
  return ref === undefined ? kind : `${kind} ${ref}`;
}

function finding(rule: RuleDefinition, element: XmlElement, message: string): BusinessRuleFinding {
  const label = recordLabel(element);
  const sentence = `${message.charAt(0).toUpperCase()}${message.slice(1)}.`;
  const recordRef = recordRefOf(element);
  return {
    layer: "V2",
    ruleId: rule.id,
    ...(rule.officialCode === undefined ? {} : { officialCode: rule.officialCode }),
    severity: "error",
    line: element.line,
    xpath: element.xpath,
    element: element.name,
    ...(recordRef === undefined ? {} : { recordRef }),
    humanMessage: label === undefined ? sentence : `${label}: ${message}.`,
    fixHint: rule.fixHint,
    sources: rule.sources,
  };
}

/**
 * Checks a CARF message (XML text, bytes or a parsed tree) against the V2 rules. Works on files
 * that fail XSD validation too; rules skip elements that are missing.
 */
export function checkBusinessRules(
  message: string | Uint8Array | XmlElement,
  options: BusinessRulesOptions = {},
): BusinessRulesResult {
  const root =
    typeof message === "string" || message instanceof Uint8Array ? parseXml(message) : message;
  const ctx = buildContext(root);
  const disabled = new Set(options.disabledRules ?? []);
  const checkOptions: CheckOptions = {
    ...(options.expectedReportingPeriod === undefined
      ? {}
      : { expectedReportingPeriod: options.expectedReportingPeriod }),
    ...(options.docRefIdFormat === undefined
      ? {}
      : { docRefIdFormat: withoutStatefulFlags(options.docRefIdFormat) }),
  };
  const findings: BusinessRuleFinding[] = [];
  const rules: RuleResult[] = [];
  for (const id of RULE_IDS) {
    if (disabled.has(id)) {
      rules.push({ ruleId: id, status: "disabled" });
      continue;
    }
    const outcome = CHECKS[id](ctx, checkOptions);
    if ("status" in outcome) {
      rules.push({ ruleId: id, status: outcome.status, note: outcome.note });
      continue;
    }
    rules.push({ ruleId: id, status: outcome.length === 0 ? "passed" : "failed" });
    findings.push(...outcome.map((raw) => finding(RULES[id], raw.element, raw.message)));
  }
  return { findings, rules };
}
