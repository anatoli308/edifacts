/**
 * EDIFACT Knowledge Base — seed corpus
 * =====================================
 * Pure-data module that yields every chunk we want indexed in pgvector.
 *
 * Sources:
 *   - DTM / RFF / NAD qualifier maps exported from `_modules/edifact/parser.js`
 *   - BGM document types (UN/CEFACT Code List 1001)
 *   - ISO 4217 currency codes (subset; broader coverage via `currencyConvert`)
 *   - ISO 3166-1 alpha-2 country codes (subset)
 *   - EANCOM / GS1 message profiles (INVOIC, ORDERS, DESADV, ORDRSP, RECADV)
 *   - Long-form concept chunks for service segments and envelope structure
 *
 * This file is deliberately a thin enumerator — no Prisma, no embeddings.
 * The seeder calls `getAllChunks()` and feeds the result through writer.upsertChunks.
 */

import {
    DTM_QUALIFIERS,
    RFF_QUALIFIERS,
    NAD_QUALIFIERS,
} from '../../../_modules/edifact/parser.js';

const SOURCE = 'EDIFACT_CODE_LIST';
const PROFILE_SOURCE = 'GS1_PROFILE';
const CONCEPT_SOURCE = 'EDIFACT_CONCEPT';

// ---------------------------------------------------------------------------
// Coded data (UN/EDIFACT code lists + EANCOM/GS1 profiles)
// ---------------------------------------------------------------------------

/**
 * Long-form role descriptions for NAD qualifiers. Used to enrich chunk content
 * so semantic search hits on natural-language synonyms (e.g. "party that pays"
 * → BY/IV) instead of only the short label.
 */
const NAD_ROLE_DESCRIPTIONS = {
    BY: 'The Buyer is the legal entity that places the order and is contractually obligated to pay for the goods or services. The Buyer is the party that orders, purchases, and pays. Often identical to the Invoicee but can differ in central-billing scenarios.',
    SE: 'The Seller is the legal entity that owns the goods at the moment of sale and issues the invoice. The Seller is the contractual counterpart of the Buyer and the party that receives payment.',
    SU: 'The Supplier is the operational party that physically supplies or despatches the goods. In many transactions the Supplier and the Seller are the same legal entity, but they can differ (e.g. drop-shipping, contract manufacturing).',
    DP: 'The Delivery Party is the location or entity to which goods are physically delivered. In retail this is typically a store or distribution centre rather than the legal Buyer.',
    IV: 'The Invoicee is the party to whom the invoice is addressed and who is legally responsible for settlement. Often identical to the Buyer but can differ when a central billing office handles payment for multiple buyers.',
    MR: 'The Message Recipient is the EDI-technical recipient of the message, i.e. the party whose system processes the file. Distinct from the business parties — typically a clearing centre or large hub.',
    MS: 'The Message Sender is the EDI-technical sender of the message, i.e. the party whose system produced and transmitted the file. Distinct from the business parties.',
    PE: 'The Payee is the bank account holder who actually receives the funds. Often identical to the Seller but can differ in factoring or assignment scenarios.',
    PR: 'The Payer is the bank account holder who actually transfers the funds. Often identical to the Buyer but can differ in central-payment scenarios.',
    ST: 'The Ship-To party is the physical destination of the goods. Used on transport and despatch documents to identify the final unloading point.',
    SF: 'The Ship-From party is the physical origin of the goods. Used on transport and despatch documents to identify the loading point.',
    UC: 'The Ultimate Consignee is the final recipient of the goods after any intermediate consignees, typically required in customs and cross-border declarations.',
    CN: 'The Consignee is the party to whom goods are consigned for transport, named on the transport document. May or may not be the Buyer.',
    CZ: 'The Consignor is the party that hands the goods over to the carrier, named on the transport document. May or may not be the Seller.',
    CA: 'The Carrier is the transport company that physically moves the goods between Consignor and Consignee.',
    FW: 'The Freight Forwarder is the logistics intermediary that arranges the transport on behalf of Consignor or Consignee, often consolidating multiple shipments.',
    II: 'The Issuer of Invoice is the party that produces and issues the invoice document. Usually identical to the Seller, but can differ in self-billing or invoicing-on-behalf-of arrangements.',
};

