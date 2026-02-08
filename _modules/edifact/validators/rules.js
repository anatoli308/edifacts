/**
 * EDIFACT Rules Engine & Configuration
 * ====================================
 * Declarative, configurable validation rules for EDIFACT messages.
 *
 * Rule Types:
 *  SEGMENT   — required/forbidden segments, cardinality
 *  FIELD     — data type, format, length, valid values
 *  ENVELOPE  — structural integrity (counts, references)
 *  BUSINESS  — cross-segment consistency, domain logic
 *  COMPLIANCE — standard-specific constraints
 *
 * Each rule:
 *  { code, type, severity, description, appliesTo, check(ctx) → bool|{pass,detail} }
 *
 * appliesTo:
 *  { messageTypes: [...] | '*', standards: [...] | '*' }
 *  '*' means the rule applies to all message types / standards.
 */

// ─────────────────────────────────────────────────────────────
//  Required segments per message type
//  Key = message type, Value = array of { tag, label, severity }
// ─────────────────────────────────────────────────────────────

const _BASE_REQUIRED = [
    { tag: 'UNB', label: 'Interchange Header', severity: 'error' },
    { tag: 'UNH', label: 'Message Header', severity: 'error' },
    { tag: 'BGM', label: 'Beginning of Message', severity: 'warning' },
    { tag: 'UNT', label: 'Message Trailer', severity: 'error' },
    { tag: 'UNZ', label: 'Interchange Trailer', severity: 'error' }
];

const _MSG_REQUIRED_SEGMENTS = {
    INVOIC: [
        ..._BASE_REQUIRED,
        { tag: 'DTM', label: 'Date/Time', severity: 'warning' },
        { tag: 'NAD', label: 'Name and Address', severity: 'warning' },
        { tag: 'MOA', label: 'Monetary Amount', severity: 'warning' },
        { tag: 'LIN', label: 'Line Item', severity: 'info' },
        { tag: 'UNS', label: 'Section Control', severity: 'info' }
    ],
    ORDERS: [
        ..._BASE_REQUIRED,
        { tag: 'DTM', label: 'Date/Time', severity: 'warning' },
        { tag: 'NAD', label: 'Name and Address', severity: 'warning' },
        { tag: 'LIN', label: 'Line Item', severity: 'warning' }
    ],
    DESADV: [
        ..._BASE_REQUIRED,
        { tag: 'DTM', label: 'Date/Time', severity: 'warning' },
        { tag: 'NAD', label: 'Name and Address', severity: 'warning' },
        { tag: 'CPS', label: 'Consignment Packing Sequence', severity: 'info' }
    ],
    ORDRSP: [
        ..._BASE_REQUIRED,
        { tag: 'DTM', label: 'Date/Time', severity: 'warning' },
        { tag: 'NAD', label: 'Name and Address', severity: 'warning' },
        { tag: 'LIN', label: 'Line Item', severity: 'warning' },
        { tag: 'RFF', label: 'Reference', severity: 'warning' }
    ],
    PRICAT: [
        ..._BASE_REQUIRED,
        { tag: 'DTM', label: 'Date/Time', severity: 'warning' },
        { tag: 'NAD', label: 'Name and Address', severity: 'warning' },
        { tag: 'LIN', label: 'Line Item', severity: 'warning' },
        { tag: 'PRI', label: 'Price Details', severity: 'warning' }
    ],
    RECADV: [
        ..._BASE_REQUIRED,
        { tag: 'DTM', label: 'Date/Time', severity: 'warning' },
        { tag: 'NAD', label: 'Name and Address', severity: 'warning' }
    ],
    REMADV: [
        ..._BASE_REQUIRED,
        { tag: 'DTM', label: 'Date/Time', severity: 'warning' },
        { tag: 'NAD', label: 'Name and Address', severity: 'warning' },
        { tag: 'MOA', label: 'Monetary Amount', severity: 'warning' },
        { tag: 'RFF', label: 'Reference', severity: 'warning' }
    ],
    CONTRL: [
        ..._BASE_REQUIRED,
        { tag: 'UCI', label: 'Interchange Response', severity: 'warning' }
    ],
    APERAK: [
        ..._BASE_REQUIRED,
        { tag: 'RFF', label: 'Reference', severity: 'warning' }
    ]
};

// ─────────────────────────────────────────────────────────────
//  Field format rules
//  Reusable patterns for field-level validation
// ─────────────────────────────────────────────────────────────

