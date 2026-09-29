// Serialises a CarfMessage to CARF XML (CARFXML_v1.5.xsd): namespaces and prefixes as the schema
// requires, elements in the order of the XSD sequences, UTF-8 with an XML declaration, and the
// same bytes for the same input.
import { createHash } from "node:crypto";

import { create } from "xmlbuilder2";
import type { XMLBuilder } from "xmlbuilder2/lib/interfaces.js";

import { CarfModelError } from "../errors.js";
import { parseCarfMessage } from "../model/message.js";
import { isXmlText, xsdLength } from "../model/primitives.js";
import type {
  Address,
  CarfMessage,
  CryptoUser,
  DocSpec,
  Identity,
  MonAmnt,
  NamePerson,
  OrganisationParty,
  PersonParty,
  Rcasp,
  RelevantTransactions,
} from "../model/types.js";
import { formatAmount, formatUnits, type NumberFormatPolicy } from "../number-format.js";

export const CARF_NAMESPACE = "urn:oecd:ties:carf:v1";
export const STF_NAMESPACE = "urn:oecd:ties:carfstf:v5";
export const ISO_NAMESPACE = "urn:oecd:ties:isocarftypes:v1";

export interface BuildOptions {
  /** How amounts and units are written; rounding must be configured (see NumberFormatPolicy). */
  readonly numberFormat: NumberFormatPolicy;
  /**
   * Value of the optional CARF_OECD/@version attribute, or null to omit it. The OECD user guide
   * states no value for it, so the caller decides; the package never supplies one.
   */
  readonly rootVersion: string | null;
}

export interface BuildResult {
  readonly xml: Buffer;
  /** Lowercase hex SHA-256 of `xml`. */
  readonly sha256: string;
}

class Writer {
  private readonly numberFormat: NumberFormatPolicy;

  constructor(numberFormat: NumberFormatPolicy) {
    this.numberFormat = numberFormat;
  }

  carf(parent: XMLBuilder, name: string, attributes?: Record<string, string>): XMLBuilder {
    return attributes === undefined
      ? parent.ele(CARF_NAMESPACE, `carf:${name}`)
      : parent.ele(CARF_NAMESPACE, `carf:${name}`, attributes);
  }

  text(
    parent: XMLBuilder,
    name: string,
    value: string | undefined,
    attributes?: Record<string, string>,
  ): void {
    if (value !== undefined) {
      this.carf(parent, name, attributes).txt(value);
    }
  }

  texts(parent: XMLBuilder, name: string, values: readonly string[] | undefined): void {
    for (const value of values ?? []) {
      this.text(parent, name, value);
    }
  }

  docSpec(parent: XMLBuilder, docSpec: DocSpec): void {
    const node = this.carf(parent, "DocSpec");
    node.ele(STF_NAMESPACE, "stf:DocTypeIndic").txt(docSpec.docTypeIndic);
    node.ele(STF_NAMESPACE, "stf:DocRefId").txt(docSpec.docRefId);
    if (docSpec.corrMessageRefId !== undefined) {
      node.ele(STF_NAMESPACE, "stf:CorrMessageRefId").txt(docSpec.corrMessageRefId);
    }
    if (docSpec.corrDocRefId !== undefined) {
      node.ele(STF_NAMESPACE, "stf:CorrDocRefId").txt(docSpec.corrDocRefId);
    }
  }

  tin(
    parent: XMLBuilder,
    tin: { value: string; issuedBy?: string | undefined; unknown?: boolean | undefined },
  ): void {
    const attributes: Record<string, string> = {};
    if (tin.issuedBy !== undefined) {
      attributes.issuedBy = tin.issuedBy;
    }
    if (tin.unknown !== undefined) {
      attributes.unknown = String(tin.unknown);
    }
    this.carf(parent, "TIN", attributes).txt(tin.value);
  }

  identifier(
    parent: XMLBuilder,
    name: string,
    id: { value: string; issuedBy?: string | undefined; inType?: string | undefined },
  ): void {
    const attributes: Record<string, string> = {};
    if (id.issuedBy !== undefined) {
      attributes.issuedBy = id.issuedBy;
    }
    if (id.inType !== undefined) {
      attributes.INType = id.inType;
    }
    this.text(parent, name, id.value, attributes);
  }

  namePart(
    parent: XMLBuilder,
    name: string,
    part: { value: string; xnlNameType?: string | undefined } | undefined,
  ): void {
    if (part !== undefined) {
      this.text(
        parent,
        name,
        part.value,
        part.xnlNameType === undefined ? undefined : { xnlNameType: part.xnlNameType },
      );
    }
  }

