import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { checkBusinessRules } from "../rules/business-rules.js";
import type { SchemaIssue } from "../validate/schema-validator.js";
import { attributeLabel, elementLabel } from "./labels.js";
import { translateBusinessFindings, translateSchemaIssues } from "./translate.js";

const NEW = readFileSync(
  join(import.meta.dirname, "../../test/golden/new-data/expected.xml"),
  "utf8",
);
const lineOf = (text: string): number => NEW.slice(0, NEW.indexOf(text)).split("\n").length;

function schema(element: string, line: number, message: string): SchemaIssue {
  return { kind: "schema", element, line, message };
}

describe("labels", () => {
  it("uses the most specific path and falls back to the XML name", () => {
    expect(elementLabel("CARF_OECD/CARFBody/RCASP/RCASP_ID/Entity/Address/AddressFix/City")).toBe(
      "city",
    );
    expect(elementLabel("Individual/BirthInfo/BirthPlace/City")).toBe("city of birth");
    expect(elementLabel("Entity/Name")).toBe("legal name");
    expect(elementLabel("Individual/Name")).toBe("name");
    expect(elementLabel("AddressFix/Street")).toBe("Street");
    expect(elementLabel("TIN")).toBe("tax identification number (TIN)");
    expect(attributeLabel("currCode")).toBe("currency code");
    expect(attributeLabel("xnlNameType")).toBe("attribute xnlNameType");
  });
});

