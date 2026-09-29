// CARF Status Messages against the official Status Message XSD v1.1.
import { describe, expect, it } from "vitest";

import { parseCarfStatusMessage, StatusMessageError } from "../src/index.js";
import { fixedValidator, STATUS_XML } from "./status-fixtures.js";
import { CARF_STATUS_SCHEMA_DIR, HAS_STATUS_SCHEMAS } from "./helpers.js";

describe.skipIf(!HAS_STATUS_SCHEMAS)("parseCarfStatusMessage", () => {
  const schemaDir = CARF_STATUS_SCHEMA_DIR ?? "";

  it("validates and reads a status message", async () => {
    const status = await parseCarfStatusMessage(STATUS_XML, { schemaDir });
    expect(status.status).toBe("Rejected");
    expect(status.version).toBe("1.1");
    expect(status.originalMessageRefId).toBe("GB2027FRGOLDEN0001");
    expect(status.messageSpec).toMatchObject({
      sendingCompanyIn: "TEST-SENDER-0001",
      transmittingCountry: "FR",
      messageRefId: "StatusFR2027GB0001",
    });
    expect(status.fileMetaData).toEqual({
      ctsTransmissionId: "TEST-CTS-0001",
      ctsSendingTimeStamp: "2028-03-01T09:30:00",
      uncompressedFileSizeKbQty: "12",
    });
    expect(status.validatedBy).toEqual(["Synthetic validator 1.0"]);
    expect(status.fileErrors).toEqual([
      expect.objectContaining({
        code: "50007",
        details: { text: "Synthetic detail", language: "EN" },
      }),
    ]);
    expect(status.fileErrors[0]?.official?.name).toBe("Failed Schema Validation");
    const [amount, domestic, unknown] = status.recordErrors;
    expect(amount).toMatchObject({
      code: "60001",
      docRefIdsInError: ["GB2027-GOLDEN-U-0001"],
      fieldPaths: ["CARF_OECD/CARFBody/CryptoUsers/RelevantTransactions/CryptoFiatOut/Amount"],
    });
    expect(amount?.official?.description).toBe("The amount must be greater than or equal to zero.");
    expect(domestic?.details).toEqual({ text: "Domestic check" });
    expect(domestic?.official?.name).toBe("Domestic error code");
    expect(unknown?.official).toBeUndefined();
  });

  it("reads an accepted message without errors", async () => {
    const accepted = STATUS_XML.replace(
      /<csm:ValidationErrors>[\s\S]*<\/csm:ValidationErrors>/,
      "<csm:ValidationErrors/>",
    ).replace("Rejected", "Accepted");
    const status = await parseCarfStatusMessage(accepted, { schemaDir });
    expect(status.status).toBe("Accepted");
    expect(status.fileErrors).toEqual([]);
    expect(status.recordErrors).toEqual([]);
  });

  it("reads a minimal message with only the required elements", async () => {
    const minimal = `<?xml version="1.0" encoding="UTF-8"?>
<csm:CARFStatusMessage_OECD xmlns:csm="urn:oecd:ties:csm:v2">
  <csm:MessageSpec>
    <csm:TransmittingCountry>FR</csm:TransmittingCountry>
    <csm:ReceivingCountry>GB</csm:ReceivingCountry>
    <csm:MessageType>CARFMessageStatus</csm:MessageType>
    <csm:Warning>Synthetic warning</csm:Warning>
    <csm:Contact>Synthetic contact</csm:Contact>
    <csm:MessageRefId>StatusFR2027GB0002</csm:MessageRefId>
    <csm:Timestamp>2028-03-02T10:00:00</csm:Timestamp>
  </csm:MessageSpec>
  <csm:CARFStatusMessage>
    <csm:OriginalMessage><csm:FileMetaData/></csm:OriginalMessage>
    <csm:ValidationErrors><csm:FileError><csm:Code>50002</csm:Code></csm:FileError></csm:ValidationErrors>
    <csm:ValidationResult><csm:Status>Rejected</csm:Status><csm:ValidatedBy>v</csm:ValidatedBy></csm:ValidationResult>
  </csm:CARFStatusMessage>
</csm:CARFStatusMessage_OECD>
`;
    const status = await parseCarfStatusMessage(minimal, { schemaDir });
    expect(status.version).toBeUndefined();
    expect(status.originalMessageRefId).toBeUndefined();
    expect(status.fileMetaData).toEqual({});
    expect(status.messageSpec).toEqual({
      transmittingCountry: "FR",
      receivingCountry: "GB",
      messageType: "CARFMessageStatus",
      warning: "Synthetic warning",
      contact: "Synthetic contact",
      messageRefId: "StatusFR2027GB0002",
      timestamp: "2028-03-02T10:00:00",
    });
    expect(status.fileErrors).toEqual([expect.objectContaining({ code: "50002" })]);
    expect(status.fileErrors[0]?.details).toBeUndefined();
  });

  it("reads a message without file metadata", async () => {
    const withoutMeta = STATUS_XML.replace(/<csm:FileMetaData>[\s\S]*<\/csm:FileMetaData>/, "");
    const status = await parseCarfStatusMessage(withoutMeta, { schemaDir });
    expect(status.fileMetaData).toBeUndefined();
  });

  it("rejects a message that does not match the Status Message XSD", async () => {
    const invalid = STATUS_XML.replace(
      "<csm:Status>Rejected</csm:Status>",
      "<csm:Status>Maybe</csm:Status>",
    );
    await expect(parseCarfStatusMessage(invalid, { schemaDir })).rejects.toThrow(
      StatusMessageError,
    );
  });

  it("uses a caller-supplied validator", async () => {
    const validator = fixedValidator({ valid: true, issues: [], validatedBy: "test" });
    const status = await parseCarfStatusMessage(Buffer.from(STATUS_XML), { schemaDir, validator });
    expect(status.status).toBe("Rejected");
    expect(validator.schemaPaths[0]).toMatch(/CARFStatusMessageXML_v1\.1\.xsd$/);
  });
});
