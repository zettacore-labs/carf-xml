import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { checkBusinessRules, type BusinessRulesOptions } from "./business-rules.js";
import { RULE_IDS, RULES, type RuleId } from "./catalogue.js";
import { baseDocTypeIndic } from "./context.js";

const golden = (name: string): string =>
  readFileSync(join(import.meta.dirname, "../../test/golden", name, "expected.xml"), "utf8");

/** Replaces the first occurrence (or all, with a regex) and fails loudly if nothing matched. */
function edit(xml: string, from: string | RegExp, to: string): string {
  const next = xml.replace(from, to);
  if (next === xml) {
    throw new Error(`fixture edit did not match: ${String(from)}`);
  }
  return next;
}

function failures(xml: string, options?: BusinessRulesOptions) {
  return checkBusinessRules(xml, options).findings;
}

function only(xml: string, rule: RuleId, options?: BusinessRulesOptions) {
  return failures(xml, options).filter((f) => f.ruleId === rule);
}

const NEW = golden("new-data");
const CORRECTION = golden("correction");
const DELETION = golden("deletion");
const MULTI = golden("multiple-residencies");

describe("catalogue", () => {
  it("defines every rule once, with sources and official codes in the 60000/80000 ranges", () => {
    expect(RULE_IDS).toHaveLength(26);
    for (const id of RULE_IDS) {
      const rule = RULES[id];
      expect(rule.id).toBe(id);
      expect(rule.sources.length).toBeGreaterThan(0);
      if (rule.officialCode !== undefined) {
        expect(rule.officialCode).toMatch(/^[68]\d{4}$/);
      }
    }
    expect(RULE_IDS.filter((id) => RULES[id].countryCheck === true)).toEqual([
      "V2-010",
      "V2-011",
      "V2-012",
      "V2-013",
    ]);
  });

  it("maps test DocTypeIndic codes to their meaning", () => {
    expect(baseDocTypeIndic("OECD11")).toBe("OECD1");
    expect(baseDocTypeIndic("OECD2")).toBe("OECD2");
    expect(baseDocTypeIndic(undefined)).toBeUndefined();
  });
});

describe("golden messages pass", () => {
  it.each([
    "new-data",
    "all-categories",
    "multiple-residencies",
    "correction",
    "deletion",
    "nil-rcasp-only",
    "nil-no-body",
  ])("%s", (name) => {
    const result = checkBusinessRules(golden(name));
    expect(result.findings).toEqual([]);
    expect(result.rules.find((r) => r.ruleId === "V2-026")).toEqual({
      ruleId: "V2-026",
      status: "configuration_required",
      note: "the DocRefId format of the receiving jurisdiction was not given",
    });
    expect(result.rules.find((r) => r.ruleId === "V2-005")?.status).toBe("not_checked");
  });
});

