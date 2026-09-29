// Parties (carf:PersonParty_Type, carf:OrganisationParty_Type) and their parts, as in
// CARFXML_v1.5.xsd. Field names are the XSD element names in camelCase.
import { z } from "zod";

import { CountryCode, INType, OECDLegalAddressType, OECDNameType } from "../generated/enums.js";
import { string0to200, string1to200, string1to4000, xsdDate } from "./primitives.js";
import type { Identity, PersonParty } from "./types.js";

const countryCode = z.enum(CountryCode);

/** carf:TIN_Type. `unknown: true` with the value "NOTIN" when no TIN exists. */
const tinSchema = z.strictObject({
  value: string0to200,
  issuedBy: countryCode.optional(),
  unknown: z.boolean().optional(),
});

/** The TIN of an organisation: carf:TIN_Type restricted to at least 1 character. */
const organisationTinSchema = tinSchema.extend({ value: string1to200 });

/** carf:OrganisationIN_Type */
const organisationInSchema = z.strictObject({
  value: string1to200,
  issuedBy: countryCode.optional(),
  inType: z.enum(INType).optional(),
});

/** carf:IndividualIN_Type */
const individualInSchema = z.strictObject({
  value: string1to200,
  issuedBy: countryCode.optional(),
});

/** A name part with the optional xnlNameType attribute. */
const namePartSchema = z.strictObject({
  value: string1to200,
  xnlNameType: string1to200.optional(),
});

/** carf:NamePerson_Type */
const namePersonSchema = z.strictObject({
  nameType: z.enum(OECDNameType).optional(),
  precedingTitle: string1to200.optional(),
  titles: z.array(string1to200).optional(),
  firstName: namePartSchema,
  middleNames: z.array(namePartSchema).optional(),
  namePrefix: namePartSchema.optional(),
  lastName: namePartSchema,
  generationIdentifiers: z.array(string1to200).optional(),
  suffixes: z.array(string1to200).optional(),
  generalSuffix: string1to200.optional(),
});

/** carf:NameOrganisation_Type */
const nameOrganisationSchema = z.strictObject({
  value: string1to200,
  nameType: z.enum(OECDNameType).optional(),
});

/** carf:AddressFix_Type */
const addressFixSchema = z.strictObject({
  street: string1to200.optional(),
  buildingIdentifier: string1to200.optional(),
  suiteIdentifier: string1to200.optional(),
  floorIdentifier: string1to200.optional(),
  districtName: string1to200.optional(),
  pob: string1to200.optional(),
  postCode: string1to200.optional(),
  city: string1to200,
  countrySubentity: string1to200.optional(),
});

/** carf:Address_Type */
const addressSchema = z.strictObject({
  legalAddressType: z.enum(OECDLegalAddressType).optional(),
  countryCode,
  addressFix: addressFixSchema,
  additionalAddressInfo: string1to4000.optional(),
});

/** carf:BirthPlace_Type; CountryInfo is a choice of CountryCode or FormerCountryName. */
const birthPlaceSchema = z.strictObject({
  city: string1to200,
  citySubentity: string1to200.optional(),
  countryInfo: z.union([
    z.strictObject({ countryCode }),
    z.strictObject({ formerCountryName: string1to200 }),
  ]),
});

/** carf:PersonParty_Type */
export const personPartySchema: z.ZodType<PersonParty> = z.strictObject({
  resCountryCodes: z.array(countryCode).min(1),
  tins: z.array(tinSchema).min(1),
  iins: z.array(individualInSchema).optional(),
  names: z.array(namePersonSchema).min(1),
  addresses: z.array(addressSchema).min(1),
  /** The user guide marks Nationality "Optional (non-CARF)": not to be provided for CARF. */
  nationalities: z.array(countryCode).optional(),
  birthInfo: z.strictObject({
    birthDate: xsdDate,
    birthPlace: birthPlaceSchema.optional(),
  }),
});

/** carf:OrganisationParty_Type */
const organisationPartySchema = z.strictObject({
  resCountryCodes: z.array(countryCode).min(1),
  tins: z.array(organisationTinSchema).min(1),
  ins: z.array(organisationInSchema).optional(),
  iins: z.array(individualInSchema).optional(),
  names: z.array(nameOrganisationSchema).min(1),
  addresses: z.array(addressSchema).min(1),
});

/** The choice of Individual or Entity used by RCASP_ID and UserID. */
export const identitySchema: z.ZodType<Identity> = z.union([
  z.strictObject({ individual: personPartySchema }),
  z.strictObject({ entity: organisationPartySchema }),
]);
