// carf-xml command line: validate, build and explain CARF XML files.
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { z } from "zod";

import { ConfigurationRequiredError, CarfModelError } from "../errors.js";
import { explainCarfXml } from "../explain.js";
import { RULE_IDS, type RuleId } from "../rules/catalogue.js";
import { buildCarfXml } from "../serialize/build.js";
import { numberFormatPolicySchema } from "../number-format.js";
import { SchemaSetError } from "../validate/schema-set.js";
import { SchemaValidatorError } from "../validate/schema-validator.js";
import { validateCarfXml } from "../validate/validate.js";
import { XmllintValidator } from "../validate/xmllint.js";
import { XmlParseError } from "../xml/tree.js";

export const USAGE = `Usage:
  carf-xml validate <file.xml> [--schema-dir <dir>] [--xmllint <path>] [--disable-rule <V2-nnn>]...
                    [--reporting-period <YYYY-MM-DD>] [--docrefid-pattern <regex>] [--json]
  carf-xml build <message.json> --out <file.xml> --number-policy <policy.json>
                 (--root-version <value> | --omit-root-version)
  carf-xml explain <file.xml> [--json]

  --schema-dir  folder with the official OECD CARF XML Schema files (or set CARF_SCHEMA_DIR)

Exit codes: 0 success, 1 the file has errors, 2 usage or setup problem.`;

export interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly env: Readonly<Record<string, string | undefined>>;
}

class UsageError extends Error {}

function single(positionals: readonly string[], what: string): string {
  if (positionals.length !== 1 || positionals[0] === undefined) {
    throw new UsageError(`Expected exactly one ${what}.`);
  }
  return positionals[0];
}

async function validateCommand(args: readonly string[], io: Io): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      "schema-dir": { type: "string" },
      xmllint: { type: "string" },
      "disable-rule": { type: "string", multiple: true },
      "reporting-period": { type: "string" },
      "docrefid-pattern": { type: "string" },
      json: { type: "boolean", default: false },
    },
  });
  const file = single(positionals, "XML file");
  const schemaDir = values["schema-dir"] ?? io.env.CARF_SCHEMA_DIR;
  if (schemaDir === undefined || schemaDir === "") {
    throw new UsageError("Give the schema folder with --schema-dir or CARF_SCHEMA_DIR.");
  }
  const disabled = values["disable-rule"] ?? [];
  const unknown = disabled.filter((id) => !(RULE_IDS as readonly string[]).includes(id));
  if (unknown.length > 0) {
    throw new UsageError(`Unknown rule(s): ${unknown.join(", ")}.`);
  }
  const pattern = values["docrefid-pattern"];
  const report = await validateCarfXml(readFileSync(file), {
    schemaDir,
    validator: new XmllintValidator(
      values.xmllint === undefined ? {} : { xmllintPath: values.xmllint },
    ),
    businessRules: {
      disabledRules: disabled as RuleId[],
      ...(values["reporting-period"] === undefined
        ? {}
        : { expectedReportingPeriod: values["reporting-period"] }),
      ...(pattern === undefined ? {} : { docRefIdFormat: new RegExp(pattern) }),
    },
  });
  if (values.json) {
    io.out(JSON.stringify(report, null, 2));
    return report.valid ? 0 : 1;
  }
  io.out(`${file}: ${report.valid ? "valid" : `${String(report.errors.length)} error(s)`}`);
  io.out(`Schema set ${report.schemaSetId}, validated by ${report.validatedBy}`);
  for (const error of report.errors) {
    const code =
      error.officialCode === undefined ? error.code : `${error.code} (${error.officialCode})`;
    const where = error.line === undefined ? "" : ` line ${String(error.line)}`;
    io.out(`  [${error.layer} ${code}]${where}: ${error.humanMessage}`);
    io.out(`      ${error.fixHint}`);
    if (error.xpath !== undefined) {
      io.out(`      at ${error.xpath}`);
    }
  }
  for (const rule of report.rules.filter(
    (r) =>
      r.status === "not_checked" ||
      r.status === "configuration_required" ||
      r.status === "disabled",
  )) {
    io.out(
      `  ${rule.ruleId}: ${rule.status.replace(/_/g, " ")}${rule.note === undefined ? "" : ` (${rule.note})`}`,
    );
  }
  return report.valid ? 0 : 1;
}

