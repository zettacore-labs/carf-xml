// The CARF message model: one interface per type of CARFXML_v1.5.xsd, field names in camelCase.
// Code lists come from src/generated/enums.ts (generated from the XSD). The runtime schemas in
// party.ts, transactions.ts and message.ts are checked against these interfaces.
import type { DecimalString } from "../decimal.js";
import type {
  AltValuation,
  CarfCtrlgPersonType,
  CarfMessageTypeIndic,
  CountryCode,
  CurrCode,
  ExchangeType,
  INType,
  MessageType,
  Nexus,
  OECDDocTypeIndic,
  OECDLegalAddressType,
  OECDNameType,
  TransferOutType,
  TransferType,
} from "../generated/enums.js";

/** carf:TIN_Type. Unknown TIN: value "NOTIN" with `unknown: true`. */
export interface Tin {
  readonly value: string;
  readonly issuedBy?: CountryCode | undefined;
  readonly unknown?: boolean | undefined;
}

/** carf:OrganisationIN_Type */
export interface OrganisationIn {
  readonly value: string;
  readonly issuedBy?: CountryCode | undefined;
  readonly inType?: INType | undefined;
}

/** carf:IndividualIN_Type */
export interface IndividualIn {
  readonly value: string;
  readonly issuedBy?: CountryCode | undefined;
}

/** A name part with its optional xnlNameType attribute. */
export interface NamePart {
  readonly value: string;
  readonly xnlNameType?: string | undefined;
}

/** carf:NamePerson_Type */
export interface NamePerson {
  readonly nameType?: OECDNameType | undefined;
  readonly precedingTitle?: string | undefined;
  readonly titles?: readonly string[] | undefined;
  readonly firstName: NamePart;
  readonly middleNames?: readonly NamePart[] | undefined;
  readonly namePrefix?: NamePart | undefined;
  readonly lastName: NamePart;
  readonly generationIdentifiers?: readonly string[] | undefined;
  readonly suffixes?: readonly string[] | undefined;
  readonly generalSuffix?: string | undefined;
}

/** carf:NameOrganisation_Type */
export interface NameOrganisation {
  readonly value: string;
  readonly nameType?: OECDNameType | undefined;
}

/** carf:AddressFix_Type */
export interface AddressFix {
  readonly street?: string | undefined;
  readonly buildingIdentifier?: string | undefined;
  readonly suiteIdentifier?: string | undefined;
  readonly floorIdentifier?: string | undefined;
  readonly districtName?: string | undefined;
  readonly pob?: string | undefined;
  readonly postCode?: string | undefined;
  readonly city: string;
  readonly countrySubentity?: string | undefined;
}

/** carf:Address_Type */
export interface Address {
  readonly legalAddressType?: OECDLegalAddressType | undefined;
  readonly countryCode: CountryCode;
  readonly addressFix: AddressFix;
  readonly additionalAddressInfo?: string | undefined;
}

/** carf:BirthPlace_Type; CountryInfo is a choice of CountryCode or FormerCountryName. */
export interface BirthPlace {
  readonly city: string;
  readonly citySubentity?: string | undefined;
  readonly countryInfo:
    { readonly countryCode: CountryCode } | { readonly formerCountryName: string };
}

/** carf:PersonParty_Type */
export interface PersonParty {
  readonly resCountryCodes: readonly CountryCode[];
  readonly tins: readonly Tin[];
  readonly iins?: readonly IndividualIn[] | undefined;
  readonly names: readonly NamePerson[];
  readonly addresses: readonly Address[];
  /** The OECD user guide marks Nationality "Optional (non-CARF)": not to be reported for CARF. */
  readonly nationalities?: readonly CountryCode[] | undefined;
  readonly birthInfo: {
    /** YYYY-MM-DD */
    readonly birthDate: string;
    readonly birthPlace?: BirthPlace | undefined;
  };
}

/** carf:OrganisationParty_Type */
export interface OrganisationParty {
  readonly resCountryCodes: readonly CountryCode[];
  readonly tins: readonly Tin[];
  readonly ins?: readonly OrganisationIn[] | undefined;
  readonly iins?: readonly IndividualIn[] | undefined;
  readonly names: readonly NameOrganisation[];
  readonly addresses: readonly Address[];
}

/** The choice of Individual or Entity used by RCASP_ID and UserID. */
export type Identity =
  { readonly individual: PersonParty } | { readonly entity: OrganisationParty };

