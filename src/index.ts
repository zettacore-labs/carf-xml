// @zettacore/carf-xml: build, validate and explain OECD CARF XML messages.
// Licensed under the Apache License, Version 2.0.

export * from "./generated/enums.js";
export { KNOWN_SCHEMA_SETS, type KnownSchemaSet } from "./generated/schema-sets.js";

export {
  asDecimalString,
  canonicalDecimal,
  isDecimalString,
  roundToPlaces,
  ROUNDING_MODES,
  type DecimalString,
  type RoundingMode,
} from "./decimal.js";
export { CarfModelError, ConfigurationRequiredError } from "./errors.js";
export {
  DEFAULT_NUMBER_FORMAT_POLICY,
  formatAmount,
  formatUnits,
  numberFormatPolicySchema,
  OECD_AMOUNT_FRACTION_DIGITS,
  OECD_UNITS_MAX_FRACTION_DIGITS,
  type NumberFormatPolicy,
} from "./number-format.js";

export { carfMessageSchema, parseCarfMessage } from "./model/message.js";
export { TRANSACTION_CATEGORIES, type TransactionCategory } from "./model/transactions.js";
export type {
  Address,
  AddressFix,
  BirthPlace,
  CarfBody,
  CarfMessage,
  ControllingPerson,
  CryptoUser,
  DocSpec,
  ExchangeEntry,
  Identity,
  IndividualIn,
  MessageSpec,
  MonAmnt,
  NameOrganisation,
  NamePart,
  NamePerson,
  OrganisationIn,
  OrganisationParty,
  PersonParty,
  Rcasp,
  RelevantTransactions,
  RrptEntry,
  Tin,
  TransferInEntry,
  TransferOutEntry,
  TransferWalletEntry,
} from "./model/types.js";

export {
  buildCarfXml,
  CARF_NAMESPACE,
  ISO_NAMESPACE,
  STF_NAMESPACE,
  type BuildOptions,
  type BuildResult,
} from "./serialize/build.js";

export {
  SchemaValidatorError,
  type SchemaIssue,
  type SchemaValidationResult,
  type SchemaValidator,
} from "./validate/schema-validator.js";
export { parseXmllintOutput, XmllintValidator, type XmllintOptions } from "./validate/xmllint.js";
export {
  resolveSchemaSet,
  SchemaSetError,
  type ResolvedSchemaSet,
  type SchemaKind,
} from "./validate/schema-set.js";
export {
  validateCarfXml,
  type ValidateOptions,
  type ValidationReport,
} from "./validate/validate.js";

export {
  RULE_IDS,
  RULES,
  SOURCE_TITLES,
  type RuleDefinition,
  type RuleId,
  type RuleSource,
} from "./rules/catalogue.js";
export {
  checkBusinessRules,
  type BusinessRuleFinding,
  type BusinessRulesOptions,
  type BusinessRulesResult,
  type RuleResult,
  type RuleStatus,
} from "./rules/business-rules.js";
export {
  translateBusinessFindings,
  translateSchemaIssues,
  type TranslatedError,
  type V1Code,
} from "./translate/translate.js";

export { describeStatusCode, STATUS_CODES, type StatusCodeInfo } from "./status/codes.js";
export {
  CSM_NAMESPACE,
  parseCarfStatusMessage,
  StatusMessageError,
  type CarfStatusMessage,
  type ParseStatusOptions,
  type StatusFileError,
  type StatusRecordError,
} from "./status/parse.js";

export { explainCarfXml, type MessageSummary } from "./explain.js";
export { parseXml, XmlParseError, type XmlElement } from "./xml/tree.js";