describe("translateSchemaIssues", () => {
  const userCityLine = lineOf("<carf:City>Paris</carf:City>");
  const amountLine = lineOf('currCode="EUR">4200.10');
  const cases: readonly (readonly [string, SchemaIssue, string, string])[] = [
    [
      "unexpected element with a list",
      schema(
        "Amount",
        amountLine,
        "Element '{urn:oecd:ties:carf:v1}Amount': This element is not expected. Expected is one of ( {urn:oecd:ties:carf:v1}ExchangeType, {urn:oecd:ties:carf:v1}NumberofTransactions ).",
      ),
      "XSD_UNEXPECTED_ELEMENT",
      "Crypto-asset user record GB2027-GOLDEN-U-0001: amount is not allowed here; expected exchange type or number of transactions.",
    ],
    [
      "unexpected element without a list",
      schema(
        "Amount",
        amountLine,
        "Element '{urn:oecd:ties:carf:v1}Amount': This element is not expected.",
      ),
      "XSD_UNEXPECTED_ELEMENT",
      "Crypto-asset user record GB2027-GOLDEN-U-0001: amount is not allowed here.",
    ],
    [
      "missing element",
      schema(
        "AddressFix",
        userCityLine - 2,
        "Element '{urn:oecd:ties:carf:v1}AddressFix': Missing child element(s). Expected is ( {urn:oecd:ties:carf:v1}City ).",
      ),
      "XSD_MISSING_ELEMENT",
      "Crypto-asset user record GB2027-GOLDEN-U-0001: address in fixed format is missing city.",
    ],
    [
      "invalid code in an attribute",
      schema(
        "Amount",
        amountLine,
        "Element '{urn:oecd:ties:carf:v1}Amount', attribute 'currCode': [facet 'enumeration'] The value 'EURO' is not an element of the set {'EUR'}.",
      ),
      "XSD_INVALID_CODE",
      "Crypto-asset user record GB2027-GOLDEN-U-0001: currency code of amount has the value 'EURO', which is not an allowed code.",
    ],
    [
      "too long",
      schema(
        "City",
        userCityLine,
        "Element '{urn:oecd:ties:carf:v1}City': [facet 'maxLength'] The value has a length of '201'; this exceeds the allowed maximum length of '200'.",
      ),
      "XSD_INVALID_LENGTH",
      "Crypto-asset user record GB2027-GOLDEN-U-0001: city is too long (201 characters; maximum 200).",
    ],
    [
      "too short",
      schema(
        "City",
        userCityLine,
        "Element '{urn:oecd:ties:carf:v1}City': [facet 'minLength'] The value has a length of '0'; this underruns the allowed minimum length of '1'.",
      ),
      "XSD_INVALID_LENGTH",
      "Crypto-asset user record GB2027-GOLDEN-U-0001: city is too short (0 characters; minimum 1).",
    ],
    [
      "invalid value of a known type, without repeating it",
      schema(
        "BirthDate",
        lineOf("<carf:BirthDate>1985-06-15"),
        "Element '{urn:oecd:ties:carf:v1}BirthDate': '1985-13-15' is not a valid value of the atomic type 'xs:date'.",
      ),
      "XSD_INVALID_VALUE",
      "Crypto-asset user record GB2027-GOLDEN-U-0001: date of birth is not a date (YYYY-MM-DD).",
    ],
    [
      "invalid value of another type",
      schema(
        "CryptoAsset",
        lineOf("<carf:CryptoAsset>BTC"),
        "Element '{urn:oecd:ties:carf:v1}CryptoAsset': 'x' is not a valid value of the local atomic type.",
      ),
      "XSD_INVALID_VALUE",
      "Crypto-asset user record GB2027-GOLDEN-U-0001: crypto-asset name has a value the schema does not allow.",
    ],
    [
      "text in element-only content",
      schema(
        "Address",
        userCityLine - 3,
        "Element '{urn:oecd:ties:carf:v1}Address': Character content other than whitespace is not allowed because the content type is 'element-only'.",
      ),
      "XSD_UNEXPECTED_TEXT",
      "Crypto-asset user record GB2027-GOLDEN-U-0001: address contains text, but only child elements are allowed.",
    ],
    [
      "missing attribute",
      schema(
        "Amount",
        amountLine,
        "Element '{urn:oecd:ties:carf:v1}Amount': The attribute 'currCode' is required but missing.",
      ),
      "XSD_MISSING_ATTRIBUTE",
      "Crypto-asset user record GB2027-GOLDEN-U-0001: amount is missing its currency code.",
    ],
    [
      "unknown attribute",
      schema(
        "TIN",
        lineOf('<carf:TIN issuedBy="FR">TEST-TIN-FR-0001'),
        "Element '{urn:oecd:ties:carf:v1}TIN', attribute 'foo': The attribute 'foo' is not allowed.",
      ),
      "XSD_UNKNOWN_ATTRIBUTE",
      "Crypto-asset user record GB2027-GOLDEN-U-0001: tax identification number (TIN) has an attribute 'foo' that the schema does not allow.",
    ],
    [
      "wrong root",
      schema(
        "CARF_OECD",
        2,
        "Element '{urn:x}CARF_OECD': No matching global declaration available for the validation root.",
      ),
      "XSD_WRONG_ROOT",
      "The file is not a CARF message: its root element is not CARF_OECD in namespace urn:oecd:ties:carf:v1.",
    ],
    [
      "anything else",
      schema("MessageSpec", 3, "Element 'MessageSpec': something new."),
      "XSD_ERROR",
      "Message header does not match the CARF XML Schema.",
    ],
  ];

  it.each(cases)("%s", (_name, issue, code, message) => {
    const [error] = translateSchemaIssues([issue], NEW);
    expect(error?.code).toBe(code);
    expect(error?.humanMessage).toBe(message);
    expect(error?.layer).toBe("V1");
    expect(error?.raw).toBe(issue.message);
    expect(error?.fixHint.length).toBeGreaterThan(0);
  });

  it("reports XML that is not well-formed, and elements it cannot find", () => {
    const [notWellFormed] = translateSchemaIssues(
      [{ kind: "xml", line: 1, message: "Opening and ending tag mismatch" }],
      "<a><b></a>",
    );
    expect(notWellFormed?.code).toBe("XML_NOT_WELL_FORMED");
    expect(notWellFormed?.humanMessage).toBe(
      "The file is not well-formed XML (line 1): Opening and ending tag mismatch.",
    );
    const [unknownElement] = translateSchemaIssues(
      [schema("Ghost", 1, "Element 'Ghost': This element is not expected.")],
      "<a><b></a>",
    );
    expect(unknownElement?.xpath).toBeUndefined();
    expect(unknownElement?.humanMessage).toBe("Ghost is not allowed here.");
  });
});

describe("translateBusinessFindings", () => {
  it("keeps the rule id, official code and location", () => {
    const xml = NEW.replace(">4200.10<", ">-4200.10<");
    const [error] = translateBusinessFindings(checkBusinessRules(xml).findings);
    expect(error).toMatchObject({
      layer: "V2",
      code: "V2-008",
      officialCode: "60001",
      element: "Amount",
      recordRef: "GB2027-GOLDEN-U-0001",
    });
  });
});
