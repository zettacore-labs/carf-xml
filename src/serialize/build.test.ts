import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CarfModelError, ConfigurationRequiredError } from "../errors.js";
import { parseCarfMessage } from "../model/message.js";
import type { CarfMessage } from "../model/types.js";
import { DEFAULT_NUMBER_FORMAT_POLICY, type NumberFormatPolicy } from "../number-format.js";
import { buildCarfXml } from "./build.js";

const policy: NumberFormatPolicy = { ...DEFAULT_NUMBER_FORMAT_POLICY, roundingMode: "HALF_UP" };
const message = (name: string): CarfMessage =>
  parseCarfMessage(
    JSON.parse(
      readFileSync(join(import.meta.dirname, "../../test/golden", name, "message.json"), "utf8"),
    ),
  );

describe("buildCarfXml", () => {
  it("is deterministic", () => {
    const first = buildCarfXml(message("all-categories"), {
      numberFormat: policy,
      rootVersion: null,
    });
    const second = buildCarfXml(message("all-categories"), {
      numberFormat: policy,
      rootVersion: null,
    });
    expect(first.xml.equals(second.xml)).toBe(true);
    expect(first.sha256).toBe(second.sha256);
    expect(first.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("writes UTF-8 with an XML declaration and the CARF namespaces", () => {
    const text = buildCarfXml(message("nil-no-body"), {
      numberFormat: policy,
      rootVersion: null,
    }).xml.toString("utf8");
    expect(
      text.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<carf:CARF_OECD xmlns:carf="urn:oecd:ties:carf:v1" xmlns:stf="urn:oecd:ties:carfstf:v5" xmlns:iso="urn:oecd:ties:isocarftypes:v1">',
      ),
    ).toBe(true);
    expect(text.endsWith("</carf:CARF_OECD>\n")).toBe(true);
  });

  it("writes the version attribute only when given", () => {
    const withVersion = buildCarfXml(message("nil-no-body"), {
      numberFormat: policy,
      rootVersion: "x.y",
    }).xml.toString("utf8");
    expect(withVersion).toContain(' version="x.y">');
    expect(() =>
      buildCarfXml(message("nil-no-body"), { numberFormat: policy, rootVersion: "" }),
    ).toThrow(CarfModelError);
    expect(() =>
      buildCarfXml(message("nil-no-body"), { numberFormat: policy, rootVersion: "12345678901" }),
    ).toThrow(CarfModelError);
  });

  it("needs a rounding mode", () => {
    expect(() =>
      buildCarfXml(message("new-data"), {
        numberFormat: DEFAULT_NUMBER_FORMAT_POLICY,
        rootVersion: null,
      }),
    ).toThrow(ConfigurationRequiredError);
  });

  it("escapes text", () => {
    const input = structuredClone(message("nil-no-body"));
    const spec = { ...input.messageSpec, warning: "a < b & c > d" };
    const text = buildCarfXml(
      { ...input, messageSpec: spec },
      { numberFormat: policy, rootVersion: null },
    ).xml.toString("utf8");
    expect(text).toContain("<carf:Warning>a &lt; b &amp; c &gt; d</carf:Warning>");
  });

  it("validates untyped input first", () => {
    expect(() =>
      buildCarfXml({ messageSpec: {} } as unknown as CarfMessage, {
        numberFormat: policy,
        rootVersion: null,
      }),
    ).toThrow(CarfModelError);
  });

  it('writes TIN attributes, including unknown="false"', () => {
    const text = buildCarfXml(message("multiple-residencies"), {
      numberFormat: policy,
      rootVersion: null,
    }).xml.toString("utf8");
    expect(text).toContain('<carf:TIN unknown="true">NOTIN</carf:TIN>');
    expect(text).toContain('<carf:TIN issuedBy="DE">TEST-TIN-DE-0004</carf:TIN>');
  });
});
