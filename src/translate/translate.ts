// Turns validator output into readable errors that name the record and the field. V1 errors
// come from XSD validation (xmllint messages); V2 errors from the business rules. The original
// validator text is kept in `raw`. Values are repeated only for code lists (e.g. an invalid
// currency code); free-text and date values can be personal data and are never repeated.
import type { RuleId } from "../rules/catalogue.js";
import type { BusinessRuleFinding } from "../rules/business-rules.js";
import { enclosingRecord, recordRefOf } from "../rules/context.js";
import type { SchemaIssue } from "../validate/schema-validator.js";
import { allElements, parseXml, XmlParseError, type XmlElement } from "../xml/tree.js";
import { attributeLabel, elementLabel } from "./labels.js";

export type V1Code =
  | "XML_NOT_WELL_FORMED"
  | "XSD_WRONG_ROOT"
  | "XSD_UNEXPECTED_ELEMENT"
  | "XSD_MISSING_ELEMENT"
  | "XSD_INVALID_CODE"
  | "XSD_INVALID_LENGTH"
  | "XSD_INVALID_VALUE"
  | "XSD_UNEXPECTED_TEXT"
  | "XSD_MISSING_ATTRIBUTE"
  | "XSD_UNKNOWN_ATTRIBUTE"
  | "XSD_ERROR";

export interface TranslatedError {
  readonly layer: "V1" | "V2";
  readonly code: V1Code | RuleId;
  readonly officialCode?: string;
  readonly severity: "error";
  readonly line?: number;
  readonly xpath?: string;
  readonly element?: string;
  /** DocRefId of the RCASP or CryptoUsers record, when the error is inside one. */
  readonly recordRef?: string;
  readonly humanMessage: string;
  readonly fixHint: string;
  /** The validator's own message. */
  readonly raw?: string;
}

const TYPE_NAMES: Readonly<Record<string, string>> = {
  "xs:date": "a date (YYYY-MM-DD)",
  "xs:dateTime": "a date and time (YYYY-MM-DDThh:mm:ss)",
  "xs:decimal": "a decimal number",
  "xs:integer": "a whole number",
  "xs:boolean": 'true or false ("true", "false", "1" or "0")',
};

function expectedNames(list: string): string[] {
  return list
    .split(",")
    .map((item) => item.trim().replace(/^\{[^}]*\}/, ""))
    .filter((item) => item !== "");
}

/** Labels for element names expected under `parentPath` (so "City" under AddressFix is "city"). */
function orList(names: readonly string[], parentPath: string | undefined): string {
  const labels = names.map((name) =>
    elementLabel(parentPath === undefined ? name : `${parentPath}/${name}`),
  );
  if (labels.length <= 1) {
    return labels.join("");
  }
  return `${labels.slice(0, -1).join(", ")} or ${labels.at(-1) ?? ""}`;
}

function locate(tree: XmlElement | undefined, issue: SchemaIssue): XmlElement | undefined {
  if (tree === undefined || issue.element === undefined) {
    return undefined;
  }
  const candidates = allElements(tree).filter((element) => element.name === issue.element);
  return (
    candidates.find((element) => element.line === issue.line) ??
    candidates.filter((element) => element.line <= issue.line).at(-1)
  );
}

interface Described {
  readonly code: V1Code;
  readonly message: string;
  readonly fixHint: string;
}

