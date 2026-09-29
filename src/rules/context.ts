// What the V2 rules read from a parsed CARF message: the message header and the correctable
// records (RCASP and CryptoUsers) with their DocSpec. Missing elements are tolerated, so the
// rules also run on files that fail XSD validation.
import { childNamed, childrenNamed, childText, type XmlElement } from "../xml/tree.js";

export interface DocSpecInfo {
  readonly element: XmlElement | undefined;
  readonly docTypeIndic: string | undefined;
  /** DocTypeIndic with test codes mapped to their meaning: OECD10–OECD13 → OECD0–OECD3. */
  readonly baseIndic: string | undefined;
  readonly docRefId: string | undefined;
  readonly corrDocRefId: string | undefined;
  readonly corrMessageRefId: string | undefined;
}

export interface RecordInfo {
  readonly kind: "RCASP" | "CryptoUsers";
  readonly element: XmlElement;
  readonly body: XmlElement;
  readonly docSpec: DocSpecInfo;
}

export interface MessageContext {
  readonly root: XmlElement;
  readonly messageSpec: XmlElement | undefined;
  readonly messageType: string | undefined;
  readonly messageTypeIndic: string | undefined;
  readonly transmittingCountry: string | undefined;
  readonly receivingCountry: string | undefined;
  readonly reportingPeriod: string | undefined;
  readonly bodies: readonly XmlElement[];
  readonly records: readonly RecordInfo[];
}

const TEST_INDIC = /^OECD1([0-3])$/;

/** OECD10–OECD13 (test data) carry the same meaning as OECD0–OECD3 for these rules. */
export function baseDocTypeIndic(code: string | undefined): string | undefined {
  const test = code === undefined ? null : TEST_INDIC.exec(code);
  return test === null ? code : `OECD${test[1] ?? ""}`;
}

function docSpecOf(record: XmlElement): DocSpecInfo {
  const element = childNamed(record, "DocSpec");
  const text = (name: string): string | undefined =>
    element === undefined ? undefined : childText(element, name);
  const docTypeIndic = text("DocTypeIndic");
  return {
    element,
    docTypeIndic,
    baseIndic: baseDocTypeIndic(docTypeIndic),
    docRefId: text("DocRefId"),
    corrDocRefId: text("CorrDocRefId"),
    corrMessageRefId: text("CorrMessageRefId"),
  };
}

export function buildContext(root: XmlElement): MessageContext {
  const messageSpec = childNamed(root, "MessageSpec");
  const spec = (name: string): string | undefined =>
    messageSpec === undefined ? undefined : childText(messageSpec, name);
  const bodies = childrenNamed(root, "CARFBody");
  const records: RecordInfo[] = [];
  for (const body of bodies) {
    for (const child of body.children) {
      if (child.name === "RCASP" || child.name === "CryptoUsers") {
        records.push({ kind: child.name, element: child, body, docSpec: docSpecOf(child) });
      }
    }
  }
  return {
    root,
    messageSpec,
    messageType: spec("MessageType"),
    messageTypeIndic: spec("MessageTypeIndic"),
    transmittingCountry: spec("TransmittingCountry"),
    receivingCountry: spec("ReceivingCountry"),
    reportingPeriod: spec("ReportingPeriod"),
    bodies,
    records,
  };
}

/** The Individual or Entity element under RCASP_ID or UserID. */
export function partyOf(record: XmlElement): XmlElement | undefined {
  const id = childNamed(record, record.name === "RCASP" ? "RCASP_ID" : "UserID");
  return id === undefined ? undefined : (childNamed(id, "Individual") ?? childNamed(id, "Entity"));
}

export function resCountryCodes(party: XmlElement | undefined): string[] {
  return party === undefined
    ? []
    : childrenNamed(party, "ResCountryCode").map((element) => element.text.trim());
}

/** The correctable record (RCASP or CryptoUsers) that contains `element`, if any. */
export function enclosingRecord(element: XmlElement): XmlElement | undefined {
  let current: XmlElement | undefined = element;
  while (current !== undefined) {
    if (current.name === "RCASP" || current.name === "CryptoUsers") {
      return current;
    }
    current = current.parent;
  }
  return undefined;
}

/** DocRefId of the record that contains `element`, used to name the record in messages. */
export function recordRefOf(element: XmlElement): string | undefined {
  const record = enclosingRecord(element);
  return record === undefined ? undefined : docSpecOf(record).docRefId;
}
