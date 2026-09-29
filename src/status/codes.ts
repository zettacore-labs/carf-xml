// Error codes of the CARF Status Message, as listed in part 4 of the OECD "Crypto-Asset
// Reporting Framework Status Message XML Schema: User Guide for Tax Administrations" (June 2025):
// file validations pp. 24–27, record validations pp. 28–29. Text copied from the guide.

export interface StatusCodeInfo {
  readonly code: string;
  readonly kind: "file" | "record";
  readonly name: string;
  readonly description: string;
  /** "Action Requested" in the guide (file errors only). */
  readonly action?: string;
  /** Codes 90000–90002 are reserved for future use. */
  readonly reserved?: true;
}

const file = (code: string, name: string, description: string, action: string): StatusCodeInfo => ({
  code,
  kind: "file",
  name,
  description,
  action,
});
const record = (
  code: string,
  name: string,
  description: string,
  reserved?: true,
): StatusCodeInfo =>
  reserved === undefined
    ? { code, kind: "record", name, description }
    : { code, kind: "record", name, description, reserved };

export const STATUS_CODES: readonly StatusCodeInfo[] = [
  file(
    "50001",
    "Failed Download",
    "The receiving Competent Authority could not download the referenced file.",
    "Please resubmit the file.",
  ),
  file(
    "50002",
    "Failed Decryption",
    "The receiving Competent Authority could not decrypt the referenced file.",
    "Please re-encrypt the file with a valid key and resubmit the file.",
  ),
  file(
    "50003",
    "Failed Decompression",
    "The receiving Competent Authority could not decompress the referenced file.",
    "Please compress the file (before encrypting) and resubmit the file.",
  ),
  file(
    "50004",
    "Failed Signature Check",
    "The receiving Competent Authority could not validate the digital signature on the referenced file.",
    "Please re-sign the file with the owner’s private key using procedures as defined in the context of the CTS.",
  ),
  file(
    "50005",
    "Failed Threat Scan",
    "The receiving Competent Authority detected one or more potential security threats within the decrypted version of the referenced file. Such threats include but are not limited to hyperlinks, Java script, and executable files.",
    "Please scan the file for known threats and viruses, remove all detected threats and viruses prior to encryption and re-encrypt and resubmit the file.",
  ),
  file(
    "50006",
    "Failed Virus Scan",
    "The receiving Competent Authority detected one or more known viruses within the decrypted version of the referenced file.",
    "Please scan the file for known threats and viruses, remove all detected threats and viruses prior to encryption, and re-encrypt and resubmit the file.",
  ),
  file(
    "50007",
    "Failed Schema Validation",
    "The referenced file failed validation against the CARF XML Schema.",
    "Please re-validate the file against the CARF XML Schema, resolve any validation errors, and re- encrypt and resubmit the file.",
  ),
  file(
    "50008",
    "Invalid MessageRefID format",
    "The structure of the MessageRefID is not in the correct format, as set out in the CARF User Guide.",
    "Please ensure the MessageRefID follows structure defined in the CARF User guide, and resubmit the file.",
  ),
  file(
    "50009",
    "MessageRefID has already been used",
    "The referenced file has a duplicate MessageRefID value that was received on a previous file.",
    "Please replace the MessageRefID field value with a unique value (not containing all blanks), and resubmit the file.",
  ),
  file(
    "50010",
    "File Contains Test Data for Production Environment",
    "The referenced file contains one or more records with a DocTypeIndic value in the range OECD10-OECD13, indicating test data. As a result, the receiving Competent Authority cannot accept this file as a valid CARF file submission.",
    "If this file was intended to be submitted as a valid CARF file, please resubmit with DocTypeIndic values in the range OECD0-OECD3 (see CARF User guide). If this file was intended as a test file, please submit to the CTS test environment during an agreed test window.",
  ),
  file(
    "50011",
    "File Contains Production Data for Test Environment",
    "The referenced file was received in a test environment with one or more records having a DocTypeIndic value in the range OECD0-OECD3. These DocTypeIndic values indicate data in this file may have been intended as a valid CARF file submission. CARF messages received in test environments are not accepted by the receiving Competent Authority as a valid CARF file submission. Submissions to the test environment should only include records with DocTypeIndic in the range OECD10-OECD13, indicating test files.",
    "If this file was intended to be submitted as a valid CARF file, please resubmit with DocTypeIndic values in the range OECD0-OECD3. If this file was intended as a test file, please correct the DocTypeIndic for all records and resubmit to the CTS test link.",
  ),
  file(
    "50012",
    "The received message is not meant to be received by the indicated jurisdiction",
    "The records contained in the CARF payload file are not meant for the receiving Competent Authority, but should have been provided to another jurisdiction.",
    "The file is to be immediately deleted by the initial, erroneous receiver and that receiving Competent Authority will promptly notify the sending Competent Authority about the erroneous transmission through the CARF Status Message XML Schema.",
  ),
  file(
    "50013",
    "An incorrect AES key size was detected by the receiving jurisdiction",
    "The recipient has detected one or more of the following errors: Data packet transmitted with ECB cipher mode (or any cipher mode other than CBC); Data packet does not include IV in Key File; Data packet key size is not 48 bytes; or Data packet does not contain the concatenated key and IV.",
    "The sending Competent Authority should resend the file (newly encrypted, with a new unique MessageRefID and with the correct AES key size).",
  ),
  record("60001", "Amount", "The amount must be greater than or equal to zero."),
  record(
    "60002",
    "Controlling Person must be omitted (when the Crypto-Asset User is an individual)",
    "When the Crypto-Asset User is an individual, the “Controlling Person” must be omitted.",
  ),
  record(
    "60003",
    "Verify data sorting Person ResCountry Code",
    "When the Person is a Controlling Person or an Individual Crypto-Asset User, at least one of the according ResCountryCodes must match the Message Receiving Country Code",
  ),
  record(
    "60004",
    "Verify data sorting Organisation ResCountry Code",
    "At least one of either the Entity Crypto-Asset User ResCountryCode or Controlling Person ResCountryCode must match the Message Receiving Country Code.",
  ),
  record(
    "60005",
    "Verify data sorting RCASP.ResCountry Code",
    "RCASP.ResCountryCode must match the Message Sending Country Code.",
  ),
  record(
    "60006",
    "Other Nexus",
    "The ResCountryCode of the optional element OtherNexus must match the Message Receiving Country Code.",
  ),
  record(
    "60007",
    "BirthDate",
    "Date of birth should be in a valid range (e.g. not before 1900 and not after the Reporting Period that the information relates to).",
  ),
  record("60008", "Unknown TIN", "If the TIN element is Unknown, the TIN Type should be NOTIN"),
  record(
    "60009",
    "Birth date for Individual RCASP",
    "When the Person Party Type is an Individual RCASP, the Birth Date should be 1900-01-01",
  ),
  record(
    "60010",
    "Value of Other Nexus",
    "The value of OtherNexus should be equal or inferior to the value of Nexus or correspond to CARF906.",
  ),
  record(
    "60011",
    "RCASP with Other Nexus or Crypto Users",
    "Where the MessageTypeIndic is CARF701 and unless an RCASP has populated the OtherNexus element, the CryptoUsers element needs to be provided.",
  ),
  record("80000", "DocRefID already used", "The DocRefID is already used for another record."),
  record(
    "80001",
    "DocRefID format",
    "The structure of the DocRefID is not in the correct format, as set out in the User Guide.",
  ),
  record("80002", "CorrDocRefId unknown", "The CorrDocRefId refers to an unknown record."),
  record(
    "80003",
    "CorrDocRefId no longer valid",
    "The corrected record is no longer valid (invalidated or outdated by a previous correction message). As a consequence, no further information should have been received on this version of the record.",
  ),
  record("80004", "CorrDocRefId for new data", "The initial element specifies a CorrDocRefId."),
  record(
    "80005",
    "Missing CorrDocRefId",
    "The corrected element does not specify any CorrDocRefId.",
  ),
  record(
    "80006",
    "DocSpec. CorrMessage RefID",
    "The CorrMessageRefID is forbidden within the DocSpec_Type.",
  ),
  record(
    "80007",
    "MessageSpec. CorrMessage RefID",
    "The CorrMessageRefID is forbidden within the Message Header.",
  ),
  record(
    "80008",
    "Resend option",
    "The Resend option may only be used with respect to the RCASP element.",
  ),
  record(
    "80009",
    "Delete RCASP",
    "The RCASP element cannot be deleted without deleting all related Crypto Users.",
  ),
  record(
    "80010",
    "Message TypeIndic",
    "A message can contain either new records (OECD1) or corrections/deletions (OECD2 and OECD3), but should not contain a mixture of both.",
  ),
  record(
    "80011",
    "CorrDocRefID twice in same message",
    "The same DocRefID cannot be corrected or deleted twice in the same message.",
  ),
  record(
    "80012",
    "Reporting Period",
    "A message must not contain data for two different Reporting Periods.",
  ),
  record(
    "80013",
    "Resend option, unknown DocRefID",
    "An unknown DocRefID was specified for the Resend option (OECD0).",
  ),
  record(
    "80014",
    "Resend option, DocRefID is no longer valid",
    "The DocRefID specified for the Resend option (OECD0) is no longer valid (invalidated or outdated by a previous correction message).",
  ),
  record(
    "80015",
    "CARFBody",
    "The CARFBody can be omitted only when the MessageTypeIndic is CARF703 (Nil reporting).",
  ),
  record("90000", "TIN structure", "The TIN structure is invalid", true),
  record("90001", "TIN algorithm", "The TIN is invalid against the algorithm", true),
  record("90002", "Invalid TIN semantic", "The TIN does not have a valid semantic", true),
  record(
    "99999",
    "Custom error",
    "The received message contains an error for which no specific error code exists. The details must specify what the error is.",
  ),
];

const BY_CODE = new Map(STATUS_CODES.map((info) => [info.code, info]));

/** The guide's entry for a code. Codes 98000–98999 are domestically defined record errors. */
export function describeStatusCode(code: string): StatusCodeInfo | undefined {
  const known = BY_CODE.get(code);
  if (known !== undefined) {
    return known;
  }
  if (/^98\d{3}$/.test(code)) {
    return {
      code,
      kind: "record",
      name: "Domestic error code",
      description: "These error codes may be used for domestically defined record errors.",
    };
  }
  return undefined;
}
