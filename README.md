# @zettacore/carf-xml

Build, validate and explain **OECD Crypto-Asset Reporting Framework (CARF)** XML messages, exactly as the official OECD XML Schema defines them. Use it to produce CARF files, or to check any CARF file before you send it.

- A typed message model that mirrors the **CARF XML Schema v1.5** (July 2025). Every code list is generated from the official XSD files.
- A deterministic serializer: the same input always gives the same bytes, and you get the SHA-256 of the output.
- Two validation layers:
  - **V1** structural validation against the official XSD, with xmllint;
  - **V2** message-level business rules, mapped to the official **CARF Status Message** error codes.
- Readable errors that name the record, the field, the line and the XPath.
- A reader for CARF Status Messages (schema v1.1).
- A command line: `carf-xml validate | build | explain`.

Licensed under the Apache License, Version 2.0. This is not an OECD product.

## Requirements

- Node.js 24 or later.
- `xmllint` (libxml2) on the PATH for XSD validation. On Debian/Ubuntu, `apt-get install libxml2-utils`; it is already installed on macOS.
- **The official OECD schema files.** They are **not** bundled with this package. Download the CARF XML Schema v1.5 ZIP (and, for status messages, the CARF Status Message XML Schema v1.1 ZIP) from the OECD website. Unzip each into a folder without changing any file. Then point the package at the folder with `schemaDir`, `--schema-dir` or `CARF_SCHEMA_DIR`.
  - Before every validation the files are compared with the SHA-256 of the official files, so an altered schema is refused.
  - Known sets: `carf-v1.5-2025-07` (`CARFXML_v1.5.xsd`, `oecdcarftypes_v5.0.xsd`, `isocarftypes_v1.1.xsd`) and `carf-status-v1.1-2025-06` (`CARFStatusMessageXML_v1.1.xsd`, `isocsmtypes_v1.1.xsd`).

## Install

```bash
npm install @zettacore/carf-xml
```

## Build a message

```ts
import { asDecimalString, buildCarfXml, type CarfMessage } from "@zettacore/carf-xml";

const message: CarfMessage = {
  messageSpec: {
    transmittingCountry: "GB",
    receivingCountry: "FR",
    messageType: "CARF",
    messageRefId: "GB2027FR0000000001",
    messageTypeIndic: "CARF701",
    reportingPeriod: "2027-12-31",
    timestamp: "2028-03-01T09:00:00",
  },
  carfBodies: [
    {
      rcasp: {
        rcaspId: {
          entity: {
            resCountryCodes: ["GB"],
            tins: [{ value: "EXAMPLE-TIN", issuedBy: "GB" }],
            names: [{ value: "Example Exchange Ltd" }],
            addresses: [{ countryCode: "GB", addressFix: { city: "London" } }],
          },
        },
        nexus: "CARF901",
        docSpec: { docTypeIndic: "OECD1", docRefId: "GB2027-R-0001" },
      },
      cryptoUsers: [
        {
          userId: {
            individual: {
              resCountryCodes: ["FR"],
              tins: [{ value: "EXAMPLE-TIN-FR", issuedBy: "FR" }],
              names: [{ firstName: { value: "Alex" }, lastName: { value: "Example" } }],
              addresses: [{ countryCode: "FR", addressFix: { city: "Paris" } }],
              birthInfo: { birthDate: "1985-06-15" },
            },
          },
          relevantTransactions: [
            {
              cryptoAsset: "BTC",
              category: "CryptoFiatOut",
              entries: [
                {
                  numberOfTransactions: 1,
                  amount: { value: asDecimalString("4200.10"), currCode: "EUR" },
                  numberOfUnits: asDecimalString("0.1"),
                },
              ],
            },
          ],
          docSpec: { docTypeIndic: "OECD1", docRefId: "GB2027-U-0001" },
        },
      ],
    },
  ],
};

const { xml, sha256 } = buildCarfXml(message, {
  // The OECD user guide sets 2 decimal places for amounts and up to 6 for units,
  // but no rounding rule: supply the rule that applies in your jurisdiction.
  numberFormat: { roundingMode: "HALF_UP", amountFractionDigits: 2, unitsMaxFractionDigits: 6 },
  // Value of the optional CARF_OECD/@version attribute, or null to omit it.
  rootVersion: null,
});
```

Things to know about the model:

- **Amounts and units are decimal strings** (`DecimalString`), never JavaScript numbers.
- **One category per `RelevantTransactions`.** In the XSD, `RelevantTransactions` holds `CryptoAsset` followed by entries of one category only (a single `xsd:choice`). Report several categories for the same crypto-asset in separate `RelevantTransactions` entries with the same `cryptoAsset`.
- **Codes are allowed only where the XSD has them**:
  - `exchangeType` only on the four exchange categories;
  - `transferType` only on `CryptoTransferIn` / `CryptoTransferOut`;
  - `altValuation` only on `CryptoTransferIn`, `CryptoTransferOut` and `TransferWallet`.

  Anything else is rejected, both by the TypeScript types and at runtime.
- **No rounding mode by default.** `buildCarfXml` throws `ConfigurationRequiredError` until you give a rounding mode. `DEFAULT_NUMBER_FORMAT_POLICY` has the OECD decimal places and no rounding mode.