  personName(parent: XMLBuilder, name: NamePerson): void {
    const node = this.carf(
      parent,
      "Name",
      name.nameType === undefined ? undefined : { nameType: name.nameType },
    );
    this.text(node, "PrecedingTitle", name.precedingTitle);
    this.texts(node, "Title", name.titles);
    this.namePart(node, "FirstName", name.firstName);
    for (const middle of name.middleNames ?? []) {
      this.namePart(node, "MiddleName", middle);
    }
    this.namePart(node, "NamePrefix", name.namePrefix);
    this.namePart(node, "LastName", name.lastName);
    this.texts(node, "GenerationIdentifier", name.generationIdentifiers);
    this.texts(node, "Suffix", name.suffixes);
    this.text(node, "GeneralSuffix", name.generalSuffix);
  }

  address(parent: XMLBuilder, address: Address): void {
    const node = this.carf(
      parent,
      "Address",
      address.legalAddressType === undefined
        ? undefined
        : { legalAddressType: address.legalAddressType },
    );
    this.text(node, "CountryCode", address.countryCode);
    const fix = this.carf(node, "AddressFix");
    const parts = address.addressFix;
    this.text(fix, "Street", parts.street);
    this.text(fix, "BuildingIdentifier", parts.buildingIdentifier);
    this.text(fix, "SuiteIdentifier", parts.suiteIdentifier);
    this.text(fix, "FloorIdentifier", parts.floorIdentifier);
    this.text(fix, "DistrictName", parts.districtName);
    this.text(fix, "POB", parts.pob);
    this.text(fix, "PostCode", parts.postCode);
    this.text(fix, "City", parts.city);
    this.text(fix, "CountrySubentity", parts.countrySubentity);
    this.text(node, "AdditionalAddressInfo", address.additionalAddressInfo);
  }

  person(parent: XMLBuilder, name: string, person: PersonParty): void {
    const node = this.carf(parent, name);
    this.texts(node, "ResCountryCode", person.resCountryCodes);
    for (const tin of person.tins) {
      this.tin(node, tin);
    }
    for (const iin of person.iins ?? []) {
      this.identifier(node, "IIN", iin);
    }
    for (const personName of person.names) {
      this.personName(node, personName);
    }
    for (const address of person.addresses) {
      this.address(node, address);
    }
    this.texts(node, "Nationality", person.nationalities);
    const birthInfo = this.carf(node, "BirthInfo");
    this.text(birthInfo, "BirthDate", person.birthInfo.birthDate);
    const place = person.birthInfo.birthPlace;
    if (place !== undefined) {
      const placeNode = this.carf(birthInfo, "BirthPlace");
      this.text(placeNode, "City", place.city);
      this.text(placeNode, "CitySubentity", place.citySubentity);
      const countryInfo = this.carf(placeNode, "CountryInfo");
      if ("countryCode" in place.countryInfo) {
        this.text(countryInfo, "CountryCode", place.countryInfo.countryCode);
      } else {
        this.text(countryInfo, "FormerCountryName", place.countryInfo.formerCountryName);
      }
    }
  }

  organisation(parent: XMLBuilder, organisation: OrganisationParty): void {
    const node = this.carf(parent, "Entity");
    this.texts(node, "ResCountryCode", organisation.resCountryCodes);
    for (const tin of organisation.tins) {
      this.tin(node, tin);
    }
    for (const id of organisation.ins ?? []) {
      this.identifier(node, "IN", id);
    }
    for (const iin of organisation.iins ?? []) {
      this.identifier(node, "IIN", iin);
    }
    for (const name of organisation.names) {
      this.text(
        node,
        "Name",
        name.value,
        name.nameType === undefined ? undefined : { nameType: name.nameType },
      );
    }
    for (const address of organisation.addresses) {
      this.address(node, address);
    }
  }

  identity(parent: XMLBuilder, name: string, identity: Identity): void {
    const node = this.carf(parent, name);
    if ("individual" in identity) {
      this.person(node, "Individual", identity.individual);
    } else {
      this.organisation(node, identity.entity);
    }
  }

  rcasp(parent: XMLBuilder, rcasp: Rcasp): void {
    const node = this.carf(parent, "RCASP");
    this.identity(node, "RCASP_ID", rcasp.rcaspId);
    this.text(node, "Nexus", rcasp.nexus);
    if (rcasp.otherNexus !== undefined) {
      this.carf(node, "OtherNexus", {
        Nexus: rcasp.otherNexus.nexus,
        ResCountryCode: rcasp.otherNexus.resCountryCode,
      });
    }
    this.docSpec(node, rcasp.docSpec);
  }

  amount(parent: XMLBuilder, amount: MonAmnt): void {
    this.text(parent, "Amount", formatAmount(amount.value, this.numberFormat), {
      currCode: amount.currCode,
    });
  }