const _FIELD_FORMATS = {
    GLN:  { pattern: /^\d{13}$/, label: 'GLN (13 digits)' },
    EAN:  { pattern: /^\d{8,14}$/, label: 'EAN/GTIN (8-14 digits)' },
    ISO_CURRENCY: { pattern: /^[A-Z]{3}$/, label: 'ISO 4217 currency (3 letters)' },
    DATE_102: { pattern: /^\d{8}$/, label: 'Date CCYYMMDD (8 digits)' },
    DATE_203: { pattern: /^\d{12}$/, label: 'DateTime CCYYMMDDHHMM (12 digits)' },
    NUMERIC: { pattern: /^-?\d+(\.\d+)?$/, label: 'Numeric value' },
    POSITIVE_NUMERIC: { pattern: /^\d+(\.\d+)?$/, label: 'Positive numeric value' }
};

// ─────────────────────────────────────────────────────────────
//  NAD party requirements per message type
//  Which party qualifiers are required/expected
// ─────────────────────────────────────────────────────────────

const _PARTY_REQUIREMENTS = {
    INVOIC: {
        required: ['SU', 'BY'],        // Supplier + Buyer
        recommended: ['IV', 'DP']      // Invoicee, Delivery party
    },
    ORDERS: {
        required: ['BY'],              // Buyer
        recommended: ['SU', 'DP']      // Supplier, Delivery party
    },
    DESADV: {
        required: ['SU', 'BY'],
        recommended: ['DP', 'ST']      // Delivery party, Ship-to
    },
    ORDRSP: {
        required: ['SU', 'BY'],
        recommended: []
    },
    PRICAT: {
        required: ['SU'],
        recommended: ['BY']
    },
    RECADV: {
        required: ['BY'],
        recommended: ['SU', 'DP']
    },
    REMADV: {
        required: ['BY', 'SU'],
        recommended: []
    }
};

// ─────────────────────────────────────────────────────────────
//  EANCOM-specific rules
// ─────────────────────────────────────────────────────────────

const _EANCOM_RULES = {
    syntaxVersions: ['3', '4'],
    partyIdQualifier: '9',   // GLN required
    requiredPartyId: true
};

// ═════════════════════════════════════════════════════════════
//  RULE DEFINITIONS
//  Each rule: { code, type, severity, description, appliesTo, check(ctx) }
//
//  ctx = { segments, segmentTags, uniqueTags, unbSegment, unhSegment,
//          untSegments, unzSegment, messageType, standard, delimiters }
// ═════════════════════════════════════════════════════════════

