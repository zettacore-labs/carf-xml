// Reads a CARF Status Message (CARFStatusMessageXML_v1.1.xsd, namespace urn:oecd:ties:csm:v2):
// validates it against the official Status Message XSD, then returns the acceptance status and
// every file and record error with the guide's description of its code.
import { translateSchemaIssues, type TranslatedError } from "../translate/translate.js";
import { resolveSchemaSet } from "../validate/schema-set.js";
import type { SchemaValidator } from "../validate/schema-validator.js";
import { XmllintValidator } from "../validate/xmllint.js";
import { childNamed, childrenNamed, childText, parseXml, type XmlElement } from "../xml/tree.js";
import { describeStatusCode, type StatusCodeInfo } from "./codes.js";

export const CSM_NAMESPACE = "urn:oecd:ties:csm:v2";

export interface StatusErrorDetails {
  readonly text: string;
  readonly language?: string;
}

export interface StatusFileError {
  readonly code: string;
  readonly details?: StatusErrorDetails;
  /** The guide's entry for the code, when the code is listed there. */
  readonly official?: StatusCodeInfo;
}

export interface StatusRecordError extends StatusFileError {
  readonly docRefIdsInError: readonly string[];
  /** FieldsInError/FieldPath values, e.g. "CARF_OECD/CARFBody/RCASP/OtherNexus/Nexus". */
  readonly fieldPaths: readonly string[];
}

export interface CarfStatusMessage {
  readonly version?: string;
  readonly messageSpec: {
    readonly sendingCompanyIn?: string;
    readonly transmittingCountry: string;
    readonly receivingCountry: string;
    readonly messageType: string;
    readonly warning?: string;
    readonly contact?: string;
    readonly messageRefId: string;
    readonly timestamp: string;
  };
  readonly originalMessageRefId?: string;
  readonly fileMetaData?: {
    readonly ctsTransmissionId?: string;
    readonly ctsSendingTimeStamp?: string;
    readonly uncompressedFileSizeKbQty?: string;
  };
  readonly status: "Accepted" | "Rejected";
  readonly validatedBy: readonly string[];
  readonly fileErrors: readonly StatusFileError[];
  readonly recordErrors: readonly StatusRecordError[];
}

export interface ParseStatusOptions {
  /** Folder with the official OECD CARF Status Message XML Schema files (v1.1), unchanged. */
  readonly schemaDir: string;
  readonly validator?: SchemaValidator;
}

/** The status message does not match the official Status Message XSD. */
export class StatusMessageError extends Error {
  readonly errors: readonly TranslatedError[];

  constructor(errors: readonly TranslatedError[]) {
    super(`The CARF Status Message is not valid: ${errors.map((e) => e.humanMessage).join(" ")}`);
    this.name = "StatusMessageError";
    this.errors = errors;
  }
}

function optional<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
}

function details(error: XmlElement): { details?: StatusErrorDetails } {
  const node = childNamed(error, "Details");
  if (node === undefined) {
    return {};
  }
  const language = node.attributes.Language;
  return { details: language === undefined ? { text: node.text } : { text: node.text, language } };
}

function withOfficial(code: string): { official?: StatusCodeInfo } {
  const official = describeStatusCode(code);
  return official === undefined ? {} : { official };
}

/** A child the Status Message XSD requires; validation has already guaranteed it exists. */
function required(parent: XmlElement, name: string): XmlElement {
  const child = childNamed(parent, name);
  if (child === undefined) {
    throw new Error(`Schema-valid status message without ${name}`);
  }
  return child;
}

function requiredText(parent: XmlElement, name: string): string {
  return required(parent, name).text.trim();
}

function readStatus(root: XmlElement): CarfStatusMessage {
  const spec = required(root, "MessageSpec");
  const body = required(root, "CARFStatusMessage");
  const original = required(body, "OriginalMessage");
  const errors = required(body, "ValidationErrors");
  const result = required(body, "ValidationResult");
  const meta = childNamed(original, "FileMetaData");

  const fileErrors: StatusFileError[] = childrenNamed(errors, "FileError").map((error) => {
    const code = requiredText(error, "Code");
    return { code, ...details(error), ...withOfficial(code) };
  });
  const recordErrors: StatusRecordError[] = childrenNamed(errors, "RecordError").map((error) => {
    const code = requiredText(error, "Code");
    return {
      code,
      ...details(error),
      ...withOfficial(code),
      docRefIdsInError: childrenNamed(error, "DocRefIDInError").map((e) => e.text),
      fieldPaths: childrenNamed(error, "FieldsInError").map((field) =>
        requiredText(field, "FieldPath"),
      ),
    };
  });

  return {
    ...optional("version", root.attributes.version),
    messageSpec: {
      ...optional("sendingCompanyIn", childText(spec, "SendingCompanyIN")),
      transmittingCountry: requiredText(spec, "TransmittingCountry"),
      receivingCountry: requiredText(spec, "ReceivingCountry"),
      messageType: requiredText(spec, "MessageType"),
      ...optional("warning", childText(spec, "Warning")),
      ...optional("contact", childText(spec, "Contact")),
      messageRefId: requiredText(spec, "MessageRefId"),
      timestamp: requiredText(spec, "Timestamp"),
    },
    ...optional("originalMessageRefId", childText(original, "OriginalMessageRefID")),
    ...(meta === undefined
      ? {}
      : {
          fileMetaData: {
            ...optional("ctsTransmissionId", childText(meta, "CTSTransmissionID")),
            ...optional("ctsSendingTimeStamp", childText(meta, "CTSSendingTimeStamp")),
            ...optional("uncompressedFileSizeKbQty", childText(meta, "UncompressedFileSizeKBQty")),
          },
        }),
    status: requiredText(result, "Status") === "Accepted" ? "Accepted" : "Rejected",
    validatedBy: childrenNamed(result, "ValidatedBy").map((e) => e.text),
    fileErrors,
    recordErrors,
  };
}

/** Validates and reads a CARF Status Message. Throws StatusMessageError if it is not schema-valid. */
export async function parseCarfStatusMessage(
  xml: string | Uint8Array,
  options: ParseStatusOptions,
): Promise<CarfStatusMessage> {
  const schemaSet = resolveSchemaSet(options.schemaDir, "status");
  const bytes = typeof xml === "string" ? Buffer.from(xml, "utf8") : xml;
  const validator = options.validator ?? new XmllintValidator();
  const result = await validator.validate(bytes, schemaSet.rootPath);
  if (!result.valid) {
    throw new StatusMessageError(translateSchemaIssues(result.issues, bytes));
  }
  return readStatus(parseXml(bytes));
}