function describe(issue: SchemaIssue, subject: string, element: XmlElement | undefined): Described {
  const text = issue.message;
  const attribute = /^Element '[^']+', attribute '([^']+)':/.exec(text)?.[1];
  const target = attribute === undefined ? subject : `${attributeLabel(attribute)} of ${subject}`;
  let match: RegExpExecArray | null;
  if (
    (match = /This element is not expected\.(?: Expected is (?:one of )?\( (.+) \)\.)?/.exec(
      text,
    )) !== null
  ) {
    const expected = match[1] === undefined ? [] : expectedNames(match[1]);
    return {
      code: "XSD_UNEXPECTED_ELEMENT",
      message:
        expected.length === 0
          ? `${subject} is not allowed here`
          : `${subject} is not allowed here; expected ${orList(expected, element?.parent?.path)}`,
      fixHint: "Check the order and nesting of elements against the CARF XML Schema.",
    };
  }
  if (
    (match = /Missing child element\(s\)\. Expected is (?:one of )?\( (.+) \)\./.exec(text)) !==
    null
  ) {
    return {
      code: "XSD_MISSING_ELEMENT",
      message: `${subject} is missing ${orList(expectedNames(match[1] ?? ""), element?.path)}`,
      fixHint: "Add the missing element; it is required by the CARF XML Schema.",
    };
  }
  if (
    (match = /\[facet 'enumeration'\] The value '([^']*)' is not an element of the set/.exec(
      text,
    )) !== null
  ) {
    return {
      code: "XSD_INVALID_CODE",
      message: `${target} has the value '${match[1] ?? ""}', which is not an allowed code`,
      fixHint: "Use one of the codes listed in the CARF XML Schema for this field.",
    };
  }
  if (
    (match =
      /\[facet '(minLength|maxLength|length)'\].*of '(\d+)'; this (underruns|exceeds) the allowed \w+ length of '(\d+)'/.exec(
        text,
      )) !== null
  ) {
    const tooShort = match[3] === "underruns";
    return {
      code: "XSD_INVALID_LENGTH",
      message: `${target} is too ${tooShort ? "short" : "long"} (${match[2] ?? ""} characters; ${tooShort ? "minimum" : "maximum"} ${match[4] ?? ""})`,
      fixHint: tooShort
        ? "Fill in the field or leave the element out if it is optional."
        : "Shorten the value.",
    };
  }
  if (
    (match = /is not a valid value of the (?:local )?atomic type(?: '([^']+)')?/.exec(text)) !==
    null
  ) {
    const type = match[1] === undefined ? undefined : TYPE_NAMES[match[1]];
    return {
      code: "XSD_INVALID_VALUE",
      message:
        type === undefined
          ? `${target} has a value the schema does not allow`
          : `${target} is not ${type}`,
      fixHint: "Correct the value to the format the CARF XML Schema requires.",
    };
  }
  if (/Character content other than whitespace is not allowed/.test(text)) {
    return {
      code: "XSD_UNEXPECTED_TEXT",
      message: `${subject} contains text, but only child elements are allowed`,
      fixHint: "Remove the text or move it into the right child element.",
    };
  }
  if ((match = /The attribute '([^']+)' is required but missing/.exec(text)) !== null) {
    return {
      code: "XSD_MISSING_ATTRIBUTE",
      message: `${subject} is missing its ${attributeLabel(match[1] ?? "")}`,
      fixHint: "Add the required attribute.",
    };
  }
  if ((match = /The attribute '([^']+)' is not allowed/.exec(text)) !== null) {
    return {
      code: "XSD_UNKNOWN_ATTRIBUTE",
      message: `${subject} has an attribute '${match[1] ?? ""}' that the schema does not allow`,
      fixHint: "Remove the attribute.",
    };
  }
  if (/No matching global declaration available for the validation root/.test(text)) {
    return {
      code: "XSD_WRONG_ROOT",
      message:
        "The file is not a CARF message: its root element is not CARF_OECD in namespace urn:oecd:ties:carf:v1",
      fixHint: "Check that this is a CARF XML file and that it uses the CARF namespace.",
    };
  }
  return {
    code: "XSD_ERROR",
    message: `${subject} does not match the CARF XML Schema`,
    fixHint: "See the validator message for details.",
  };
}

function prefixRecord(element: XmlElement | undefined, message: string): string {
  if (element === undefined) {
    return `${message.charAt(0).toUpperCase()}${message.slice(1)}.`;
  }
  const record = enclosingRecord(element);
  const ref = recordRefOf(element);
  if (record === undefined) {
    return `${message.charAt(0).toUpperCase()}${message.slice(1)}.`;
  }
  const kind = record.name === "RCASP" ? "RCASP record" : "Crypto-asset user record";
  return `${ref === undefined ? kind : `${kind} ${ref}`}: ${message}.`;
}

/** Translates XSD validation issues. `xml` is the validated document, used to find each element. */
export function translateSchemaIssues(
  issues: readonly SchemaIssue[],
  xml: string | Uint8Array,
): TranslatedError[] {
  let tree: XmlElement | undefined;
  try {
    tree = parseXml(xml);
  } catch (error) {
    if (!(error instanceof XmlParseError)) {
      throw error;
    }
  }
  return issues.map((issue) => {
    if (issue.kind === "xml") {
      return {
        layer: "V1",
        code: "XML_NOT_WELL_FORMED",
        severity: "error",
        line: issue.line,
        humanMessage: `The file is not well-formed XML (line ${String(issue.line)}): ${issue.message}.`,
        fixHint: "Fix the XML syntax, e.g. unclosed tags or unescaped characters such as &.",
        raw: issue.message,
      };
    }
    const element = locate(tree, issue);
    const subject = elementLabel(element?.path ?? issue.element ?? "element");
    const described = describe(issue, subject, element);
    const recordRef = element === undefined ? undefined : recordRefOf(element);
    const humanMessage =
      described.code === "XSD_WRONG_ROOT"
        ? `${described.message}.`
        : prefixRecord(element, described.message);
    return {
      layer: "V1",
      code: described.code,
      severity: "error",
      line: issue.line,
      ...(element === undefined ? {} : { xpath: element.xpath }),
      ...(issue.element === undefined ? {} : { element: issue.element }),
      ...(recordRef === undefined ? {} : { recordRef }),
      humanMessage,
      fixHint: described.fixHint,
      raw: issue.message,
    };
  });
}

/** Business-rule findings in the same shape as translated XSD errors. */
export function translateBusinessFindings(
  findings: readonly BusinessRuleFinding[],
): TranslatedError[] {
  return findings.map((finding) => ({
    layer: "V2",
    code: finding.ruleId,
    ...(finding.officialCode === undefined ? {} : { officialCode: finding.officialCode }),
    severity: finding.severity,
    line: finding.line,
    xpath: finding.xpath,
    element: finding.element,
    ...(finding.recordRef === undefined ? {} : { recordRef: finding.recordRef }),
    humanMessage: finding.humanMessage,
    fixHint: finding.fixHint,
  }));
}
