// SchemaValidator backed by libxml2's xmllint:
//   xmllint --nonet --noout --schema <schema.xsd> <file.xml>
// It runs with execFile (no shell), on a private temporary copy of the XML, with a timeout.
// --nonet stops libxml2 from loading anything over the network.
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SchemaValidatorError,
  type SchemaIssue,
  type SchemaValidationResult,
  type SchemaValidator,
} from "./schema-validator.js";

export interface XmllintOptions {
  /** Path of the xmllint binary. Default: "xmllint" from PATH. */
  readonly xmllintPath?: string;
  /** Default: 120 000 ms. */
  readonly timeoutMs?: number;
}

const VALIDITY =
  /^(?<file>.*?):(?<line>\d+): element (?<element>[^:\s]+): Schemas validity (?:error|warning) : (?<message>.*)$/;
const PARSER = /^(?<file>.*?):(?<line>\d+): (?:parser|namespace|validity) error : (?<message>.*)$/;

interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

function run(file: string, args: readonly string[], timeout: number): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { timeout, maxBuffer: 64 * 1024 * 1024, encoding: "utf8", windowsHide: true },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve({ code: 0, stdout, stderr });
          return;
        }
        if (typeof error.code === "number") {
          resolve({ code: error.code, stdout, stderr });
          return;
        }
        const reason = error.killed ? `timed out after ${String(timeout)} ms` : error.message;
        reject(new SchemaValidatorError(`xmllint could not run: ${reason}`));
      },
    );
  });
}

/** Parses xmllint's stderr into issues. Exported for tests. */
export function parseXmllintOutput(stderr: string): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  for (const line of stderr.split(/\r?\n/)) {
    const validity = VALIDITY.exec(line);
    if (validity?.groups !== undefined) {
      issues.push({
        kind: "schema",
        line: Number.parseInt(validity.groups.line ?? "0", 10),
        element: validity.groups.element ?? "",
        message: validity.groups.message ?? "",
      });
      continue;
    }
    const parser = PARSER.exec(line);
    if (parser?.groups !== undefined) {
      issues.push({
        kind: "xml",
        line: Number.parseInt(parser.groups.line ?? "0", 10),
        message: parser.groups.message ?? "",
      });
    }
  }
  return issues;
}

export class XmllintValidator implements SchemaValidator {
  private readonly xmllintPath: string;
  private readonly timeoutMs: number;
  private version: string | undefined;

  constructor(options: XmllintOptions = {}) {
    this.xmllintPath = options.xmllintPath ?? "xmllint";
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  private async validatedBy(): Promise<string> {
    if (this.version === undefined) {
      const result = await run(this.xmllintPath, ["--version"], this.timeoutMs);
      const match = /using libxml version (\S+)/.exec(`${result.stdout}\n${result.stderr}`);
      this.version = `xmllint (libxml ${match?.[1] ?? "unknown version"})`;
    }
    return this.version;
  }

  async validate(xml: Uint8Array, schemaPath: string): Promise<SchemaValidationResult> {
    const validatedBy = await this.validatedBy();
    const dir = await mkdtemp(join(tmpdir(), "carf-xml-"));
    try {
      const file = join(dir, "message.xml");
      await writeFile(file, xml, { mode: 0o600 });
      const result = await run(
        this.xmllintPath,
        ["--nonet", "--noout", "--schema", schemaPath, file],
        this.timeoutMs,
      );
      const issues = parseXmllintOutput(result.stderr);
      if (result.code === 0) {
        return { valid: true, issues: [], validatedBy };
      }
      if (issues.length === 0) {
        // Exit code 5 and similar: the schema itself could not be loaded or compiled.
        throw new SchemaValidatorError(
          `xmllint failed (exit ${String(result.code)}): ${result.stderr.trim().split(/\r?\n/).slice(0, 3).join(" ")}`,
        );
      }
      return { valid: false, issues, validatedBy };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