function buildCommand(args: readonly string[], io: Io): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      out: { type: "string" },
      "number-policy": { type: "string" },
      "root-version": { type: "string" },
      "omit-root-version": { type: "boolean", default: false },
    },
  });
  const input = single(positionals, "message JSON file");
  if (values.out === undefined || values["number-policy"] === undefined) {
    throw new UsageError("build needs --out and --number-policy.");
  }
  if ((values["root-version"] === undefined) === !values["omit-root-version"]) {
    throw new UsageError(
      "build needs exactly one of --root-version <value> or --omit-root-version.",
    );
  }
  const policy = numberFormatPolicySchema.parse(
    JSON.parse(readFileSync(values["number-policy"], "utf8")),
  );
  const message: unknown = JSON.parse(readFileSync(input, "utf8"));
  const result = buildCarfXml(message as Parameters<typeof buildCarfXml>[0], {
    numberFormat: policy,
    rootVersion: values["root-version"] ?? null,
  });
  writeFileSync(values.out, result.xml);
  io.out(`${values.out}: ${String(result.xml.length)} bytes, sha256 ${result.sha256}`);
  return 0;
}

function explainCommand(args: readonly string[], io: Io): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { json: { type: "boolean", default: false } },
  });
  const file = single(positionals, "XML file");
  const summary = explainCarfXml(readFileSync(file));
  if (values.json) {
    io.out(JSON.stringify(summary, null, 2));
    return 0;
  }
  io.out(
    `Message ${summary.messageRefId ?? "(no MessageRefId)"} (${summary.messageTypeIndic ?? "no MessageTypeIndic"})`,
  );
  io.out(
    `  ${summary.transmittingCountry ?? "?"} → ${summary.receivingCountry ?? "?"}, reporting period ${summary.reportingPeriod ?? "?"}`,
  );
  io.out(
    `  CARF bodies: ${String(summary.carfBodies)}, RCASP records: ${String(summary.rcaspRecords)}`,
  );
  io.out(
    `  Records per DocTypeIndic: ${
      Object.entries(summary.docTypeIndics)
        .map(([k, v]) => `${k} ${String(v)}`)
        .join(", ") || "none"
    }`,
  );
  io.out(
    `  Crypto-asset users: ${String(summary.cryptoUsers.individual)} individual, ${String(summary.cryptoUsers.entity)} entity; controlling persons: ${String(summary.controllingPersons)}`,
  );
  io.out(`  Crypto-assets: ${String(summary.cryptoAssets)}`);
  io.out(
    `  Entries per category: ${Object.entries(summary.categories)
      .map(([k, v]) => `${k} ${String(v)}`)
      .join(", ")}`,
  );
  return 0;
}

/** Runs the CLI and returns the exit code. */
export async function runCli(argv: readonly string[], io: Io): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case "validate":
        return await validateCommand(rest, io);
      case "build":
        return buildCommand(rest, io);
      case "explain":
        return explainCommand(rest, io);
      case undefined:
      case "help":
      case "--help":
      case "-h":
        io.out(USAGE);
        return command === undefined ? 2 : 0;
      default:
        throw new UsageError(`Unknown command "${command}".`);
    }
  } catch (error) {
    if (error instanceof CarfModelError) {
      io.err(error.message);
      return 1;
    }
    if (error instanceof z.ZodError) {
      io.err(
        `Invalid number policy: ${error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
      );
      return 2;
    }
    if (error instanceof XmlParseError) {
      io.err(`Not well-formed XML (line ${String(error.line)}): ${error.message}`);
      return 1;
    }
    if (
      error instanceof UsageError ||
      error instanceof ConfigurationRequiredError ||
      error instanceof SchemaSetError ||
      error instanceof SchemaValidatorError ||
      error instanceof SyntaxError ||
      (error instanceof Error &&
        "code" in error &&
        typeof error.code === "string" &&
        error.code.startsWith("ERR_PARSE_ARGS"))
    ) {
      io.err(error.message);
      if (error instanceof UsageError) {
        io.err(USAGE);
      }
      return 2;
    }
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "EISDIR")
    ) {
      io.err(error.message);
      return 2;
    }
    throw error;
  }
}