const rules = [

    // ── ENVELOPE RULES ─────────────────────────────────────

    {
        code: 'ENV_001',
        type: 'ENVELOPE',
        severity: 'error',
        description: 'Required envelope segments must be present',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const missing = [];
            const baseRequired = ['UNB', 'UNH', 'UNT', 'UNZ'];
            for (const tag of baseRequired) {
                if (!ctx.segmentTags.includes(tag)) {
                    missing.push(tag);
                }
            }
            return {
                pass: missing.length === 0,
                detail: missing.length > 0
                    ? `Missing required envelope segments: ${missing.join(', ')}`
                    : 'All envelope segments present'
            };
        }
    },

    {
        code: 'ENV_002',
        type: 'ENVELOPE',
        severity: 'warning',
        description: 'UNH/UNT pairing must be balanced',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const unhCount = ctx.segments.filter(s => s.tag === 'UNH').length;
            const untCount = ctx.segments.filter(s => s.tag === 'UNT').length;
            return {
                pass: unhCount === untCount,
                detail: unhCount !== untCount
                    ? `UNH/UNT mismatch: ${unhCount} UNH vs ${untCount} UNT`
                    : `${unhCount} message(s) correctly paired`
            };
        }
    },

    {
        code: 'ENV_003',
        type: 'ENVELOPE',
        severity: 'warning',
        description: 'UNT segment count must match actual count',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const mismatches = [];
            const unhSegs = ctx.segments.filter(s => s.tag === 'UNH');
            const untSegs = ctx.segments.filter(s => s.tag === 'UNT');

            for (const unt of untSegs) {
                const declared = parseInt(unt.fields[0]?.value, 10);
                const msgRef = unt.fields[1]?.value || '';
                const matchingUnh = unhSegs.find(u => u.fields[0]?.value === msgRef);
                if (matchingUnh && declared) {
                    const unhIdx = ctx.segments.indexOf(matchingUnh);
                    const untIdx = ctx.segments.indexOf(unt);
                    const actual = untIdx - unhIdx + 1;
                    if (declared !== actual) {
                        mismatches.push({ msgRef, declared, actual });
                    }
                }
            }
            return {
                pass: mismatches.length === 0,
                detail: mismatches.length > 0
                    ? mismatches.map(m => `Message ${m.msgRef}: UNT declares ${m.declared}, actual ${m.actual}`).join('; ')
                    : 'All UNT segment counts correct'
            };
        }
    },

    {
        code: 'ENV_004',
        type: 'ENVELOPE',
        severity: 'warning',
        description: 'UNZ message count must match actual UNH count',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            if (!ctx.unzSegment) return { pass: true, detail: 'No UNZ segment to check' };
            const declared = parseInt(ctx.unzSegment.fields[0]?.value, 10);
            const actual = ctx.segments.filter(s => s.tag === 'UNH').length;
            return {
                pass: !declared || declared === actual,
                detail: declared && declared !== actual
                    ? `UNZ declares ${declared} messages, found ${actual}`
                    : `Message count correct (${actual})`
            };
        }
    },

    {
        code: 'ENV_005',
        type: 'ENVELOPE',
        severity: 'error',
        description: 'UNB and UNZ control references must match',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            if (!ctx.unbSegment || !ctx.unzSegment) return { pass: true, detail: 'Missing UNB or UNZ' };
            const unbRef = ctx.unbSegment.fields[4]?.value || '';
            const unzRef = ctx.unzSegment.fields[1]?.value || '';
            return {
                pass: !unbRef || !unzRef || unbRef === unzRef,
                detail: unbRef && unzRef && unbRef !== unzRef
                    ? `Control reference mismatch: UNB="${unbRef}" vs UNZ="${unzRef}"`
                    : 'Control references match'
            };
        }
    },

    // ── SEGMENT RULES ──────────────────────────────────────

    {
        code: 'SEG_001',
        type: 'SEGMENT',
        severity: 'warning',
        description: 'Message-type-specific required segments must be present',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const reqDef = _MSG_REQUIRED_SEGMENTS[ctx.messageType];
            if (!reqDef) return { pass: true, detail: `No specific rules for message type "${ctx.messageType}"` };

            const missing = reqDef
                .filter(r => !ctx.segmentTags.includes(r.tag))
                .map(r => `${r.tag} (${r.label}) [${r.severity}]`);

            return {
                pass: missing.length === 0,
                detail: missing.length > 0
                    ? `Missing for ${ctx.messageType}: ${missing.join(', ')}`
                    : `All required segments for ${ctx.messageType} present`
            };
        }
    },

    {
        code: 'SEG_002',
        type: 'SEGMENT',
        severity: 'info',
        description: 'Unknown segment tags should be flagged',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const unknown = ctx.segments
                .filter(s => !ctx.knownTags.has(s.tag) && s.tag.length === 3)
                .map(s => s.tag);
            const unique = [...new Set(unknown)];
            return {
                pass: unique.length === 0,
                detail: unique.length > 0
                    ? `Unknown segment tags: ${unique.join(', ')}`
                    : 'All segment tags recognized'
            };
        }
    },

    {
        code: 'SEG_003',
        type: 'SEGMENT',
        severity: 'error',
        description: 'UNB must have minimum 5 fields (syntax, sender, receiver, dateTime, controlRef)',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            if (!ctx.unbSegment) return { pass: false, detail: 'UNB segment missing' };
            const fieldCount = ctx.unbSegment.fields.length;
            return {
                pass: fieldCount >= 5,
                detail: fieldCount < 5
                    ? `UNB has only ${fieldCount} fields, minimum 5 expected`
                    : `UNB has ${fieldCount} fields`
            };
        }
    },

    {
        code: 'SEG_004',
        type: 'SEGMENT',
        severity: 'error',
        description: 'UNH must have minimum 2 fields (messageRef, messageIdentifier)',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            if (!ctx.unhSegment) return { pass: false, detail: 'UNH segment missing' };
            const fieldCount = ctx.unhSegment.fields.length;
            return {
                pass: fieldCount >= 2,
                detail: fieldCount < 2
                    ? `UNH has only ${fieldCount} fields, minimum 2 expected`
                    : `UNH has ${fieldCount} fields`
            };
        }
    },

    // ── FIELD RULES ────────────────────────────────────────

    {
        code: 'FLD_001',
        type: 'FIELD',
        severity: 'error',
        description: 'Date fields must have valid format for declared qualifier',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const issues = [];
            for (const seg of ctx.segments) {
                if (seg.tag !== 'DTM') continue;
                const comp = seg.fields[0]?.components || [];
                const dateVal = comp[1] || '';
                const format = comp[2] || '';
                if (!dateVal) continue;

                const fmt = _FIELD_FORMATS[`DATE_${format}`];
                if (fmt && !fmt.pattern.test(dateVal)) {
                    issues.push(`DTM at ${seg.position}: "${dateVal}" does not match ${fmt.label}`);
                }
            }
            return {
                pass: issues.length === 0,
                detail: issues.length > 0 ? issues.join('; ') : 'All date formats valid'
            };
        }
    },

    {
        code: 'FLD_002',
        type: 'FIELD',
        severity: 'error',
        description: 'Monetary amounts must be numeric',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const issues = [];
            for (const seg of ctx.segments) {
                if (seg.tag !== 'MOA') continue;
                const amount = seg.fields[0]?.components?.[1] || '';
                if (amount && !_FIELD_FORMATS.NUMERIC.pattern.test(amount)) {
                    issues.push(`MOA at ${seg.position}: "${amount}" is not numeric`);
                }
            }
            return {
                pass: issues.length === 0,
                detail: issues.length > 0 ? issues.join('; ') : 'All monetary amounts valid'
            };
        }
    },

    {
        code: 'FLD_003',
        type: 'FIELD',
        severity: 'error',
        description: 'Quantities must be numeric and non-negative',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const issues = [];
            for (const seg of ctx.segments) {
                if (seg.tag !== 'QTY') continue;
                const qty = seg.fields[0]?.components?.[1] || '';
                if (qty && !_FIELD_FORMATS.POSITIVE_NUMERIC.pattern.test(qty)) {
                    issues.push(`QTY at ${seg.position}: "${qty}" is not a valid positive number`);
                }
            }
            return {
                pass: issues.length === 0,
                detail: issues.length > 0 ? issues.join('; ') : 'All quantities valid'
            };
        }
    },

    {
        code: 'FLD_004',
        type: 'FIELD',
        severity: 'error',
        description: 'Prices must be numeric',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const issues = [];
            for (const seg of ctx.segments) {
                if (seg.tag !== 'PRI') continue;
                const price = seg.fields[0]?.components?.[1] || '';
                if (price && !_FIELD_FORMATS.NUMERIC.pattern.test(price)) {
                    issues.push(`PRI at ${seg.position}: "${price}" is not numeric`);
                }
            }
            return {
                pass: issues.length === 0,
                detail: issues.length > 0 ? issues.join('; ') : 'All prices valid'
            };
        }
    },

    {
        code: 'FLD_005',
        type: 'FIELD',
        severity: 'warning',
        description: 'Currency codes must be ISO 4217 (3 uppercase letters)',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const issues = [];
            for (const seg of ctx.segments) {
                if (seg.tag !== 'CUX') continue;
                const code = seg.fields[0]?.components?.[1] || '';
                if (code && !_FIELD_FORMATS.ISO_CURRENCY.pattern.test(code)) {
                    issues.push(`CUX at ${seg.position}: "${code}" is not a valid ISO 4217 code`);
                }
            }
            return {
                pass: issues.length === 0,
                detail: issues.length > 0 ? issues.join('; ') : 'All currency codes valid'
            };
        }
    },

    // ── COMPLIANCE RULES ───────────────────────────────────

    {
        code: 'CMP_001',
        type: 'COMPLIANCE',
        severity: 'warning',
        description: 'EANCOM: Party identification should use GLN (qualifier 9)',
        appliesTo: { messageTypes: '*', standards: ['EANCOM'] },
        check(ctx) {
            const issues = [];
            for (const seg of ctx.segments) {
                if (seg.tag !== 'NAD') continue;
                const idQualifier = seg.fields[1]?.components?.[2] || '';
                if (idQualifier && idQualifier !== _EANCOM_RULES.partyIdQualifier) {
                    const qualifier = seg.fields[0]?.value || '';
                    issues.push(`NAD+${qualifier} uses id qualifier "${idQualifier}" instead of GLN (9)`);
                }
            }
            return {
                pass: issues.length === 0,
                detail: issues.length > 0 ? issues.join('; ') : 'All NAD parties use GLN'
            };
        }
    },

    {
        code: 'CMP_002',
        type: 'COMPLIANCE',
        severity: 'info',
        description: 'EANCOM: Syntax version should be 3 or 4',
        appliesTo: { messageTypes: '*', standards: ['EANCOM'] },
        check(ctx) {
            if (!ctx.unbSegment) return { pass: true, detail: 'No UNB segment' };
            const ver = ctx.unbSegment.fields[0]?.components?.[1] || '';
            return {
                pass: !ver || _EANCOM_RULES.syntaxVersions.includes(ver),
                detail: ver && !_EANCOM_RULES.syntaxVersions.includes(ver)
                    ? `EANCOM expects syntax version 3 or 4, found "${ver}"`
                    : `Syntax version "${ver}" is valid for EANCOM`
            };
        }
    },

    {
        code: 'CMP_003',
        type: 'COMPLIANCE',
        severity: 'warning',
        description: 'GLN identifiers must be exactly 13 digits',
        appliesTo: { messageTypes: '*', standards: ['EANCOM'] },
        check(ctx) {
            const issues = [];
            for (const seg of ctx.segments) {
                if (seg.tag !== 'NAD') continue;
                const partyId = seg.fields[1]?.components?.[0] || '';
                const idQualifier = seg.fields[1]?.components?.[2] || '';
                if (idQualifier === '9' && partyId && !_FIELD_FORMATS.GLN.pattern.test(partyId)) {
                    issues.push(`NAD GLN "${partyId}" is not exactly 13 digits`);
                }
            }
            return {
                pass: issues.length === 0,
                detail: issues.length > 0 ? issues.join('; ') : 'All GLN identifiers valid'
            };
        }
    },

    {
        code: 'CMP_004',
        type: 'COMPLIANCE',
        severity: 'warning',
        description: 'EAN/GTIN item numbers must be 8-14 digits',
        appliesTo: { messageTypes: '*', standards: ['EANCOM'] },
        check(ctx) {
            const issues = [];
            for (const seg of ctx.segments) {
                if (seg.tag !== 'LIN') continue;
                const itemId = seg.fields[2]?.components?.[0] || '';
                const itemType = seg.fields[2]?.components?.[1] || '';
                if (itemType === 'EN' && itemId && !_FIELD_FORMATS.EAN.pattern.test(itemId)) {
                    issues.push(`LIN EAN "${itemId}" is not 8-14 digits`);
                }
            }
            return {
                pass: issues.length === 0,
                detail: issues.length > 0 ? issues.join('; ') : 'All EAN/GTIN identifiers valid'
            };
        }
    },

    // ── BUSINESS RULES ─────────────────────────────────────

    {
        code: 'BIZ_001',
        type: 'BUSINESS',
        severity: 'warning',
        description: 'Required parties (buyer/supplier) should be present for the message type',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const partyReq = _PARTY_REQUIREMENTS[ctx.messageType];
            if (!partyReq) return { pass: true, detail: `No party rules for "${ctx.messageType}"` };

            const nadQualifiers = ctx.segments
                .filter(s => s.tag === 'NAD')
                .map(s => s.fields[0]?.value || '');

            const missingRequired = partyReq.required.filter(q => !nadQualifiers.includes(q));
            const missingRecommended = partyReq.recommended.filter(q => !nadQualifiers.includes(q));

            const details = [];
            if (missingRequired.length > 0) details.push(`Missing required parties: ${missingRequired.join(', ')}`);
            if (missingRecommended.length > 0) details.push(`Missing recommended parties: ${missingRecommended.join(', ')}`);

            return {
                pass: missingRequired.length === 0,
                detail: details.length > 0 ? details.join('; ') : 'All required parties present'
            };
        }
    },

    {
        code: 'BIZ_002',
        type: 'BUSINESS',
        severity: 'warning',
        description: 'Delivery date should not be before document date',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const dtmSegments = ctx.segments.filter(s => s.tag === 'DTM');
            let docDate = null;
            const deliveryDates = [];

            for (const seg of dtmSegments) {
                const comp = seg.fields[0]?.components || [];
                const qualifier = comp[0] || '';
                const dateVal = comp[1] || '';
                const format = comp[2] || '';
                if (!dateVal) continue;

                const parsed = ctx.parseDate(dateVal, format);
                if (!parsed || isNaN(parsed.getTime())) continue;

                if (qualifier === '137') docDate = { date: parsed, raw: dateVal };
                if (['2', '35', '63', '64'].includes(qualifier)) {
                    deliveryDates.push({ qualifier, date: parsed, raw: dateVal, position: seg.position });
                }
            }

            const issues = [];
            if (docDate) {
                for (const dd of deliveryDates) {
                    if (dd.date < docDate.date) {
                        issues.push(`Delivery date (${dd.raw}) at position ${dd.position} is before document date (${docDate.raw})`);
                    }
                }
            }

            return {
                pass: issues.length === 0,
                detail: issues.length > 0 ? issues.join('; ') : 'Date ordering is consistent'
            };
        }
    },

    {
        code: 'BIZ_003',
        type: 'BUSINESS',
        severity: 'warning',
        description: 'No duplicate reference numbers within the same message',
        appliesTo: { messageTypes: '*', standards: '*' },
        check(ctx) {
            const refs = {};
            for (const seg of ctx.segments) {
                if (seg.tag !== 'RFF') continue;
                const comp = seg.fields[0]?.components || [];
                const key = `${comp[0] || ''}:${comp[1] || ''}`;
                if (!refs[key]) refs[key] = [];
                refs[key].push(seg.position);
            }

            const duplicates = Object.entries(refs)
                .filter(([, positions]) => positions.length > 1)
                .map(([key, positions]) => `${key} (positions: ${positions.join(', ')})`);

            return {
                pass: duplicates.length === 0,
                detail: duplicates.length > 0
                    ? `Duplicate references: ${duplicates.join('; ')}`
                    : 'No duplicate references'
            };
        }
    },

    {
        code: 'BIZ_004',
        type: 'BUSINESS',
        severity: 'info',
        description: 'INVOIC: Total monetary amount (MOA+86) should be present in summary section',
        appliesTo: { messageTypes: ['INVOIC'], standards: '*' },
        check(ctx) {
            const moaSegments = ctx.segments.filter(s => s.tag === 'MOA');
            const hasTotalAmount = moaSegments.some(s => {
                const qualifier = s.fields[0]?.components?.[0] || '';
                return qualifier === '86'; // Total line items amount
            });
            return {
                pass: hasTotalAmount,
                detail: hasTotalAmount
                    ? 'Total amount (MOA+86) present'
                    : 'INVOIC should include a total amount segment (MOA+86)'
            };
        }
    },

    {
        code: 'BIZ_005',
        type: 'BUSINESS',
        severity: 'info',
        description: 'INVOIC: Tax information (TAX) should be present',
        appliesTo: { messageTypes: ['INVOIC'], standards: '*' },
        check(ctx) {
            const hasTax = ctx.segmentTags.includes('TAX');
            return {
                pass: hasTax,
                detail: hasTax ? 'Tax information present' : 'INVOIC should include TAX segments'
            };
        }
    }
];


