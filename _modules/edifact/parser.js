/**
 * EDIFACT Parser — Shared Parsing Primitives
 * ===========================================
 * Extracted from _workers/edifactAnalysisBuilder.js for reuse in tools.
 *
 * Pure functions — no side effects, no DB, no LLM.
 * Single source of truth for EDIFACT segment parsing.
 */

// ==================== DELIMITER PARSING ====================

/**
 * Parse UNA service string to extract delimiters
 * @param {string} raw - Raw EDIFACT content
 * @returns {object} Delimiter config
 */
export function parseUNA(raw) {
    const defaults = {
        componentSeparator: ':',
        fieldSeparator: '+',
        decimalNotation: '.',
        escapeCharacter: '?',
        reserved: ' ',
        segmentTerminator: "'",
        hasUNA: false
    };

    if (raw.startsWith('UNA')) {
        return {
            componentSeparator: raw[3] || defaults.componentSeparator,
            fieldSeparator: raw[4] || defaults.fieldSeparator,
            decimalNotation: raw[5] || defaults.decimalNotation,
            escapeCharacter: raw[6] || defaults.escapeCharacter,
            reserved: raw[7] || defaults.reserved,
            segmentTerminator: raw[8] || defaults.segmentTerminator,
            hasUNA: true
        };
    }

    return defaults;
}

// ==================== SEGMENT SPLITTING ====================

/**
 * Split string by delimiter respecting escape character
 * @param {string} str - String to split
 * @param {string} delimiter - Delimiter character
 * @param {string} escape - Escape character
 * @returns {string[]} Split parts
 */
export function splitWithEscape(str, delimiter, escape) {
    const parts = [];
    let current = '';

    for (let i = 0; i < str.length; i++) {
        if (str[i] === escape && i + 1 < str.length && str[i + 1] === delimiter) {
            current += delimiter;
            i++;
            continue;
        }
        if (str[i] === delimiter) {
            parts.push(current);
            current = '';
            continue;
        }
        current += str[i];
    }
    parts.push(current);
    return parts;
}

/**
 * Split raw EDIFACT content into segment strings
 * @param {string} raw - Raw EDIFACT content
 * @param {object} delimiters - Parsed delimiters from parseUNA()
 * @returns {string[]} Array of raw segment strings (without terminators)
 */
export function splitSegments(raw, delimiters) {
    const { segmentTerminator, escapeCharacter } = delimiters;
    const segments = [];
    let current = '';

    // Skip UNA if present
    let startIndex = 0;
    if (raw.startsWith('UNA')) {
        startIndex = 9;
        while (startIndex < raw.length && (raw[startIndex] === '\n' || raw[startIndex] === '\r')) {
            startIndex++;
        }
    }

    for (let i = startIndex; i < raw.length; i++) {
        const char = raw[i];

        if (char === escapeCharacter && i + 1 < raw.length && raw[i + 1] === segmentTerminator) {
            current += segmentTerminator;
            i++;
            continue;
        }

        if (char === segmentTerminator) {
            const trimmed = current.trim();
            if (trimmed.length > 0) {
                segments.push(trimmed);
            }
            current = '';
            continue;
        }

        if (char === '\n' || char === '\r') {
            continue;
        }

        current += char;
    }

    const trimmed = current.trim();
    if (trimmed.length > 0) {
        segments.push(trimmed);
    }

    return segments;
}

// ==================== SEGMENT PARSING ====================

/**
 * Parse a single segment string into structured tag + fields
 * @param {string} segmentStr - Raw segment string (e.g., "DTM+137:20170210:102")
 * @param {object} delimiters - Parsed delimiters
 * @returns {object} { tag, fields: [{ index, value, components, isComposite }], raw }
 */
export function parseSegment(segmentStr, delimiters) {
    const { fieldSeparator, componentSeparator, escapeCharacter } = delimiters;

    const fields = splitWithEscape(segmentStr, fieldSeparator, escapeCharacter);
    const tag = fields[0] || '';

    const parsedFields = fields.slice(1).map((field, index) => {
        const components = splitWithEscape(field, componentSeparator, escapeCharacter);
        return {
            index,
            value: field,
            components,
            isComposite: components.length > 1
        };
    });

    return { tag, fields: parsedFields, raw: segmentStr };
}

// ==================== HIGH-LEVEL PARSING ====================

/**
 * Parse raw EDIFACT string into an array of structured segments
 * Convenience function that chains parseUNA → splitSegments → parseSegment
 *
 * @param {string} raw - Raw EDIFACT content
 * @returns {object} { delimiters, segments: [{ tag, fields, raw, position }] }
 */
export function parseRawEdifact(raw) {
    if (!raw || typeof raw !== 'string') {
        return { delimiters: parseUNA(''), segments: [] };
    }

    const delimiters = parseUNA(raw);
    const segmentStrings = splitSegments(raw, delimiters);
    const segments = segmentStrings.map((str, index) => {
        const parsed = parseSegment(str, delimiters);
        return { ...parsed, position: index + 1 };
    });

    return { delimiters, segments };
}

// ==================== DATE PARSING ====================

/**
 * Parse EDIFACT date string according to format qualifier
 * @param {string} dateStr - Date string
 * @param {string} format - Format code (102=CCYYMMDD, 203=CCYYMMDDHHMM, etc.)
 * @returns {Date|null} Parsed Date or null
 */
