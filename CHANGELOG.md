# Changelog

All notable changes to `@zettacore/carf-xml` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [0.1.0] - Unreleased

### Added
- Typed CARF message model mirroring the OECD CARF XML Schema v1.5, with runtime validation.
  Code lists are generated from the official XSD files.
- `buildCarfXml`: deterministic serializer (same input, same bytes) with a SHA-256 of the output.
  Amounts and units are written by a `NumberFormatPolicy`; the rounding mode must be supplied.
- `validateCarfXml`: XSD validation with xmllint (`--nonet`) and 26 message-level business rules
  (V2-001 to V2-026) mapped to the official CARF Status Message error codes, with readable
  errors that give the record, line and XPath.
- `parseCarfStatusMessage` for CARF Status Messages (schema v1.1), with the official
  descriptions of each error code.
- `explainCarfXml` and the `carf-xml` command line (`validate`, `build`, `explain`).
