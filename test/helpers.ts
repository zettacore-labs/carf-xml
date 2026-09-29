// Shared test helpers. Tests that need the official XSDs use describeWithSchemas: they are
// skipped when CARF_SCHEMA_DIR / CARF_STATUS_SCHEMA_DIR are unset (a standalone copy has no
// XSDs), and fail with "Official OECD XSD missing" when set to a folder without the files.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  numberFormatPolicySchema,
  parseCarfMessage,
  type CarfMessage,
  type NumberFormatPolicy,
} from "../src/index.js";

const env = (name: string): string | undefined => {
  const value = process.env[name];
  return value === undefined || value === "" ? undefined : value;
};

export const CARF_SCHEMA_DIR = env("CARF_SCHEMA_DIR");
export const CARF_STATUS_SCHEMA_DIR = env("CARF_STATUS_SCHEMA_DIR");
/** Use as describe.skipIf(!HAS_SCHEMAS)(…) for tests that need the official CARF XSDs and xmllint. */
export const HAS_SCHEMAS = CARF_SCHEMA_DIR !== undefined;
export const HAS_STATUS_SCHEMAS = CARF_STATUS_SCHEMA_DIR !== undefined;

export const TEST_DIR = resolve(import.meta.dirname);
export const GOLDEN_DIR = join(TEST_DIR, "golden");

export const GOLDEN_CASES: readonly string[] = readdirSync(GOLDEN_DIR)
  .filter((name) => statSync(join(GOLDEN_DIR, name)).isDirectory())
  .sort();

export const GOLDEN_POLICY: NumberFormatPolicy = numberFormatPolicySchema.parse(
  JSON.parse(readFileSync(join(GOLDEN_DIR, "number-policy.json"), "utf8")),
);

export function goldenMessage(name: string): CarfMessage {
  return parseCarfMessage(JSON.parse(readFileSync(join(GOLDEN_DIR, name, "message.json"), "utf8")));
}

export function goldenXml(name: string): Buffer {
  return readFileSync(join(GOLDEN_DIR, name, "expected.xml"));
}

export function fixtureMessage(name: string): CarfMessage {
  return parseCarfMessage(
    JSON.parse(readFileSync(join(TEST_DIR, "fixtures", `${name}.json`), "utf8")),
  );
}
