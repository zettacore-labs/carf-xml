// Plain-language names for CARF elements and attributes, taken only from what the OECD CARF XML
// Schema User Guide v2.0 (July 2025) says each one is (page in the comment). Elements the guide
// does not describe are shown by their XML name.

/** [path suffix, label] — the longest matching suffix wins. */
const ELEMENT_LABELS: readonly (readonly [string, string])[] = [
  ["MessageSpec", "message header"], // p. 8
  ["SendingEntityIN", "sending entity identification number"], // p. 8
  ["TransmittingCountry", "transmitting country"], // p. 8
  ["ReceivingCountry", "receiving country"], // p. 8
  ["MessageType", "message type"], // p. 8
  ["Warning", "warning"], // p. 8
  ["Contact", "contact information"], // p. 8
  ["MessageRefId", "message reference ID"], // p. 9
  ["MessageTypeIndic", "message type indicator"], // p. 9
  ["ReportingPeriod", "reporting period (last day)"], // p. 9
  ["Timestamp", "timestamp"], // p. 9
  ["CARFBody", "CARF body"], // p. 17
  ["RCASP", "reporting crypto-asset service provider (RCASP)"], // p. 17
  ["RCASP_ID", "RCASP identification"], // p. 18
  ["Nexus", "nexus"], // p. 18
  ["OtherNexus", "other nexus"], // p. 19
  ["CryptoUsers", "crypto-asset user"], // p. 19
  ["UserID", "user identification"], // p. 20
  ["ControllingPerson", "controlling person"], // p. 20
  ["CtrlgPersonType", "controlling person type"], // p. 21
  ["Individual", "individual"], // pp. 18, 20
  ["Entity", "entity"], // pp. 18, 20
  ["ResCountryCode", "country of residence"], // pp. 10, 14
  ["TIN", "tax identification number (TIN)"], // pp. 10, 14
  ["IN", "entity identification number"], // p. 11
  ["IIN", "individual identification number"], // pp. 11, 14
  ["Name", "name"], // p. 15
  ["Entity/Name", "legal name"], // pp. 11–12
  ["FirstName", "first name"], // p. 15
  ["MiddleName", "middle name"], // p. 15
  ["LastName", "last name"], // pp. 15–16
  ["Address", "address"], // p. 12
  ["Address/CountryCode", "country of the address"], // p. 12
  ["AddressFix", "address in fixed format"], // p. 12
  ["AdditionalAddressInfo", "additional address information"], // p. 12
  ["AddressFix/City", "city"], // p. 13
  ["CountrySubentity", "state, region or department"], // p. 13, footnote 2
  ["Nationality", "nationality"], // p. 14
  ["BirthInfo", "birth information"], // p. 16
  ["BirthDate", "date of birth"], // p. 16
  ["BirthPlace", "place of birth"], // p. 16
  ["BirthPlace/City", "city of birth"], // p. 17
  ["CountryInfo", "country of birth"], // p. 17
  ["CountryInfo/CountryCode", "country of birth"], // p. 17
  ["FormerCountryName", "former country of birth"], // p. 17
  ["DocSpec", "document specification"], // pp. 18, 29
  ["DocTypeIndic", "document type indicator"], // p. 29
  ["DocRefId", "document reference ID"], // p. 30
  ["CorrDocRefId", "reference to the corrected record (CorrDocRefId)"], // p. 30
  ["RelevantTransactions", "relevant transactions"], // p. 21
  ["CryptoAsset", "crypto-asset name"], // p. 21
  ["CryptoToCryptoIn", "acquisitions against other crypto-assets"], // p. 22
  ["CryptoToCryptoOut", "disposals against other crypto-assets"], // p. 22
  ["CryptoFiatIn", "acquisitions against fiat currency"], // p. 23
  ["CryptoFiatOut", "disposals against fiat currency"], // p. 24
  ["CryptoTransferIn", "inbound transfers"], // p. 25
  ["CryptoTransferOut", "outbound transfers"], // p. 26
  [
    "TransferWallet",
    "transfers to wallet addresses not known to belong to a virtual asset service provider or financial institution",
  ], // p. 27
  ["RRPT", "reportable retail payment transactions"], // p. 28
  ["ExchangeType", "exchange type"], // p. 22
  ["NumberofTransactions", "number of transactions"], // p. 22
  ["Amount", "amount"], // p. 22
  ["NumberofUnits", "number of units"], // p. 22
  ["TransferType", "transfer type"], // p. 25
  ["AltValuation", "alternative valuation method"], // pp. 25–26
];

const ATTRIBUTE_LABELS: Readonly<Record<string, string>> = {
  currCode: "currency code", // p. 22
  issuedBy: "issuing country", // p. 11
  unknown: "unknown flag", // p. 11
  INType: "identification number type", // p. 11
  legalAddressType: "legal address type", // p. 12
  nameType: "name type", // p. 15
};

/** Label for an element, from its path ("A/B/C") or local name. Unknown elements keep their name. */
export function elementLabel(pathOrName: string): string {
  let best: readonly [string, string] | undefined;
  for (const entry of ELEMENT_LABELS) {
    const [suffix] = entry;
    const matches = pathOrName === suffix || pathOrName.endsWith(`/${suffix}`);
    if (matches && (best === undefined || suffix.length > best[0].length)) {
      best = entry;
    }
  }
  const name = pathOrName.split("/").at(-1) ?? pathOrName;
  return best?.[1] ?? name;
}

export function attributeLabel(name: string): string {
  return ATTRIBUTE_LABELS[name] ?? `attribute ${name}`;
}