describe("each rule fails where it should", () => {
  interface Case {
    readonly rule: RuleId;
    readonly xml: string;
    readonly element: string;
    readonly options?: BusinessRulesOptions;
  }
  const tuples: readonly (readonly [RuleId, string, string, BusinessRulesOptions?])[] = [
    [
      "V2-001",
      edit(
        CORRECTION,
        "<stf:DocTypeIndic>OECD2</stf:DocTypeIndic>",
        "<stf:DocTypeIndic>OECD1</stf:DocTypeIndic>",
      ),
      "DocTypeIndic",
    ],
    [
      "V2-002",
      edit(CORRECTION, /\s*<stf:CorrDocRefId>GB2027-GOLDEN-U-0001<\/stf:CorrDocRefId>/, ""),
      "DocSpec",
    ],
    ["V2-003", edit(NEW, "GB2027-GOLDEN-U-0002", "GB2027-GOLDEN-U-0001"), "DocSpec"],
    [
      "V2-004",
      edit(
        NEW,
        "<carf:MessageType>CARF</carf:MessageType>",
        "<carf:MessageType>CRS</carf:MessageType>",
      ),
      "MessageType",
    ],
    ["V2-005", NEW, "ReportingPeriod", { expectedReportingPeriod: "2026-12-31" }],
    ["V2-006", edit(NEW, "2028-03-01T09:00:00", "2028-03-01T09:00:00Z"), "Timestamp"],
    [
      "V2-007",
      edit(
        NEW,
        "<stf:DocTypeIndic>OECD1</stf:DocTypeIndic>",
        "<stf:DocTypeIndic>OECD2</stf:DocTypeIndic>",
      ),
      "DocTypeIndic",
    ],
    ["V2-008", edit(NEW, ">4200.10<", ">-4200.10<"), "Amount"],
    [
      "V2-009",
      edit(
        NEW,
        /(<\/carf:UserID>)(\s*<carf:RelevantTransactions>)/,
        "$1<carf:ControllingPerson/>$2",
      ),
      "ControllingPerson",
    ],
    [
      "V2-010",
      edit(
        NEW,
        '<carf:ResCountryCode>FR</carf:ResCountryCode>\n          <carf:TIN issuedBy="FR">TEST-TIN-FR-0001',
        '<carf:ResCountryCode>DE</carf:ResCountryCode>\n          <carf:TIN issuedBy="FR">TEST-TIN-FR-0001',
      ),
      "Individual",
    ],
    [
      "V2-011",
      edit(
        edit(NEW, /(<carf:Entity>\s*<carf:ResCountryCode>)FR/, "$1DE"),
        /(<carf:ControllingPerson>\s*<carf:Individual>\s*<carf:ResCountryCode>)FR/,
        "$1DE",
      ),
      "Entity",
    ],
    [
      "V2-012",
      edit(
        NEW,
        "<carf:TransmittingCountry>GB</carf:TransmittingCountry>",
        "<carf:TransmittingCountry>IE</carf:TransmittingCountry>",
      ),
      "ResCountryCode",
    ],
    [
      "V2-013",
      edit(
        NEW,
        "<carf:Nexus>CARF901</carf:Nexus>",
        '<carf:Nexus>CARF901</carf:Nexus><carf:OtherNexus Nexus="CARF901" ResCountryCode="DE"/>',
      ),
      "OtherNexus",
    ],
    ["V2-014", edit(NEW, "1985-06-15", "1899-12-31"), "BirthDate"],
    [
      "V2-015",
      edit(
        MULTI,
        '<carf:TIN unknown="true">NOTIN</carf:TIN>',
        '<carf:TIN unknown="1">UNKNOWN</carf:TIN>',
      ),
      "TIN",
    ],
    [
      "V2-017",
      edit(
        NEW,
        "<carf:Nexus>CARF901</carf:Nexus>",
        '<carf:Nexus>CARF901</carf:Nexus><carf:OtherNexus Nexus="CARF904" ResCountryCode="FR"/>',
      ),
      "OtherNexus",
    ],
    ["V2-018", edit(golden("nil-rcasp-only"), "CARF703", "CARF701"), "RCASP"],
    [
      "V2-019",
      edit(
        NEW,
        "<stf:DocRefId>GB2027-GOLDEN-U-0001</stf:DocRefId>",
        "<stf:DocRefId>GB2027-GOLDEN-U-0001</stf:DocRefId><stf:CorrDocRefId>X</stf:CorrDocRefId>",
      ),
      "DocSpec",
    ],
    [
      "V2-020",
      edit(
        NEW,
        "<stf:DocRefId>GB2027-GOLDEN-U-0001</stf:DocRefId>",
        "<stf:DocRefId>GB2027-GOLDEN-U-0001</stf:DocRefId><stf:CorrMessageRefId>M</stf:CorrMessageRefId>",
      ),
      "DocSpec",
    ],
    [
      "V2-021",
      edit(
        CORRECTION,
        "<stf:DocTypeIndic>OECD2</stf:DocTypeIndic>",
        "<stf:DocTypeIndic>OECD0</stf:DocTypeIndic>",
      ),
      "DocTypeIndic",
    ],
    [
      "V2-022",
      edit(
        DELETION,
        "<stf:CorrDocRefId>GB2027-GOLDEN-U-0005</stf:CorrDocRefId>",
        "<stf:CorrDocRefId>GB2027-GOLDEN-U-0004</stf:CorrDocRefId>",
      ),
      "DocSpec",
    ],
    ["V2-023", edit(golden("nil-no-body"), "CARF703", "CARF701"), "MessageSpec"],
    [
      "V2-024",
      edit(DELETION, /(<carf:CryptoUsers>[\s\S]*?<stf:DocTypeIndic>)OECD3/, "$1OECD2"),
      "DocTypeIndic",
    ],
    [
      "V2-025",
      edit(
        NEW,
        "<carf:Timestamp>",
        "<carf:ReportingPeriod>2028-12-31</carf:ReportingPeriod><carf:Timestamp>",
      ),
      "ReportingPeriod",
    ],
    ["V2-026", NEW, "DocRefId", { docRefIdFormat: /^FR/g }],
  ];

  const cases: readonly Case[] = tuples.map(([rule, xml, element, options]) =>
    options === undefined ? { rule, xml, element } : { rule, xml, element, options },
  );

  it.each(cases)("$rule", ({ rule, xml, element, options }) => {
    const found = only(xml, rule, options);
    expect(found.length).toBeGreaterThan(0);
    const first = found[0];
    expect(first?.element).toBe(element);
    expect(first?.officialCode).toBe(RULES[rule].officialCode);
    expect(first?.humanMessage.endsWith(".")).toBe(true);
    expect(first?.line).toBeGreaterThan(0);
    expect(first?.xpath.startsWith("/CARF_OECD")).toBe(true);
    expect(first?.fixHint).toBe(RULES[rule].fixHint);
  });

  it("V2-016: an individual RCASP's birth date must be 1900-01-01", () => {
    const xml = edit(
      NEW,
      /<carf:RCASP_ID>[\s\S]*?<\/carf:RCASP_ID>/,
      `<carf:RCASP_ID><carf:Individual><carf:ResCountryCode>GB</carf:ResCountryCode><carf:TIN issuedBy="GB">T</carf:TIN><carf:Name><carf:FirstName>A</carf:FirstName><carf:LastName>B</carf:LastName></carf:Name><carf:Address><carf:CountryCode>GB</carf:CountryCode><carf:AddressFix><carf:City>C</carf:City></carf:AddressFix></carf:Address><carf:BirthInfo><carf:BirthDate>1980-01-01</carf:BirthDate></carf:BirthInfo></carf:Individual></carf:RCASP_ID>`,
    );
    expect(only(xml, "V2-016")[0]?.humanMessage).toBe(
      "RCASP record GB2027-GOLDEN-R-0001: the birth date of an individual RCASP is not 1900-01-01.",
    );
    expect(only(edit(xml, "1980-01-01", "1900-01-01"), "V2-016")).toEqual([]);
  });
});

