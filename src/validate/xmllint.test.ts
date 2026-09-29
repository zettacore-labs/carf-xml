import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { SchemaValidatorError } from "./schema-validator.js";
import { parseXmllintOutput, XmllintValidator } from "./xmllint.js";

const OUTPUT = `/tmp/carf-xml-1/message.xml:3: element ReportingPeriod: Schemas validity error : Element '{urn:oecd:ties:carf:v1}ReportingPeriod': '2027-13-31' is not a valid value of the atomic type 'xs:date'.
/tmp/carf-xml-1/message.xml:5: element TIN: Schemas validity warning : Element '{urn:oecd:ties:carf:v1}TIN', attribute 'foo': The attribute 'foo' is not allowed.
/tmp/carf-xml-1/message.xml fails to validate
nwf.xml:1: parser error : Opening and ending tag mismatch: b line 1 and a
<a><b></a>
          ^`;

describe("parseXmllintOutput", () => {
  it("reads schema and parser errors and drops the rest", () => {
    expect(parseXmllintOutput(OUTPUT)).toEqual([
      {
        kind: "schema",
        line: 3,
        element: "ReportingPeriod",
        message:
          "Element '{urn:oecd:ties:carf:v1}ReportingPeriod': '2027-13-31' is not a valid value of the atomic type 'xs:date'.",
      },
      {
        kind: "schema",
        line: 5,
        element: "TIN",
        message:
          "Element '{urn:oecd:ties:carf:v1}TIN', attribute 'foo': The attribute 'foo' is not allowed.",
      },
      { kind: "xml", line: 1, message: "Opening and ending tag mismatch: b line 1 and a" },
    ]);
  });
});

// A stand-in for xmllint: prints canned output and exits with a chosen code.
const dir = mkdtempSync(join(tmpdir(), "fake-xmllint-"));
function fake(name: string, script: string): string {
  const path = join(dir, name);
  writeFileSync(
    path,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "xmllint: using libxml version 29999" >&2; exit 0; fi\n${script}\n`,
  );
  chmodSync(path, 0o755);
  return path;
}

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("XmllintValidator", () => {
  const xml = Buffer.from("<a/>");

  it("passes the file with --nonet --noout --schema and reads a valid result", async () => {
    const path = fake("ok", 'echo "$@" > "$(dirname "$0")/args"; echo "$5 validates" >&2; exit 0');
    const result = await new XmllintValidator({ xmllintPath: path }).validate(
      xml,
      "/schemas/root.xsd",
    );
    expect(result).toEqual({ valid: true, issues: [], validatedBy: "xmllint (libxml 29999)" });
  });

  it("reads validity errors on exit 3", async () => {
    const path = fake(
      "invalid",
      `echo "$5:1: element a: Schemas validity error : Element 'a': No matching global declaration available for the validation root." >&2; exit 3`,
    );
    const result = await new XmllintValidator({ xmllintPath: path }).validate(
      xml,
      "/schemas/root.xsd",
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.element).toBe("a");
  });

  it("throws when the schema cannot be used", async () => {
    const path = fake(
      "broken",
      'echo "Schemas parser error : Failed to locate the main schema resource" >&2; exit 5',
    );
    await expect(
      new XmllintValidator({ xmllintPath: path }).validate(xml, "/missing.xsd"),
    ).rejects.toThrow(SchemaValidatorError);
  });

  it("throws when xmllint is missing or too slow", async () => {
    await expect(
      new XmllintValidator({ xmllintPath: join(dir, "does-not-exist") }).validate(xml, "/x.xsd"),
    ).rejects.toThrow(/could not run/);
    const slow = fake("slow", "sleep 5");
    await expect(
      new XmllintValidator({ xmllintPath: slow, timeoutMs: 200 }).validate(xml, "/x.xsd"),
    ).rejects.toThrow(/timed out/);
  });

  it("reports an unknown libxml version", async () => {
    const path = join(dir, "noversion");
    writeFileSync(path, "#!/bin/sh\nexit 0\n");
    chmodSync(path, 0o755);
    const result = await new XmllintValidator({ xmllintPath: path }).validate(xml, "/x.xsd");
    expect(result.validatedBy).toBe("xmllint (libxml unknown version)");
  });
});