const QTY_QUALIFIERS = {
    '1': 'Discrete quantity',
    '12': 'Despatch quantity',
    '21': 'Ordered quantity',
    '46': 'Delivered quantity',
    '52': 'Quantity per pack',
    '59': 'Number of consumer units in the traded unit',
    '61': 'Returnable container quantity',
    '113': 'Quantity to be delivered',
    '124': 'Damaged goods quantity',
    '128': 'Inventoried quantity',
    '187': 'Invoiced quantity',
    '192': 'Free goods quantity',
    '194': 'Received quantity',
    '199': 'Total quantity',
    '203': 'Cumulative quantity',
};

const MOA_QUALIFIERS = {
    '9': 'Amount due / amount payable',
    '38': 'Invoice item amount',
    '39': 'Invoice total amount',
    '52': 'Discount amount',
    '79': 'Total line items amount',
    '86': 'Message total monetary amount (grand total)',
    '98': 'Original amount',
    '113': 'Prepaid amount',
    '124': 'Tax amount',
    '125': 'Taxable amount',
    '128': 'Total amount including taxes',
    '131': 'Total charges',
    '146': 'Unit price (basis)',
    '176': 'Message total VAT amount',
    '203': 'Line item amount',
    '259': 'Total contribution amount',
    '260': 'Original currency amount',
};

const PRI_QUALIFIERS = {
    AAA: 'Calculation net (price excludes any allowances/charges and tax)',
    AAB: 'Calculation gross (price includes allowances/charges, excludes tax)',
    AAE: 'Information price (not used for calculation)',
    AAF: 'Item unit price',
    AAG: 'Net retail price',
    CUP: 'Cost price',
    DPR: 'Discount reference price',
    INV: 'Invoice price',
    NTP: 'Net target price',
    RGP: 'Regulated price',
    SRP: 'Suggested retail price',
};

const BGM_DOCUMENT_TYPES = {
    '105': 'Purchase order',
    '220': 'Order',
    '221': 'Blanket order',
    '223': 'Hire order',
    '224': 'Spare parts order',
    '225': 'Campaign order',
    '226': 'Production order',
    '227': 'Service order',
    '241': 'Delivery instructions',
    '242': 'Despatch advice',
    '245': 'Delivery release',
    '248': 'Authorization for repair',
    '251': 'Inquiry',
    '270': 'Delivery note',
    '325': 'Proforma invoice',
    '326': 'Partial invoice',
    '380': 'Commercial invoice',
    '381': 'Credit note',
    '383': 'Debit note',
    '384': 'Corrected invoice',
    '385': 'Consolidated invoice',
    '386': 'Prepayment invoice',
    '389': 'Self-billed invoice',
    '393': 'Factored invoice',
    '394': 'Lease invoice',
    '395': 'Consignment invoice',
    '457': 'Order acknowledgement',
    '632': 'Receiving advice',
    '700': 'Customs declaration',
    '703': 'Booking confirmation',
    '750': 'Despatch order',
    '751': 'Inventory report',
};

const CURRENCY_CODES = {
    EUR: 'Euro',
    USD: 'US Dollar',
    GBP: 'Pound Sterling',
    CHF: 'Swiss Franc',
    JPY: 'Japanese Yen',
    CNY: 'Chinese Yuan Renminbi',
    SEK: 'Swedish Krona',
    NOK: 'Norwegian Krone',
    DKK: 'Danish Krone',
    PLN: 'Polish Zloty',
    CZK: 'Czech Koruna',
    HUF: 'Hungarian Forint',
    CAD: 'Canadian Dollar',
    AUD: 'Australian Dollar',
    TRY: 'Turkish Lira',
};

const COUNTRY_CODES = {
    DE: 'Germany',  AT: 'Austria',  CH: 'Switzerland',  FR: 'France',
    IT: 'Italy',    ES: 'Spain',    NL: 'Netherlands',  BE: 'Belgium',
    LU: 'Luxembourg', GB: 'United Kingdom', IE: 'Ireland',  DK: 'Denmark',
    SE: 'Sweden',   NO: 'Norway',   FI: 'Finland',      PL: 'Poland',
    CZ: 'Czech Republic', SK: 'Slovakia', HU: 'Hungary', PT: 'Portugal',
    GR: 'Greece',   US: 'United States', CA: 'Canada',  JP: 'Japan', CN: 'China',
};