  relevantTransactions(parent: XMLBuilder, transactions: RelevantTransactions): void {
    const node = this.carf(parent, "RelevantTransactions");
    this.text(node, "CryptoAsset", transactions.cryptoAsset);
    const units = (value: Parameters<typeof formatUnits>[0]): string =>
      formatUnits(value, this.numberFormat);
    switch (transactions.category) {
      case "CryptoToCryptoIn":
      case "CryptoToCryptoOut":
      case "CryptoFiatIn":
      case "CryptoFiatOut":
        for (const entry of transactions.entries) {
          const item = this.carf(node, transactions.category);
          this.text(item, "ExchangeType", entry.exchangeType);
          this.text(item, "NumberofTransactions", String(entry.numberOfTransactions));
          this.amount(item, entry.amount);
          this.text(item, "NumberofUnits", units(entry.numberOfUnits));
        }
        break;
      case "CryptoTransferIn":
      case "CryptoTransferOut":
        for (const entry of transactions.entries) {
          const item = this.carf(node, transactions.category);
          this.text(item, "TransferType", entry.transferType);
          this.text(item, "NumberofTransactions", String(entry.numberOfTransactions));
          this.amount(item, entry.amount);
          this.text(item, "NumberofUnits", units(entry.numberOfUnits));
          this.text(item, "AltValuation", entry.altValuation);
        }
        break;
      case "TransferWallet":
        for (const entry of transactions.entries) {
          const item = this.carf(node, "TransferWallet");
          this.amount(item, entry.amount);
          this.text(item, "NumberofUnits", units(entry.numberOfUnits));
          this.text(item, "AltValuation", entry.altValuation);
        }
        break;
      case "RRPT":
        for (const entry of transactions.entries) {
          const item = this.carf(node, "RRPT");
          this.text(item, "NumberofTransactions", String(entry.numberOfTransactions));
          this.amount(item, entry.amount);
          this.text(item, "NumberofUnits", units(entry.numberOfUnits));
        }
        break;
    }
  }

  cryptoUser(parent: XMLBuilder, user: CryptoUser): void {
    const node = this.carf(parent, "CryptoUsers");
    this.identity(node, "UserID", user.userId);
    for (const person of user.controllingPersons ?? []) {
      const cp = this.carf(node, "ControllingPerson");
      this.person(cp, "Individual", person.individual);
      this.texts(cp, "CtrlgPersonType", person.ctrlgPersonTypes);
    }
    for (const transactions of user.relevantTransactions) {
      this.relevantTransactions(node, transactions);
    }
    this.docSpec(node, user.docSpec);
  }

  message(message: CarfMessage, rootVersion: string | null): string {
    const attributes: Record<string, string> = {
      "xmlns:carf": CARF_NAMESPACE,
      "xmlns:stf": STF_NAMESPACE,
      "xmlns:iso": ISO_NAMESPACE,
    };
    if (rootVersion !== null) {
      attributes.version = rootVersion;
    }
    const doc = create({ version: "1.0", encoding: "UTF-8" });
    const root = doc.ele(CARF_NAMESPACE, "carf:CARF_OECD", attributes);
    const spec = this.carf(root, "MessageSpec");
    const ms = message.messageSpec;
    this.text(spec, "SendingEntityIN", ms.sendingEntityIn);
    this.text(spec, "TransmittingCountry", ms.transmittingCountry);
    this.text(spec, "ReceivingCountry", ms.receivingCountry);
    this.text(spec, "MessageType", ms.messageType);
    this.text(spec, "Warning", ms.warning);
    this.text(spec, "Contact", ms.contact);
    this.text(spec, "MessageRefId", ms.messageRefId);
    this.text(spec, "MessageTypeIndic", ms.messageTypeIndic);
    this.text(spec, "ReportingPeriod", ms.reportingPeriod);
    this.text(spec, "Timestamp", ms.timestamp);
    for (const body of message.carfBodies ?? []) {
      const bodyNode = this.carf(root, "CARFBody");
      this.rcasp(bodyNode, body.rcasp);
      for (const user of body.cryptoUsers ?? []) {
        this.cryptoUser(bodyNode, user);
      }
    }
    return `${doc.end({ prettyPrint: true, indent: "  ", newline: "\n" })}\n`;
  }
}

/**
 * Builds the XML of a CARF message. The input is validated against the model first, so
 * untyped input (e.g. parsed JSON) is safe to pass. Throws CarfModelError on invalid input and
 * ConfigurationRequiredError when the number format has no rounding mode.
 */
export function buildCarfXml(message: CarfMessage, options: BuildOptions): BuildResult {
  const valid = parseCarfMessage(message);
  const version = options.rootVersion;
  if (
    version !== null &&
    (!isXmlText(version) || xsdLength(version) < 1 || xsdLength(version) > 10)
  ) {
    throw new CarfModelError([{ path: "rootVersion", message: "must be 1 to 10 characters" }]);
  }
  const xml = Buffer.from(new Writer(options.numberFormat).message(valid, version), "utf8");
  return { xml, sha256: createHash("sha256").update(xml).digest("hex") };
}
