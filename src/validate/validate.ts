// Validates a CARF message in two layers: V1 structure against the official XSD (via a
// SchemaValidator, xmllint by default) and V2 OECD business rules. Both come back as readable
// errors with line, XPath and record reference.
import {
  checkBusinessRules,
  type BusinessRulesOptions,
  type RuleResult,
} from "../rules/business-rules.js";
import {
  translateBusinessFindings,
  translateSchemaIssues,
  type TranslatedError,
} from "../translate/translate.js";
import { parseXml, XmlParseError, type XmlElement } from "../xml/tree.js";
import { resolveSchemaSet } from "./schema-set.js";
import type { SchemaValidator } from "./schema-validator.js";
import { XmllintValidator } from "./xmllint.js";

export interface ValidateOptions {
  /** Folder with the official OECD CARF XML Schema files (e.g. v1.5), unchanged. */
  readonly schemaDir: string;
  /** Default: XmllintValidator using "xmllint" from PATH. */
  readonly validator?: SchemaValidator;
  readonly businessRules?: BusinessRulesOptions;
}

export interface ValidationReport {
  /** True when there is no V1 or V2 error. */
  readonly valid: boolean;
  readonly schemaSetId: string;
  readonly validatedBy: string;
  readonly errors: readonly TranslatedError[];
  /** The outcome of each V2 rule; empty when the file is not well-formed XML. */
  readonly rules: readonly RuleResult[];
}

export async function validateCarfXml(
  xml: string | Uint8Array,
  options: ValidateOptions,
): Promise<ValidationReport> {
  const schemaSet = resolveSchemaSet(options.schemaDir, "carf");
  const bytes = typeof xml === "string" ? Buffer.from(xml, "utf8") : xml;
  const validator = options.validator ?? new XmllintValidator();
  const schemaResult = await validator.validate(bytes, schemaSet.rootPath);
  const errors: TranslatedError[] = translateSchemaIssues(schemaResult.issues, bytes);

  let tree: XmlElement | undefined;
  try {
    tree = parseXml(bytes);
  } catch (error) {
    if (!(error instanceof XmlParseError)) {
      throw error;
    }
  }
  let rules: readonly RuleResult[] = [];
  if (tree !== undefined) {
    const business = checkBusinessRules(tree, options.businessRules);
    errors.push(...translateBusinessFindings(business.findings));
    rules = business.rules;
  }
  return {
    valid: errors.length === 0,
    schemaSetId: schemaSet.id,
    validatedBy: schemaResult.validatedBy,
    errors,
    rules,
  };
}