const GS1_PROFILES = [
    {
        code: 'INVOIC',
        title: 'EANCOM Invoice (INVOIC)',
        mandatory: ['UNH', 'BGM', 'DTM', 'NAD', 'CUX', 'LIN', 'MOA', 'UNS', 'UNT'],
        mandatoryParties: ['BY', 'SE'],
        notes: 'INVOIC carries a commercial invoice between supplier and buyer. At minimum one BY (Buyer) and SE (Seller) NAD segment must be present. The MOA segment must include a grand total amount (qualifier 9 or 86). CUX specifies the invoice currency. Use BGM 380 for a standard commercial invoice, 381 for a credit note, 383 for a debit note.',
    },
    {
        code: 'ORDERS',
        title: 'EANCOM Purchase Order (ORDERS)',
        mandatory: ['UNH', 'BGM', 'DTM', 'NAD', 'LIN', 'UNS', 'UNT'],
        mandatoryParties: ['BY', 'SU'],
        notes: 'ORDERS issues a purchase order from buyer to supplier. Requires at least one buyer (BY) and supplier (SU) party identification. DTM should include a requested delivery date (qualifier 2 or 71). Each line item is carried in a LIN segment with PIA for GTIN, QTY for ordered quantity, PRI for unit price.',
    },
    {
        code: 'DESADV',
        title: 'EANCOM Despatch Advice (DESADV)',
        mandatory: ['UNH', 'BGM', 'DTM', 'NAD', 'CPS', 'LIN', 'UNT'],
        mandatoryParties: ['SU', 'BY'],
        notes: 'DESADV announces a despatch from supplier to buyer ahead of physical delivery. CPS (Consignment Packing Sequence) is mandatory and describes the hierarchical packaging (pallet → carton → unit). RFF AAK carries the despatch advice number, RFF ON the original order number.',
    },
    {
        code: 'ORDRSP',
        title: 'EANCOM Order Response (ORDRSP)',
        mandatory: ['UNH', 'BGM', 'DTM', 'NAD', 'LIN', 'UNT'],
        mandatoryParties: ['BY', 'SU'],
        notes: 'ORDRSP is the supplier acknowledging or modifying an inbound ORDERS. BGM 457 marks an order acknowledgement. Line-level changes (substitutions, partial confirmations) use the LIN/PIA/QTY group with action codes in IMD or in segment group qualifiers.',
    },
    {
        code: 'RECADV',
        title: 'EANCOM Receiving Advice (RECADV)',
        mandatory: ['UNH', 'BGM', 'DTM', 'NAD', 'LIN', 'UNT'],
        mandatoryParties: ['SU', 'BY'],
        notes: 'RECADV reports goods receipt from buyer back to supplier. BGM 632 marks a receiving advice. Discrepancies between despatched and received quantities are signalled per LIN via QTY qualifiers (e.g. 194 received, 196 damaged).',
    },
];

// ---------------------------------------------------------------------------
// Concept chunks — long-form descriptions for semantic retrieval
// ---------------------------------------------------------------------------

