# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub: open the **Security** tab of
[zettacore-labs/carf-xml](https://github.com/zettacore-labs/carf-xml) and choose **Report a
vulnerability**. Do not open a public issue for a vulnerability, and do not include real
personal or tax data in a report: use synthetic data to reproduce the problem.

## Supported versions

Only the latest published version receives fixes.

## How the package handles untrusted input

- XML is parsed with [saxes](https://github.com/lddubeau/saxes), which does not process DTDs or
  external entities, so a file cannot make the parser read local files, reach the network or
  expand entity bombs.
- Schema validation runs `xmllint` with `--nonet`, through `execFile` (no shell), on a private
  temporary copy of the file, with a timeout (120 seconds by default).
- Validation never uses an altered schema: the files in the schema folder are compared with the
  SHA-256 of the official OECD files before use.
- Error messages repeat a value only when it is a code from a code list (for example a currency
  code). Names, identification numbers, dates and other free text are never repeated. The
  validator's original message is kept in the `raw` field of each error; treat it as sensitive.
