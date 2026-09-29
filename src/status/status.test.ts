import { describe, expect, it } from "vitest";

import { STATUS_XML } from "../../test/status-fixtures.js";
import { describeStatusCode, STATUS_CODES } from "./codes.js";
import { parseCarfStatusMessage } from "./parse.js";

describe("status codes", () => {
  it("lists the file and record codes of the guide", () => {
    expect(STATUS_CODES.filter((c) => c.kind === "file").map((c) => c.code)).toHaveLength(13);
    expect(STATUS_CODES.filter((c) => c.kind === "record")).toHaveLength(31);
    expect(describeStatusCode("80009")?.description).toBe(
      "The RCASP element cannot be deleted without deleting all related Crypto Users.",
    );
    expect(describeStatusCode("50001")?.action).toBe("Please resubmit the file.");
    expect(describeStatusCode("90000")?.reserved).toBe(true);
    expect(describeStatusCode("98123")?.name).toBe("Domestic error code");
    expect(describeStatusCode("12345")).toBeUndefined();
  });
});

describe("parseCarfStatusMessage (with a stand-in validator)", () => {
  it("needs the official status schema files", async () => {
    await expect(parseCarfStatusMessage(STATUS_XML, { schemaDir: "/nonexistent" })).rejects.toThrow(
      /Official OECD XSD missing/,
    );
  });
});