const CONCEPTS = [
    {
        title: 'Interchange header segment UNB',
        content: 'UNB is the Interchange Header — the very first segment of every EDIFACT interchange. UNB declares the syntax identifier and version (UNOA, UNOB, UNOC, UNOY — defining the character set scope), the sender identification and qualifier, the recipient identification and qualifier, the date and time of preparation, a unique interchange control reference, an optional recipient reference / password, an application reference, a processing priority code, an acknowledgement request flag, a communications agreement ID, and a test indicator. UNB opens the envelope that UNZ later closes. The sender ID and interchange reference together must be unique per recipient to prevent duplicate processing.',
    },
    {
        title: 'Interchange trailer segment UNZ',
        content: 'UNZ is the Interchange Trailer — the very last segment of every EDIFACT interchange and the counterpart of UNB. UNZ carries two data elements: the count of messages or functional groups contained in the interchange, and the interchange control reference that must match the one declared in UNB. If the count in UNZ disagrees with the actual number of UNH/UNT pairs, or if the control reference does not match UNB, the interchange is structurally invalid and must be rejected by the receiver.',
    },
    {
        title: 'Message envelope: UNH and UNT',
        content: 'UNH (Message Header) opens an individual message and identifies the message type (INVOIC, ORDERS, DESADV, etc.), version (D), release (96A, 01B), controlling agency (UN), and association assigned code (EAN008 for EANCOM, ZZ for proprietary). UNT (Message Trailer) closes the message and carries a segment count plus the same message reference number from UNH. Mismatching segment counts in UNT break the message.',
    },
    {
        title: 'Service segment UNS',
        content: 'UNS (Section Control) splits a message into header, detail, and summary sections. UNS+D marks the start of the detail section, UNS+S the start of the summary. INVOIC and ORDERS both require a UNS+S before the summary MOA/CNT group. Missing UNS+S is one of the most common reasons a message fails downstream parsing.',
    },
    {
        title: 'Segment group BGM (Beginning of Message)',
        content: 'BGM declares what kind of business document the message represents and assigns a document number. The first data element is the document/message name code (UN/CEFACT code list 1001 — e.g. 380 commercial invoice, 220 order, 242 despatch advice). The second element is the document number assigned by the sender. BGM also carries a message function code (9 original, 31 copy, 4 change, 5 replace, 7 duplicate).',
    },
    {
        title: 'Date/time qualifiers (DTM)',
        content: 'DTM segments carry every date and time in a message. The first sub-element is the qualifier (code list 2005). Common values: 137 document date, 35 actual delivery, 2 requested delivery, 11 despatch, 131 tax point, 140 payment due, 263 invoicing period. The second sub-element is the date itself, third is the format code (102 = CCYYMMDD, 203 = CCYYMMDDHHMM, 718 = period CCYYMMDD-CCYYMMDD).',
    },
    {
        title: 'Reference segments (RFF)',
        content: 'RFF segments cross-reference external documents and identifiers. The qualifier (code list 1153) declares what kind of reference: ON buyer order number, VN supplier order number, IV invoice number, DQ delivery note number, CT contract number, VA VAT registration, AAK despatch advice. RFF can appear at message level (covers the whole document) or inside segment groups (covers one line, one party, one charge).',
    },
    {
        title: 'Party identification (NAD)',
        content: 'NAD identifies a business party and its role in the transaction. The role qualifier (code list 3035) is mandatory: BY buyer, SE seller, SU supplier, DP delivery party, IV invoicee, PE payee, ST ship-to, SF ship-from, CN consignee, CZ consignor, CA carrier. A party can be referenced by GLN (party identification field with code-list qualifier 9) or by free-form name and address lines.',
    },
    {
        title: 'Line items (LIN, PIA, IMD, QTY, PRI)',
        content: 'Every business line lives in a LIN segment group. LIN carries the line number and the primary article identifier (typically a GTIN with PIA SA or EN). PIA carries additional/alternative identifiers (manufacturer code, customer code). IMD describes the item in free text. QTY carries quantities with qualifiers: 21 ordered, 12 despatched, 194 received, 192 free goods. PRI carries the unit price with type qualifier (AAA net, AAB gross, AAE information).',
    },
    {
        title: 'Monetary amounts (MOA) and taxes (TAX, ALC)',
        content: 'MOA carries monetary amounts with qualifier (code list 5025): 9 invoice line item amount, 79 total line items amount, 124 tax amount, 125 taxable amount, 86 grand total, 113 prepaid amount, 176 message total VAT amount. TAX declares a tax category (qualifier 5283: 7 VAT, 8 income tax) plus rate. ALC (Allowance or Charge) carries surcharges and discounts; chained with MOA for the amount and PCD for the percentage.',
    },
    {
        title: 'Currency declarations (CUX)',
        content: 'CUX declares the currencies used in the message. Each occurrence carries one currency with role qualifier (2 reference, 3 target, 10 pricing, 11 payment). INVOIC almost always carries at least one CUX+2 (reference currency = invoice currency) using an ISO 4217 three-letter code. CUX can also carry an exchange rate when more than one currency is in play.',
    },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the full chunk corpus. Each chunk is a plain object ready for
 * `lib/ai/rag/writer.upsertChunks`.
 *
 * @returns {Array<{source: string, category: string, code: (string|null), title: string, content: string, metadata: object}>}
 */
export const getAllChunks = () => {
    /** @type {Array<object>} */
    const chunks = [];

    for (const [code, label] of Object.entries(DTM_QUALIFIERS)) {
        chunks.push({
            source: SOURCE,
            category: 'DTM_QUALIFIER',
            code,
            title: `DTM qualifier ${code} — ${label}`,
            content: `EDIFACT DTM segment date/time qualifier ${code} means "${label}". Use this code in the first sub-element of a DTM segment to declare what kind of date or time follows.`,
            metadata: { codeList: '2005', segment: 'DTM' },
        });
    }

    for (const [code, label] of Object.entries(RFF_QUALIFIERS)) {
        chunks.push({
            source: SOURCE,
            category: 'RFF_QUALIFIER',
            code,
            title: `RFF qualifier ${code} — ${label}`,
            content: `EDIFACT RFF segment reference qualifier ${code} means "${label}". Use this code in the first sub-element of an RFF segment to declare what external document or identifier is being referenced.`,
            metadata: { codeList: '1153', segment: 'RFF' },
        });
    }

    for (const [code, label] of Object.entries(NAD_QUALIFIERS)) {
        const description = NAD_ROLE_DESCRIPTIONS[code];
        const baseContent = `EDIFACT NAD segment party-role qualifier ${code} identifies a party as "${label}". This is the first data element of every NAD segment and is mandatory.`;
        const content = description ? `${baseContent}\n\n${description}` : baseContent;
        chunks.push({
            source: SOURCE,
            category: 'NAD_QUALIFIER',
            code,
            title: `NAD party qualifier ${code} — ${label}`,
            content,
            metadata: { codeList: '3035', segment: 'NAD' },
        });
    }

    for (const [code, label] of Object.entries(BGM_DOCUMENT_TYPES)) {
        chunks.push({
            source: SOURCE,
            category: 'BGM_DOCUMENT_TYPE',
            code,
            title: `BGM document type ${code} — ${label}`,
            content: `EDIFACT BGM segment document/message name code ${code} represents a "${label}". This code appears in the first sub-element of BGM and tells the receiver what kind of business document the message contains.`,
            metadata: { codeList: '1001', segment: 'BGM' },
        });
    }

    for (const [code, label] of Object.entries(CURRENCY_CODES)) {
        chunks.push({
            source: SOURCE,
            category: 'CURRENCY',
            code,
            title: `Currency ${code} — ${label}`,
            content: `ISO 4217 currency code ${code} represents the ${label}. Used inside CUX segments to declare invoice, pricing, or payment currency.`,
            metadata: { codeList: '6345', segment: 'CUX', iso: '4217' },
        });
    }

    for (const [code, label] of Object.entries(COUNTRY_CODES)) {
        chunks.push({
            source: SOURCE,
            category: 'COUNTRY',
            code,
            title: `Country ${code} — ${label}`,
            content: `ISO 3166-1 alpha-2 country code ${code} represents ${label}. Used inside NAD segments (country sub-element) and TAX segments (jurisdiction).`,
            metadata: { codeList: '3207', iso: '3166-1' },
        });
    }

    for (const [code, label] of Object.entries(QTY_QUALIFIERS)) {
        chunks.push({
            source: SOURCE,
            category: 'QTY_QUALIFIER',
            code,
            title: `QTY qualifier ${code} — ${label}`,
            content: `EDIFACT QTY segment quantity qualifier ${code} means "${label}". Use this code in the first sub-element of a QTY segment to declare what kind of quantity follows. Common in LIN segment groups for ordered, despatched, delivered, received, and invoiced quantities.`,
            metadata: { codeList: '6063', segment: 'QTY' },
        });
    }

    for (const [code, label] of Object.entries(MOA_QUALIFIERS)) {
        chunks.push({
            source: SOURCE,
            category: 'MOA_QUALIFIER',
            code,
            title: `MOA qualifier ${code} — ${label}`,
            content: `EDIFACT MOA segment monetary-amount qualifier ${code} means "${label}". Use this code in the first sub-element of a MOA segment to declare what the monetary amount represents (line total, grand total, tax, prepaid, discount, etc.).`,
            metadata: { codeList: '5025', segment: 'MOA' },
        });
    }

    for (const [code, label] of Object.entries(PRI_QUALIFIERS)) {
        chunks.push({
            source: SOURCE,
            category: 'PRI_QUALIFIER',
            code,
            title: `PRI qualifier ${code} — ${label}`,
            content: `EDIFACT PRI segment price qualifier ${code} means "${label}". Use this code in the first sub-element of a PRI segment to declare what kind of price follows (net, gross, information-only, etc.).`,
            metadata: { codeList: '5125', segment: 'PRI' },
        });
    }

    for (const profile of GS1_PROFILES) {
        chunks.push({
            source: PROFILE_SOURCE,
            category: 'GS1_MESSAGE_PROFILE',
            code: profile.code,
            title: profile.title,
            content: `${profile.notes}\n\nMandatory segments: ${profile.mandatory.join(', ')}.\nMandatory parties: ${profile.mandatoryParties.join(', ')}.`,
            metadata: {
                mandatorySegments: profile.mandatory,
                mandatoryParties: profile.mandatoryParties,
            },
        });
    }

    for (const concept of CONCEPTS) {
        chunks.push({
            source: CONCEPT_SOURCE,
            category: 'EDIFACT_CONCEPT',
            code: null,
            title: concept.title,
            content: concept.content,
            metadata: {},
        });
    }

    return chunks;
};