describe("rule details", () => {
  it("V2-017 accepts an equal or stronger other nexus and CARF906, and flags a missing nexus", () => {
    const withOther = (other: string, nexus = "<carf:Nexus>CARF904</carf:Nexus>") =>
      edit(
        NEW,
        "<carf:Nexus>CARF901</carf:Nexus>",
        `${nexus}<carf:OtherNexus Nexus="${other}" ResCountryCode="FR"/>`,
      );
    expect(only(withOther("CARF904"), "V2-017")).toEqual([]);
    expect(only(withOther("CARF901"), "V2-017")).toEqual([]);
    expect(only(withOther("CARF906"), "V2-017")).toEqual([]);
    expect(only(withOther("CARF905"), "V2-017")).toHaveLength(1);
    expect(only(withOther("CARF901", ""), "V2-017")[0]?.humanMessage).toContain(
      "no nexus to compare",
    );
  });

  it("V2-018 accepts a CARF701 body without users when the RCASP has an other nexus", () => {
    const xml = edit(
      edit(golden("nil-rcasp-only"), "CARF703", "CARF701"),
      "<carf:Nexus>CARF901</carf:Nexus>",
      '<carf:Nexus>CARF901</carf:Nexus><carf:OtherNexus Nexus="CARF901" ResCountryCode="GB"/>',
    );
    expect(only(xml, "V2-018")).toEqual([]);
  });

  it("V2-024 needs a user in a correction that resends the RCASP", () => {
    const xml = edit(CORRECTION, /<carf:CryptoUsers>[\s\S]*<\/carf:CryptoUsers>/, "");
    expect(only(xml, "V2-024")[0]?.humanMessage).toContain("resent (OECD0)");
  });

  it("the country checks can be switched off", () => {
    const xml = edit(
      NEW,
      "<carf:TransmittingCountry>GB</carf:TransmittingCountry>",
      "<carf:TransmittingCountry>IE</carf:TransmittingCountry>",
    );
    const result = checkBusinessRules(xml, {
      disabledRules: ["V2-010", "V2-011", "V2-012", "V2-013"],
    });
    expect(result.findings).toEqual([]);
    expect(result.rules.filter((r) => r.status === "disabled").map((r) => r.ruleId)).toEqual([
      "V2-010",
      "V2-011",
      "V2-012",
      "V2-013",
    ]);
  });

  it("V2-026 accepts a matching format, as a regex or a function", () => {
    expect(only(NEW, "V2-026", { docRefIdFormat: /^GB2027-/g })).toEqual([]);
    expect(only(NEW, "V2-026", { docRefIdFormat: (id) => id.length < 5 })).toHaveLength(3);
  });

  it("names the record and passes V2-005 when the period matches", () => {
    expect(only(NEW, "V2-005", { expectedReportingPeriod: "2027-12-31" })).toEqual([]);
    const finding = only(edit(NEW, ">4200.10<", ">-4200.10<"), "V2-008")[0];
    expect(finding?.recordRef).toBe("GB2027-GOLDEN-U-0001");
    expect(finding?.humanMessage).toBe(
      "Crypto-asset user record GB2027-GOLDEN-U-0001: the amount is negative.",
    );
  });

  it("runs on a message missing its header and bodies", () => {
    const result = checkBusinessRules('<carf:CARF_OECD xmlns:carf="urn:oecd:ties:carf:v1"/>');
    expect(result.findings.map((f) => f.ruleId)).toEqual(["V2-023"]);
    expect(result.findings[0]?.humanMessage).toBe(
      "The message has no CARF body and is not a nil report (CARF703).",
    );
  });

  it("tolerates records without a DocSpec or party", () => {
    const xml =
      '<carf:CARF_OECD xmlns:carf="urn:oecd:ties:carf:v1"><carf:MessageSpec><carf:MessageTypeIndic>CARF701</carf:MessageTypeIndic><carf:ReceivingCountry>FR</carf:ReceivingCountry><carf:TransmittingCountry>GB</carf:TransmittingCountry></carf:MessageSpec><carf:CARFBody><carf:RCASP/><carf:CryptoUsers/></carf:CARFBody></carf:CARF_OECD>';
    expect(() => checkBusinessRules(xml)).not.toThrow();
  });
});
