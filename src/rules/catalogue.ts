// The message-level business rules (V2) and their official Status Message error codes.
// Codes and descriptions: CARF Status Message XML Schema User Guide (June 2025), part 4,
// "Record Validations" (pp. 28–29). Rules that need earlier filings (e.g. "DocRefID already
// used" across messages, code 80000) cannot be checked from one message and are not here.

export interface RuleSource {
  /** Source identifier used in this package's documentation. */
  readonly id: "OECD-CARF-STATUS-2025-06" | "OECD-CARF-XML-2025-07";
  /** Printed page number(s) in that document. */
  readonly pages: string;
}

export const SOURCE_TITLES: Readonly<Record<RuleSource["id"], string>> = {
  "OECD-CARF-STATUS-2025-06":
    "OECD, Crypto-Asset Reporting Framework Status Message XML Schema: User Guide for Tax Administrations (June 2025)",
  "OECD-CARF-XML-2025-07":
    "OECD, Crypto-Asset Reporting Framework XML Schema: User Guide for Tax Administrations, version 2.0 (July 2025)",
};

export const RULE_IDS = [
  "V2-001",
  "V2-002",
  "V2-003",
  "V2-004",
  "V2-005",
  "V2-006",
  "V2-007",
  "V2-008",
  "V2-009",
  "V2-010",
  "V2-011",
  "V2-012",
  "V2-013",
  "V2-014",
  "V2-015",
  "V2-016",
  "V2-017",
  "V2-018",
  "V2-019",
  "V2-020",
  "V2-021",
  "V2-022",
  "V2-023",
  "V2-024",
  "V2-025",
  "V2-026",
] as const;
export type RuleId = (typeof RULE_IDS)[number];

export interface RuleDefinition {
  readonly id: RuleId;
  /** Official Status Message record error code, where one exists. */
  readonly officialCode?: string;
  readonly check: string;
  readonly fixHint: string;
  readonly sources: readonly RuleSource[];
  /**
   * Compares ResCountryCode values with the message's sending or receiving country. How these
   * apply to domestic reporting is for the jurisdiction to decide, so callers can disable them.
   */
  readonly countryCheck?: true;
}

const SM = (pages: string): RuleSource => ({ id: "OECD-CARF-STATUS-2025-06", pages });
const UG = (pages: string): RuleSource => ({ id: "OECD-CARF-XML-2025-07", pages });