/** carf:MonAmnt_Type: a decimal amount with its ISO 4217 currency code. */
export interface MonAmnt {
  readonly value: DecimalString;
  readonly currCode: CurrCode;
}

/** An entry of CryptoToCryptoIn, CryptoToCryptoOut, CryptoFiatIn or CryptoFiatOut. */
export interface ExchangeEntry {
  readonly exchangeType?: ExchangeType | undefined;
  readonly numberOfTransactions: number;
  readonly amount: MonAmnt;
  readonly numberOfUnits: DecimalString;
}

/** An entry of CryptoTransferIn. */
export interface TransferInEntry {
  readonly transferType: TransferType;
  readonly numberOfTransactions: number;
  readonly amount: MonAmnt;
  readonly numberOfUnits: DecimalString;
  readonly altValuation?: AltValuation | undefined;
}

/** An entry of CryptoTransferOut. */
export interface TransferOutEntry {
  readonly transferType: TransferOutType;
  readonly numberOfTransactions: number;
  readonly amount: MonAmnt;
  readonly numberOfUnits: DecimalString;
  readonly altValuation?: AltValuation | undefined;
}

/** An entry of TransferWallet. */
export interface TransferWalletEntry {
  readonly amount: MonAmnt;
  readonly numberOfUnits: DecimalString;
  readonly altValuation?: AltValuation | undefined;
}

/** An entry of RRPT (reportable retail payment transactions). */
export interface RrptEntry {
  readonly numberOfTransactions: number;
  readonly amount: MonAmnt;
  readonly numberOfUnits: DecimalString;
}

interface Category<C extends string, E> {
  readonly cryptoAsset: string;
  readonly category: C;
  readonly entries: readonly E[];
}

/**
 * carf:RelevantTransactions_Type: CryptoAsset and the entries of ONE category (the XSD has a
 * single choice). Use one RelevantTransactions per category of the same crypto-asset.
 */
export type RelevantTransactions =
  | Category<"CryptoToCryptoIn", ExchangeEntry>
  | Category<"CryptoToCryptoOut", ExchangeEntry>
  | Category<"CryptoFiatIn", ExchangeEntry>
  | Category<"CryptoFiatOut", ExchangeEntry>
  | Category<"CryptoTransferIn", TransferInEntry>
  | Category<"CryptoTransferOut", TransferOutEntry>
  | Category<"TransferWallet", TransferWalletEntry>
  | Category<"RRPT", RrptEntry>;

/** stf:DocSpec_Type */
export interface DocSpec {
  readonly docTypeIndic: OECDDocTypeIndic;
  readonly docRefId: string;
  readonly corrMessageRefId?: string | undefined;
  readonly corrDocRefId?: string | undefined;
}

/** carf:RCASP_Type */
export interface Rcasp {
  readonly rcaspId: Identity;
  readonly nexus?: Nexus | undefined;
  readonly otherNexus?: { readonly nexus: Nexus; readonly resCountryCode: CountryCode } | undefined;
  readonly docSpec: DocSpec;
}

/** carf:ControllingPerson_Type */
export interface ControllingPerson {
  readonly individual: PersonParty;
  readonly ctrlgPersonTypes: readonly CarfCtrlgPersonType[];
}

/** carf:CryptoUsers_Type */
export interface CryptoUser {
  readonly userId: Identity;
  readonly controllingPersons?: readonly ControllingPerson[] | undefined;
  readonly relevantTransactions: readonly RelevantTransactions[];
  readonly docSpec: DocSpec;
}

/** carf:CARFBody_Type */
export interface CarfBody {
  readonly rcasp: Rcasp;
  readonly cryptoUsers?: readonly CryptoUser[] | undefined;
}

/** carf:MessageSpec_Type */
export interface MessageSpec {
  readonly sendingEntityIn?: string | undefined;
  readonly transmittingCountry: CountryCode;
  readonly receivingCountry: CountryCode;
  readonly messageType: MessageType;
  readonly warning?: string | undefined;
  readonly contact?: string | undefined;
  readonly messageRefId: string;
  readonly messageTypeIndic: CarfMessageTypeIndic;
  /** YYYY-MM-DD, the last day of the reporting period. */
  readonly reportingPeriod: string;
  /** xsd:dateTime; the user guide's format is YYYY-MM-DDThh:mm:ss[.nnn]. */
  readonly timestamp: string;
}

/** Element CARF_OECD. */
export interface CarfMessage {
  readonly messageSpec: MessageSpec;
  readonly carfBodies?: readonly CarfBody[] | undefined;
}
