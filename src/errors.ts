/**
 * A value the package needs is not settled by the official OECD files, so the caller must
 * supply it (for example the rounding mode for XML amounts). The package never guesses one.
 */
export class ConfigurationRequiredError extends Error {
  readonly code = "CONFIGURATION_REQUIRED";
  /** The setting that must be supplied, e.g. "numberFormat.roundingMode". */
  readonly setting: string;

  constructor(setting: string, message: string) {
    super(message);
    this.name = "ConfigurationRequiredError";
    this.setting = setting;
  }
}

/** The input does not match the CARF message model. `issues` name the invalid fields. */
export class CarfModelError extends Error {
  readonly issues: readonly { readonly path: string; readonly message: string }[];

  constructor(issues: readonly { readonly path: string; readonly message: string }[]) {
    super(
      `The CARF message is not valid: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`,
    );
    this.name = "CarfModelError";
    this.issues = issues;
  }
}