export const RULES: Readonly<Record<RuleId, RuleDefinition>> = {
  "V2-001": {
    id: "V2-001",
    officialCode: "80010",
    check: "A CARF702 (correction) message contains no OECD1 (new data) record.",
    fixHint: "Send new records in a separate CARF701 message.",
    sources: [SM("29"), UG("9, 29")],
  },
  "V2-002": {
    id: "V2-002",
    officialCode: "80005",
    check: "Every OECD2 (correction) or OECD3 (deletion) record has a CorrDocRefId.",
    fixHint:
      "Set CorrDocRefId to the DocRefId of the latest version of the record being corrected or deleted.",
    sources: [SM("28"), UG("30")],
  },
  "V2-003": {
    id: "V2-003",
    officialCode: "80000",
    check: "Every DocRefId is unique within the message.",
    fixHint: "Give every record its own DocRefId; DocRefIds must be unique in space and time.",
    sources: [SM("28"), UG("30")],
  },
  "V2-004": {
    id: "V2-004",
    check: 'MessageType is "CARF".',
    fixHint: 'Set MessageType to "CARF".',
    sources: [UG("8")],
  },
  "V2-005": {
    id: "V2-005",
    check: "ReportingPeriod is the last day of the reporting period the message is for.",
    fixHint: "Set ReportingPeriod to the last day of the reporting period, e.g. 2027-12-31.",
    sources: [UG("9")],
  },
  "V2-006": {
    id: "V2-006",
    check: "Timestamp has the format YYYY-MM-DDThh:mm:ss, optionally with 3-digit milliseconds.",
    fixHint: "Write the timestamp as e.g. 2027-03-15T09:45:30 or 2027-03-15T09:45:30.789.",
    sources: [UG("9")],
  },
  "V2-007": {
    id: "V2-007",
    officialCode: "80010",
    check: "A CARF701 (new data) message contains no OECD2 or OECD3 record.",
    fixHint: "Send corrections and deletions in a separate CARF702 message.",
    sources: [SM("29"), UG("29")],
  },
  "V2-008": {
    id: "V2-008",
    officialCode: "60001",
    check: "Every Amount is greater than or equal to zero.",
    fixHint: "Report the amount as zero or a positive value.",
    sources: [SM("28")],
  },
  "V2-009": {
    id: "V2-009",
    officialCode: "60002",
    check: "An individual crypto-asset user has no ControllingPerson.",
    fixHint: "Remove the controlling persons: they are reported only for entity users.",
    sources: [SM("28")],
  },
  "V2-010": {
    id: "V2-010",
    officialCode: "60003",
    check:
      "An individual crypto-asset user and every controlling person have at least one ResCountryCode equal to the ReceivingCountry.",
    fixHint: "Check the person's residence countries and which jurisdiction the message is for.",
    sources: [SM("28")],
    countryCheck: true,
  },
  "V2-011": {
    id: "V2-011",
    officialCode: "60004",
    check:
      "For an entity crypto-asset user, the entity or one of its controlling persons has a ResCountryCode equal to the ReceivingCountry.",
    fixHint:
      "Check the entity's and controlling persons' residence countries and which jurisdiction the message is for.",
    sources: [SM("28")],
    countryCheck: true,
  },
  "V2-012": {
    id: "V2-012",
    officialCode: "60005",
    check: "Every ResCountryCode of the RCASP equals the sending country (TransmittingCountry).",
    fixHint:
      "The RCASP's residence country is the sending jurisdiction where it has its reporting nexus.",
    sources: [SM("28"), UG("10, 14")],
    countryCheck: true,
  },
  "V2-013": {
    id: "V2-013",
    officialCode: "60006",
    check: "OtherNexus/@ResCountryCode equals the ReceivingCountry.",
    fixHint: "Check the OtherNexus country and which jurisdiction the message is for.",
    sources: [SM("28")],
    countryCheck: true,
  },
  "V2-014": {
    id: "V2-014",
    officialCode: "60007",
    check: "Every BirthDate is not before 1900-01-01 and not after the ReportingPeriod.",
    fixHint: "Correct the date of birth.",
    sources: [SM("28")],
  },
  "V2-015": {
    id: "V2-015",
    officialCode: "60008",
    check: 'A TIN flagged unknown has the value "NOTIN".',
    fixHint: 'When the TIN is unknown, write "NOTIN" with unknown="true".',
    sources: [SM("28"), UG("10, 14")],
  },
  "V2-016": {
    id: "V2-016",
    officialCode: "60009",
    check: "An individual RCASP's BirthDate is 1900-01-01.",
    fixHint: "Use 1900-01-01, the default birth date for individual RCASPs.",
    sources: [SM("28"), UG("16")],
  },
  "V2-017": {
    id: "V2-017",
    officialCode: "60010",
    check: "OtherNexus/@Nexus is equal or inferior to Nexus (same or lower code), or is CARF906.",
    fixHint: "OtherNexus shows an equivalent or stronger nexus in another jurisdiction.",
    sources: [SM("28"), UG("18–19")],
  },
  "V2-018": {
    id: "V2-018",
    officialCode: "60011",
    check: "In a CARF701 message, every CARF body has CryptoUsers unless its RCASP has OtherNexus.",
    fixHint:
      "Add the crypto-asset users, or use OtherNexus if reporting takes place in another jurisdiction.",
    sources: [SM("28")],
  },
  "V2-019": {
    id: "V2-019",
    officialCode: "80004",
    check: "An OECD1 (new data) record has no CorrDocRefId.",
    fixHint: "Remove CorrDocRefId from new records.",
    sources: [SM("28")],
  },
  "V2-020": {
    id: "V2-020",
    officialCode: "80006",
    check: "No DocSpec has a CorrMessageRefId.",
    fixHint: "Remove CorrMessageRefId: it is not used in CARF.",
    sources: [SM("28–29")],
  },
  "V2-021": {
    id: "V2-021",
    officialCode: "80008",
    check: "OECD0 (resend) is used only on the RCASP record.",
    fixHint: "Use OECD0 only for an RCASP record that was already sent.",
    sources: [SM("29"), UG("29")],
  },
  "V2-022": {
    id: "V2-022",
    officialCode: "80011",
    check: "The same DocRefId is not corrected or deleted twice in one message.",
    fixHint: "Correct or delete each record once per message.",
    sources: [SM("29")],
  },
  "V2-023": {
    id: "V2-023",
    officialCode: "80015",
    check: "CARFBody is omitted only when MessageTypeIndic is CARF703 (nil report).",
    fixHint: "Add the CARF body, or use CARF703 for a message with no data to report.",
    sources: [SM("29"), UG("9")],
  },
  "V2-024": {
    id: "V2-024",
    check:
      "In a CARF702 message the DocTypeIndic of the RCASP and its CryptoUsers form a permitted combination: RCASP OECD2 with no CryptoUsers or CryptoUsers OECD2/OECD3; RCASP OECD3 with no CryptoUsers or CryptoUsers OECD3; RCASP OECD0 with CryptoUsers OECD2/OECD3.",
    fixHint:
      "Use one of the permitted combinations; an RCASP cannot be deleted without deleting its crypto-asset users.",
    sources: [UG("29–30")],
  },
  "V2-025": {
    id: "V2-025",
    officialCode: "80012",
    check: "The message holds data for one reporting period only (one ReportingPeriod).",
    fixHint: "Send each reporting period in its own message.",
    sources: [SM("29")],
  },
  "V2-026": {
    id: "V2-026",
    officialCode: "80001",
    check: "Every DocRefId has the format the receiving jurisdiction requires.",
    fixHint: "Build DocRefIds in the format your jurisdiction requires.",
    sources: [SM("28"), UG("30–31")],
  },
};