// ═════════════════════════════════════════════════════════════
//  PUBLIC API
// ═════════════════════════════════════════════════════════════

/**
 * Get all rules, optionally filtered by message type and standard
 */
export function getRules({ messageType, standard } = {}) {
    return rules.filter(rule => {
        const typesMatch = rule.appliesTo.messageTypes === '*'
            || rule.appliesTo.messageTypes.includes(messageType);
        const standardsMatch = rule.appliesTo.standards === '*'
            || rule.appliesTo.standards.includes(standard);
        return typesMatch && standardsMatch;
    });
}

/**
 * Get required segments for a specific message type
 */
export function getRequiredSegments(messageType) {
    return _MSG_REQUIRED_SEGMENTS[messageType] || _BASE_REQUIRED;
}

/**
 * Get party requirements for a specific message type
 */
export function getPartyRequirements(messageType) {
    return _PARTY_REQUIREMENTS[messageType] || null;
}

/**
 * Get field format definition by name
 */
export function getFieldFormat(name) {
    return _FIELD_FORMATS[name] || null;
}


/**
 * Get EANCOM-specific configuration
 */
export function getEancomRules() {
    return { ..._EANCOM_RULES };
}

/**
 * Get all supported message types that have specific rules
 */
export function getSupportedMessageTypes() {
    return Object.keys(_MSG_REQUIRED_SEGMENTS);
}

export default {
    getRules,
    getRequiredSegments,
    getPartyRequirements,
    getFieldFormat,
    getEancomRules,
    getSupportedMessageTypes
};
