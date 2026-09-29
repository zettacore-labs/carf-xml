// A synthetic CARF Status Message and a stand-in validator, shared by the status tests.
import type { SchemaValidationResult, SchemaValidator } from "../src/validate/schema-validator.js";

export const STATUS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<csm:CARFStatusMessage_OECD xmlns:csm="urn:oecd:ties:csm:v2" version="1.1">
  <csm:MessageSpec>
    <csm:SendingCompanyIN>TEST-SENDER-0001</csm:SendingCompanyIN>
    <csm:TransmittingCountry>FR</csm:TransmittingCountry>
    <csm:ReceivingCountry>GB</csm:ReceivingCountry>
    <csm:MessageType>CARFMessageStatus</csm:MessageType>
    <csm:MessageRefId>StatusFR2027GB0001</csm:MessageRefId>
    <csm:Timestamp>2028-03-02T10:00:00</csm:Timestamp>
  </csm:MessageSpec>
  <csm:CARFStatusMessage>
    <csm:OriginalMessage>
      <csm:OriginalMessageRefID>GB2027FRGOLDEN0001</csm:OriginalMessageRefID>
      <csm:FileMetaData>
        <csm:CTSTransmissionID>TEST-CTS-0001</csm:CTSTransmissionID>
        <csm:CTSSendingTimeStamp>2028-03-01T09:30:00</csm:CTSSendingTimeStamp>
        <csm:UncompressedFileSizeKBQty>12</csm:UncompressedFileSizeKBQty>
      </csm:FileMetaData>
    </csm:OriginalMessage>
    <csm:ValidationErrors>
      <csm:FileError>
        <csm:Code>50007</csm:Code>
        <csm:Details Language="EN">Synthetic detail</csm:Details>
      </csm:FileError>
      <csm:RecordError>
        <csm:Code>60001</csm:Code>
        <csm:DocRefIDInError>GB2027-GOLDEN-U-0001</csm:DocRefIDInError>
        <csm:FieldsInError>
          <csm:FieldPath>CARF_OECD/CARFBody/CryptoUsers/RelevantTransactions/CryptoFiatOut/Amount</csm:FieldPath>
        </csm:FieldsInError>
      </csm:RecordError>
      <csm:RecordError>
        <csm:Code>98001</csm:Code>
        <csm:Details>Domestic check</csm:Details>
      </csm:RecordError>
      <csm:RecordError>
        <csm:Code>12345</csm:Code>
      </csm:RecordError>
    </csm:ValidationErrors>
    <csm:ValidationResult>
      <csm:Status>Rejected</csm:Status>
      <csm:ValidatedBy>Synthetic validator 1.0</csm:ValidatedBy>
    </csm:ValidationResult>
  </csm:CARFStatusMessage>
</csm:CARFStatusMessage_OECD>
`;

/** A validator that returns a fixed result, for tests without xmllint. */
export function fixedValidator(
  result: SchemaValidationResult,
): SchemaValidator & { schemaPaths: string[] } {
  const schemaPaths: string[] = [];
  return {
    schemaPaths,
    validate: (_xml, schemaPath) => {
      schemaPaths.push(schemaPath);
      return Promise.resolve(result);
    },
  };
}