## Validate a file

```ts
import { readFileSync } from "node:fs";
import { validateCarfXml } from "@zettacore/carf-xml";

const report = await validateCarfXml(readFileSync("message.xml"), {
  schemaDir: "/path/to/carf-xml-schema-v1.5",
  businessRules: {
    // Optional: the DocRefId format your tax authority requires (rule V2-026).
    docRefIdFormat: /^GB2027/,
    // Optional: the last day of the reporting period this file is for (rule V2-005).
    expectedReportingPeriod: "2027-12-31",
  },
});

for (const error of report.errors) {
  console.log(error.layer, error.code, error.officialCode, error.line, error.humanMessage, error.fixHint);
}
```

Each error has these fields:
- `layer` (`V1` or `V2`) and `code`;
- `officialCode`, the Status Message code of a V2 error;
- `line`, `xpath` and `element`;
- `recordRef`, the DocRefId of the RCASP or crypto-asset user record;
- `humanMessage`, `fixHint`, and `raw` (the validator's own text).

`report.rules` gives the outcome of every V2 rule: `passed`, `failed`, `disabled`, `not_checked` or `configuration_required`.

### Validation layers

| Layer | What is checked | Source |
|---|---|---|
| V1 | The file against the official CARF XML Schema v1.5, with `xmllint --nonet --noout --schema` | The OECD XSD files |
| V2 | 26 rules that need only the message itself: V2-001 to V2-026. Each carries the official Status Message record error code where one exists (60001–60011, 80000–80015) and the page of its source | The OECD CARF Status Message User Guide (June 2025), part 4, and the CARF XML Schema User Guide v2.0 (July 2025) |

Some rules need a decision from the caller or from the tax authority:

- **V2-010 to V2-013** compare residence countries with the message's sending and receiving countries. How your tax authority applies them to domestic reports is for you to confirm. Turn them off with `disabledRules`.
- **V2-026** checks DocRefIds against a format only you can give. Without one, it reports `configuration_required`.
- **V2-005** runs only when you give the expected reporting period.

Some checks need earlier filings and cannot be done on one message. Examples: a DocRefId never used before (80000), a correction that refers to a known record (80002–80003), resend checks (80013–80014) and deleting an RCASP only with all its users (80009). They are not part of this package.

`checkBusinessRules(xml, options)` runs the V2 rules alone, without the XSD or xmllint.

## Read a CARF Status Message

```ts
import { parseCarfStatusMessage } from "@zettacore/carf-xml";

const status = await parseCarfStatusMessage(xml, { schemaDir: "/path/to/carf-status-message-schema-v1.1" });
status.status; // "Accepted" | "Rejected"
status.recordErrors; // [{ code, docRefIdsInError, fieldPaths, official: { name, description } }]
```

## Command line

```bash
# Validate: exit 0 when valid, 1 when the file has errors, 2 on a usage or setup problem.
carf-xml validate message.xml --schema-dir ./carf-xml-schema-v1.5
carf-xml validate message.xml --json --disable-rule V2-010 --docrefid-pattern '^GB2027'

# Build XML from a JSON message (the model above) and a number policy.
echo '{ "roundingMode": "HALF_UP" }' > policy.json
carf-xml build message.json --out message.xml --number-policy policy.json --omit-root-version

# Summarise a file: records per DocTypeIndic, users, crypto-assets, entries per category.
carf-xml explain message.xml
```

## What this package does not do

- It gives no tax or legal advice and does not interpret the CARF rules. It checks structure against the official schema and the message-level checks the OECD lists; that does not make a report correct or complete.
- It does not decide which users, transactions or amounts are reportable, how amounts are valued or aggregated, or which rounding rule, reporting currency or identifier formats a jurisdiction requires.
- It does not send files to any tax authority.

## Contributing

Issues and pull requests are welcome at [zettacore-labs/carf-xml](https://github.com/zettacore-labs/carf-xml). That repository is a read-only mirror of the package's source, so accepted changes are applied upstream and mirrored back.

```bash
pnpm install --ignore-workspace
pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build
```

- **Tests.** Tests that need the official XSDs and xmllint run only when `CARF_SCHEMA_DIR` (and `CARF_STATUS_SCHEMA_DIR` for status messages) point at the official schema folders. Otherwise they are reported as skipped. With them set, `pnpm run test:coverage` requires 90% coverage.
- **Synthetic data only.** Never use real personal or tax data in tests, fixtures or issues.
- **Generated files.** Code lists and the schema inventory are generated from the official XSDs, never edited by hand:
  ```bash
  pnpm inventory --carf-dir <carf-v1.5-folder> --carf-set carf-v1.5-2025-07 \
                 --status-dir <status-v1.1-folder> --status-set carf-status-v1.1-2025-06
  ```
- **Golden files** in `test/golden/` must stay byte-identical. Change them only with a reason in the pull request.

### no-decimal-arithmetic

The package's ESLint config (`eslint-rules/no-decimal-arithmetic.js`) rejects arithmetic operators, unary `+`/`-`, `parseFloat` and `Number(...)` on decimal values. Amounts and units stay exact decimal strings; rounding happens only in `NumberFormatPolicy`.

## Security

See [SECURITY.md](./SECURITY.md).
