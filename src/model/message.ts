// The CARF message (element CARF_OECD of CARFXML_v1.5.xsd): MessageSpec, then CARF bodies with
// the RCASP and its crypto-asset users.
import { z } from "zod";

import {
  CarfCtrlgPersonType,
  CarfMessageTypeIndic,
  CountryCode,
  MessageType,
  Nexus,
  OECDDocTypeIndic,
} from "../generated/enums.js";
import { CarfModelError } from "../errors.js";
import { identitySchema, personPartySchema } from "./party.js";
import { string1to170, string1to200, string1to4000, xsdDate, xsdDateTime } from "./primitives.js";
import { relevantTransactionsSchema } from "./transactions.js";
import type { CarfMessage } from "./types.js";

const countryCode = z.enum(CountryCode);

/** stf:DocSpec_Type */
const docSpecSchema = z.strictObject({
  docTypeIndic: z.enum(OECDDocTypeIndic),
  docRefId: string1to200,
  corrMessageRefId: string1to170.optional(),
  corrDocRefId: string1to200.optional(),
});

/** carf:RCASP_Type */
const rcaspSchema = z.strictObject({
  rcaspId: identitySchema,
  nexus: z.enum(Nexus).optional(),
  otherNexus: z.strictObject({ nexus: z.enum(Nexus), resCountryCode: countryCode }).optional(),
  docSpec: docSpecSchema,
});

/** carf:ControllingPerson_Type */
const controllingPersonSchema = z.strictObject({
  individual: personPartySchema,
  ctrlgPersonTypes: z.array(z.enum(CarfCtrlgPersonType)).min(1),
});

/** carf:CryptoUsers_Type */
const cryptoUserSchema = z.strictObject({
  userId: identitySchema,
  controllingPersons: z.array(controllingPersonSchema).optional(),
  relevantTransactions: z.array(relevantTransactionsSchema).min(1),
  docSpec: docSpecSchema,
});

/** carf:CARFBody_Type */
const carfBodySchema = z.strictObject({
  rcasp: rcaspSchema,
  cryptoUsers: z.array(cryptoUserSchema).optional(),
});

/** carf:MessageSpec_Type */
const messageSpecSchema = z.strictObject({
  sendingEntityIn: string1to200.optional(),
  transmittingCountry: countryCode,
  receivingCountry: countryCode,
  messageType: z.enum(MessageType),
  warning: string1to4000.optional(),
  contact: string1to4000.optional(),
  messageRefId: string1to170,
  messageTypeIndic: z.enum(CarfMessageTypeIndic),
  reportingPeriod: xsdDate,
  timestamp: xsdDateTime,
});

/** Element CARF_OECD. */
export const carfMessageSchema: z.ZodType<CarfMessage> = z.strictObject({
  messageSpec: messageSpecSchema,
  carfBodies: z.array(carfBodySchema).optional(),
});

/** Validates untyped input (e.g. parsed JSON) against the model. Throws CarfModelError. */
export function parseCarfMessage(input: unknown): CarfMessage {
  const result = carfMessageSchema.safeParse(input);
  if (!result.success) {
    throw new CarfModelError(
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}
