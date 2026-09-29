/** One problem found by structural (XSD) validation. */
export interface SchemaIssue {
  /** "schema" for XSD validity errors, "xml" when the file is not well-formed XML. */
  readonly kind: "schema" | "xml";
  readonly line: number;
  readonly column?: number;
  /** Local name of the element the validator reported. */
  readonly element?: string;
  /** The validator's message without the file name and line prefix. */
  readonly message: string;
}

export interface SchemaValidationResult {
  readonly valid: boolean;
  readonly issues: readonly SchemaIssue[];
  /** Which tool produced the result, e.g. "xmllint (libxml 20913)". */
  readonly validatedBy: string;
}

/** Validates an XML document against an XSD. Implementations must not fetch anything remote. */
export interface SchemaValidator {
  validate(xml: Uint8Array, schemaPath: string): Promise<SchemaValidationResult>;
}

/** The validator could not run (missing binary, schema that does not compile, timeout). */
export class SchemaValidatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaValidatorError";
  }
}