export function parseEdifactDate(dateStr, format) {
    if (!dateStr) return null;

    try {
        switch (format) {
            case '102': {
                const y = dateStr.slice(0, 4);
                const m = dateStr.slice(4, 6);
                const d = dateStr.slice(6, 8);
                return new Date(`${y}-${m}-${d}T00:00:00Z`);
            }
            case '203': {
                const y = dateStr.slice(0, 4);
                const m = dateStr.slice(4, 6);
                const d = dateStr.slice(6, 8);
                const h = dateStr.slice(8, 10);
                const min = dateStr.slice(10, 12);
                return new Date(`${y}-${m}-${d}T${h}:${min}:00Z`);
            }
            default: {
                if (dateStr.length === 6) {
                    const y = '20' + dateStr.slice(0, 2);
                    const m = dateStr.slice(2, 4);
                    const d = dateStr.slice(4, 6);
                    return new Date(`${y}-${m}-${d}T00:00:00Z`);
                }
                if (dateStr.length === 8) {
                    const y = dateStr.slice(0, 4);
                    const m = dateStr.slice(4, 6);
                    const d = dateStr.slice(6, 8);
                    return new Date(`${y}-${m}-${d}T00:00:00Z`);
                }
                return null;
            }
        }
    } catch {
        return null;
    }
}

// ==================== PARTY QUALIFIER LABELS ====================

/**
 * Map EDIFACT party qualifier code to human-readable label
 * @param {string} qualifier - Party qualifier (e.g., "BY", "SU")
 * @returns {string} Label
 */
export function partyQualifierLabel(qualifier) {
    const labels = {
        'BY': 'Buyer', 'SE': 'Seller', 'SU': 'Supplier',
        'DP': 'Delivery Party', 'IV': 'Invoicee', 'MR': 'Message Recipient',
        'MS': 'Message Sender', 'PE': 'Payee', 'PR': 'Payer',
        'ST': 'Ship To', 'SF': 'Ship From', 'UC': 'Ultimate Consignee',
        'CN': 'Consignee', 'CZ': 'Consignor', 'CA': 'Carrier',
        'FW': 'Freight Forwarder', 'II': 'Issuer of Invoice'
    };
    return labels[qualifier] || qualifier;
}

// ==================== KNOWN SEGMENTS ====================

/**
 * Set of known EDIFACT segment tags
 */
export const KNOWN_SEGMENT_TAGS = new Set([
    'UNA', 'UNB', 'UNH', 'UNT', 'UNZ', 'UNS', 'UNG', 'UNE',
    'BGM', 'DTM', 'MOA', 'RFF', 'NAD', 'CTA', 'COM', 'CUX',
    'LIN', 'PIA', 'IMD', 'QTY', 'PRI', 'ALI', 'ALC', 'TAX',
    'FTX', 'TDT', 'LOC', 'PAT', 'PCD', 'GIN', 'GIR', 'MEA',
    'SCC', 'CNT', 'TOD', 'EQD', 'SEL', 'PAC', 'PCI', 'RNG',
    'DOC', 'STS', 'IDE', 'TSR', 'FII', 'DGS', 'ERP',
    'RCS', 'AJT'
]);

/**
 * DTM qualifier to semantic meaning mapping
 */
export const DTM_QUALIFIERS = {
    '2': 'Delivery date/time, requested',
    '3': 'Invoice date/time',
    '7': 'Effective date/time',
    '35': 'Delivery date/time, actual',
    '36': 'Expiry date',
    '37': 'Ship not before date/time',
    '38': 'Ship not later than date/time',
    '61': 'Cancel if not delivered by this date',
    '63': 'Delivery date/time, latest',
    '64': 'Delivery date/time, earliest',
    '69': 'Promissory payment guarantee date',
    '71': 'Delivery date/time, requested (at destination)',
    '76': 'Order amendment date',
    '131': 'Tax point date/time',
    '137': 'Document/message date/time',
    '140': 'Payment due date/time',
    '171': 'Reference date/time',
    '263': 'Invoicing period'
};

/**
 * RFF qualifier to semantic meaning mapping
 */
export const RFF_QUALIFIERS = {
    'AAB': 'Proforma invoice number',
    'AAK': 'Despatch advice number',
    'ACE': 'Related document number',
    'ACD': 'Additional reference number',
    'AEF': 'Project number',
    'AGI': 'Request number',
    'ALO': 'Receiving advice number',
    'API': 'Additional party identification',
    'AV': 'Account number',
    'BC': 'Buyer contract number',
    'CR': 'Customer reference number',
    'CT': 'Contract number/date',
    'DL': 'Debit note number',
    'DQ': 'Delivery note number',
    'GN': 'Government reference number',
    'IL': 'Internal order number',
    'IP': 'Import permit number',
    'IV': 'Invoice number',
    'ON': 'Order number (buyer)',
    'PK': 'Packing list number',
    'PL': 'Price list number',
    'PO': 'Purchase order number',
    'RF': 'Export reference number',
    'SS': 'Seller\'s reference number (Seller)',
    'VA': 'VAT registration number',
    'VN': 'Order number (supplier)',
    'XA': 'Company/place registration number'
};

/**
 * NAD qualifier labels (extended)
 */
export const NAD_QUALIFIERS = {
    'BY': 'Buyer',
    'SE': 'Seller',
    'SU': 'Supplier',
    'DP': 'Delivery Party',
    'IV': 'Invoicee',
    'MR': 'Message Recipient',
    'MS': 'Message Sender',
    'PE': 'Payee',
    'PR': 'Payer',
    'ST': 'Ship To',
    'SF': 'Ship From',
    'UC': 'Ultimate Consignee',
    'CN': 'Consignee',
    'CZ': 'Consignor',
    'CA': 'Carrier',
    'FW': 'Freight Forwarder',
    'II': 'Issuer of Invoice'
};
