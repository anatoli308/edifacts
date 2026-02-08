/**
 * EDIFACT Validation Tools
 * =======================
 * Real implementations using the deterministic EDIFACT parser and analysis engine.
 *
 * Tools:
 * 1. validateRules      — Structural validation (envelope, counts, required segments)
 * 2. checkCompliance    — Standard compliance (EANCOM, UN/EDIFACT, version detection)
 * 3. detectAnomalies    — Anomaly detection (duplicates, unusual values, data quality)
 * 4. validateDataTypes  — Field-level type/format validation (dates, amounts, identifiers)
 * 5. suggestFixes       — Generate fix suggestions for found issues
 */

import {
    parseRawEdifact,
    parseEdifactDate,
    KNOWN_SEGMENT_TAGS,
    DTM_QUALIFIERS,
    RFF_QUALIFIERS,
    NAD_QUALIFIERS
} from '../parser.js';

// ==================== TOOL IMPLEMENTATIONS ====================

/**
 * Tool: validateRules
 * Structural validation of an EDIFACT message
 */
export const validateRules = {
    name: 'validateRules',
    description: 'Validate an EDIFACT message structure: check required segments (UNB, UNH, BGM, UNT, UNZ), segment counts, control references, and structural integrity. Pass the raw EDIFACT message string.',
    category: 'validation',
    module: 'edifact',
    version: '2.0',
    inputSchema: {
        type: 'object',
        properties: {
            raw: {
                type: 'string',
                description: 'Complete raw EDIFACT message string'
            }
        },
        required: ['raw']
    },
    execute: async (args) => {
        const { raw } = args;
        const { segments, delimiters } = parseRawEdifact(raw);

        if (segments.length === 0) {
            return { valid: false, error: 'No segments found in raw EDIFACT content', violations: [] };
        }

        const violations = [];
        const segmentTags = segments.map(s => s.tag);

        // 1. Required envelope segments
        const requiredEnvelope = [
            { tag: 'UNB', label: 'Interchange Header' },
            { tag: 'UNZ', label: 'Interchange Trailer' },
            { tag: 'UNH', label: 'Message Header' },
            { tag: 'UNT', label: 'Message Trailer' }
        ];

        for (const req of requiredEnvelope) {
            if (!segmentTags.includes(req.tag)) {
                violations.push({
                    rule: 'REQUIRED_SEGMENT',
                    severity: 'error',
                    segment: req.tag,
                    message: `Missing required segment: ${req.tag} (${req.label})`
                });
            }
        }

        // 2. BGM check (warning, not always mandatory)
        if (!segmentTags.includes('BGM')) {
            violations.push({
                rule: 'EXPECTED_SEGMENT',
                severity: 'warning',
                segment: 'BGM',
                message: 'Missing BGM (Beginning of Message) - recommended for most message types'
            });
        }

        // 3. UNH/UNT pairing
        const unhSegments = segments.filter(s => s.tag === 'UNH');
        const untSegments = segments.filter(s => s.tag === 'UNT');

        if (unhSegments.length !== untSegments.length) {
            violations.push({
                rule: 'ENVELOPE_PAIRING',
                severity: 'error',
                segment: 'UNH/UNT',
                message: `UNH/UNT count mismatch: ${unhSegments.length} UNH vs ${untSegments.length} UNT`
            });
        }

        // 4. UNT segment count validation (per message)
        for (let i = 0; i < untSegments.length; i++) {
            const unt = untSegments[i];
            const declaredCount = parseInt(unt.fields[0]?.value, 10);
            const msgRef = unt.fields[1]?.value || '';

            // Find matching UNH
            const matchingUnh = unhSegments.find(u => u.fields[0]?.value === msgRef);
            if (matchingUnh) {
                const unhIdx = segments.indexOf(matchingUnh);
                const untIdx = segments.indexOf(unt);
                const actualCount = untIdx - unhIdx + 1;

                if (declaredCount && declaredCount !== actualCount) {
                    violations.push({
                        rule: 'SEGMENT_COUNT',
                        severity: 'warning',
                        segment: 'UNT',
                        message: `Message ${msgRef}: UNT declares ${declaredCount} segments but actual count is ${actualCount}`,
                        expected: declaredCount,
                        actual: actualCount
                    });
                }
            } else if (!matchingUnh && msgRef) {
                violations.push({
                    rule: 'REFERENCE_MATCH',
                    severity: 'warning',
                    segment: 'UNT',
                    message: `UNT references message "${msgRef}" but no matching UNH found`
                });
            }
        }

        // 5. UNZ message count validation
        const unzSegment = segments.find(s => s.tag === 'UNZ');
        if (unzSegment) {
            const declaredMsgCount = parseInt(unzSegment.fields[0]?.value, 10);
            if (declaredMsgCount && declaredMsgCount !== unhSegments.length) {
                violations.push({
                    rule: 'MESSAGE_COUNT',
                    severity: 'warning',
                    segment: 'UNZ',
                    message: `UNZ declares ${declaredMsgCount} messages but found ${unhSegments.length}`,
                    expected: declaredMsgCount,
                    actual: unhSegments.length
                });
            }

            // UNZ control reference should match UNB
            const unbSegment = segments.find(s => s.tag === 'UNB');
            if (unbSegment) {
                const unbRef = unbSegment.fields[4]?.value || '';
                const unzRef = unzSegment.fields[1]?.value || '';
                if (unbRef && unzRef && unbRef !== unzRef) {
                    violations.push({
                        rule: 'CONTROL_REFERENCE',
                        severity: 'error',
                        segment: 'UNB/UNZ',
                        message: `Control reference mismatch: UNB="${unbRef}" vs UNZ="${unzRef}"`
                    });
                }
            }
        }

        // 6. Unknown segment tags
        for (const seg of segments) {
            if (!KNOWN_SEGMENT_TAGS.has(seg.tag) && seg.tag.length === 3) {
                violations.push({
                    rule: 'UNKNOWN_SEGMENT',
                    severity: 'info',
                    segment: seg.tag,
                    position: seg.position,
                    message: `Unknown segment tag: ${seg.tag}`
                });
            }
        }

        // 7. Empty mandatory fields in key segments
        for (const seg of segments) {
            if (seg.tag === 'UNB' && seg.fields.length < 5) {
                violations.push({
                    rule: 'INCOMPLETE_SEGMENT',
                    severity: 'error',
                    segment: 'UNB',
                    message: `UNB has only ${seg.fields.length} fields, minimum 5 expected (syntax, sender, receiver, dateTime, controlRef)`
                });
            }
            if (seg.tag === 'UNH' && seg.fields.length < 2) {
                violations.push({
                    rule: 'INCOMPLETE_SEGMENT',
                    severity: 'error',
                    segment: 'UNH',
                    message: `UNH has only ${seg.fields.length} fields, minimum 2 expected (msgRef, msgIdentifier)`
                });
            }
        }

        const errorCount = violations.filter(v => v.severity === 'error').length;
        const warningCount = violations.filter(v => v.severity === 'warning').length;

        return {
            valid: errorCount === 0,
            totalSegments: segments.length,
            messageCount: unhSegments.length,
            errorCount,
            warningCount,
            violationCount: violations.length,
            violations
        };
    }
};

/**
 * Tool: checkCompliance
 * Check EDIFACT message compliance against a standard
 */
export const checkCompliance = {
    name: 'checkCompliance',
    description: 'Check EDIFACT message compliance against a standard (EANCOM, UN/EDIFACT, ODETTE). Detects standard, version, and subset from the message itself. Pass the raw EDIFACT message string.',
    category: 'validation',
    module: 'edifact',
    version: '2.0',
    inputSchema: {
        type: 'object',
        properties: {
            raw: {
                type: 'string',
                description: 'Complete raw EDIFACT message string'
            },
            standard: {
                type: 'string',
                description: 'Optional: expected standard (e.g., "EANCOM", "UN/EDIFACT"). If omitted, auto-detected from UNB/UNH.'
            },
            subset: {
                type: 'string',
                description: 'Optional: expected subset or version (e.g., "D96A"). If omitted, auto-detected from UNH.'
            }
        },
        required: ['raw']
    },
    execute: async (args) => {
        const { raw, standard: expectedStandard, subset: expectedSubset } = args;
        const { segments } = parseRawEdifact(raw);

        if (segments.length === 0) {
            return { compliant: false, error: 'No segments found in raw EDIFACT content' };
        }

        const issues = [];
        const segmentTags = segments.map(s => s.tag);
        const uniqueTags = [...new Set(segmentTags)];

        // Auto-detect standard from UNB and UNH
        const unbSegment = segments.find(s => s.tag === 'UNB');
        const unhSegment = segments.find(s => s.tag === 'UNH');

        const unbSyntax = unbSegment?.fields[0]?.components?.[0] || '';
        const unhMsgId = unhSegment?.fields[1]?.components || [];
        const associationCode = unhMsgId[4] || '';
        const messageType = unhMsgId[0] || '';
        const messageVersion = unhMsgId[1] || '';
        const messageRelease = unhMsgId[2] || '';
        const controllingAgency = unhMsgId[3] || '';

        // Detect standard
        let detectedStandard = 'UN/EDIFACT';
        if (associationCode.toUpperCase().includes('EAN')) detectedStandard = 'EANCOM';
        else if (associationCode.toUpperCase().includes('ODETTE')) detectedStandard = 'ODETTE';
        else if (unbSyntax === 'UNOC' || unbSyntax === 'UNOA' || unbSyntax === 'UNOB') {
            // UNO* syntax identifiers are standard UN/EDIFACT
            if (associationCode) {
                detectedStandard = associationCode.includes('EAN') ? 'EANCOM' : 'UN/EDIFACT';
            }
        }

        const detectedVersion = `${messageVersion}${messageRelease}`;
        const detectedSubset = associationCode || detectedVersion;

        const standard = expectedStandard || detectedStandard;
        const subset = expectedSubset || detectedSubset;

        // Required segments per message type
        const requiredSegments = ['UNB', 'UNH', 'BGM', 'UNT', 'UNZ'];
        const missingRequired = requiredSegments.filter(tag => !segmentTags.includes(tag));

        for (const tag of missingRequired) {
            issues.push({
                severity: 'error',
                segment: tag,
                message: `${standard}: Missing required segment ${tag}`
            });
        }

        // Standard-specific compliance checks
        if (standard === 'EANCOM') {
            // EANCOM requires party identification with GLN (qualifier 9)
            const nadSegments = segments.filter(s => s.tag === 'NAD');
            for (const nad of nadSegments) {
                const idQualifier = nad.fields[1]?.components?.[2] || '';
                if (idQualifier && idQualifier !== '9') {
                    issues.push({
                        severity: 'warning',
                        segment: 'NAD',
                        position: nad.position,
                        message: `EANCOM recommends GLN identification (qualifier 9), found qualifier "${idQualifier}"`
                    });
                }
            }

            // UNB syntax should be UNOC:3 or UNOA:3 for EANCOM
            const syntaxVersion = unbSegment?.fields[0]?.components?.[1] || '';
            if (syntaxVersion && syntaxVersion !== '3' && syntaxVersion !== '4') {
                issues.push({
                    severity: 'info',
                    segment: 'UNB',
                    message: `EANCOM typically uses syntax version 3 or 4, found "${syntaxVersion}"`
                });
            }
        }

        // Version match checking
        if (expectedSubset && detectedVersion && expectedSubset !== detectedVersion && expectedSubset !== associationCode) {
            issues.push({
                severity: 'warning',
                segment: 'UNH',
                message: `Expected subset "${expectedSubset}" but message declares version "${detectedVersion}" with association code "${associationCode}"`
            });
        }

        // Controlling agency
        if (controllingAgency && controllingAgency !== 'UN') {
            issues.push({
                severity: 'info',
                segment: 'UNH',
                message: `Controlling agency is "${controllingAgency}" (expected "UN" for standard UN/EDIFACT)`
            });
        }

        return {
            compliant: issues.filter(i => i.severity === 'error').length === 0,
            standard,
            detectedStandard,
            subset,
            detectedVersion,
            messageType,
            messageVersion,
            messageRelease,
            associationCode,
            controllingAgency,
            requiredSegments,
            missingSegments: missingRequired,
            presentSegments: uniqueTags,
            issueCount: issues.length,
            issues
        };
    }
};

/**
 * Tool: detectAnomalies
 * Find unusual patterns or data quality issues
 */
export const detectAnomalies = {
    name: 'detectAnomalies',
    description: 'Detect anomalies and data quality issues in an EDIFACT message: duplicate references, unusual values, missing data, inconsistencies. Pass the raw EDIFACT message string.',
    category: 'validation',
    module: 'edifact',
    version: '2.0',
    inputSchema: {
        type: 'object',
        properties: {
            raw: {
                type: 'string',
                description: 'Complete raw EDIFACT message string'
            }
        },
        required: ['raw']
    },
    execute: async (args) => {
        const { raw } = args;
        const { segments } = parseRawEdifact(raw);

        if (segments.length === 0) {
            return { anomalyCount: 0, anomalies: [], error: 'No segments found' };
        }

        const anomalies = [];

        // 1. Duplicate references (RFF)
        const references = [];
        for (const seg of segments) {
            if (seg.tag === 'RFF') {
                const comp = seg.fields[0]?.components || [];
                references.push({ qualifier: comp[0] || '', value: comp[1] || '', position: seg.position });
            }
        }

        const refCounts = {};
        for (const ref of references) {
            const key = `${ref.qualifier}:${ref.value}`;
            if (!refCounts[key]) refCounts[key] = [];
            refCounts[key].push(ref.position);
        }

        for (const [key, positions] of Object.entries(refCounts)) {
            if (positions.length > 1) {
                const [qual, val] = key.split(':');
                anomalies.push({
                    type: 'DUPLICATE_REFERENCE',
                    severity: 'warning',
                    message: `Duplicate reference ${RFF_QUALIFIERS[qual] || qual}: "${val}" appears ${positions.length} times`,
                    positions,
                    qualifier: qual,
                    value: val
                });
            }
        }

        // 2. Duplicate product IDs across LIN segments
        const lineItems = [];
        for (const seg of segments) {
            if (seg.tag === 'LIN') {
                const itemId = seg.fields[2]?.components?.[0] || '';
                if (itemId) {
                    lineItems.push({ itemId, position: seg.position });
                }
            }
        }

        const itemCounts = {};
        for (const item of lineItems) {
            if (!itemCounts[item.itemId]) itemCounts[item.itemId] = [];
            itemCounts[item.itemId].push(item.position);
        }

        for (const [itemId, positions] of Object.entries(itemCounts)) {
            if (positions.length > 1) {
                anomalies.push({
                    type: 'DUPLICATE_PRODUCT',
                    severity: 'warning',
                    message: `Product "${itemId}" appears in ${positions.length} line items`,
                    positions,
                    itemId
                });
            }
        }

        // 3. Price anomalies (unusually low or high vs. average)
        const prices = [];
        for (const seg of segments) {
            if (seg.tag === 'PRI') {
                const comp = seg.fields[0]?.components || [];
                const price = parseFloat(comp[1]);
                if (!isNaN(price)) {
                    prices.push({ price, position: seg.position, qualifier: comp[0] || '' });
                }
            }
        }

        if (prices.length > 1) {
            const avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
            const stdDev = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p.price - avgPrice, 2), 0) / prices.length);

            for (const p of prices) {
                if (stdDev > 0 && Math.abs(p.price - avgPrice) > 2 * stdDev) {
                    anomalies.push({
                        type: 'UNUSUAL_PRICE',
                        severity: 'warning',
                        message: `Price ${p.price} at position ${p.position} is unusual (avg: ${avgPrice.toFixed(2)}, stdDev: ${stdDev.toFixed(2)})`,
                        position: p.position,
                        price: p.price,
                        averagePrice: parseFloat(avgPrice.toFixed(2)),
                        standardDeviation: parseFloat(stdDev.toFixed(2))
                    });
                }
            }
        }

        // 4. Quantity anomalies (very high quantities)
        for (const seg of segments) {
            if (seg.tag === 'QTY') {
                const comp = seg.fields[0]?.components || [];
                const qty = parseFloat(comp[1]);
                if (!isNaN(qty) && qty > 10000) {
                    anomalies.push({
                        type: 'HIGH_QUANTITY',
                        severity: 'info',
                        message: `High quantity detected: ${qty} at position ${seg.position}`,
                        position: seg.position,
                        quantity: qty
                    });
                }
            }
        }

        // 5. Date anomalies (past dates, future dates, inconsistent ranges)
        const dates = [];
        for (const seg of segments) {
            if (seg.tag === 'DTM') {
                const comp = seg.fields[0]?.components || [];
                const qualifier = comp[0] || '';
                const dateValue = comp[1] || '';
                const format = comp[2] || '';
                const parsed = parseEdifactDate(dateValue, format);
                if (parsed && !isNaN(parsed.getTime())) {
                    dates.push({ qualifier, date: parsed, rawValue: dateValue, position: seg.position });
                }
            }
        }

        // Check date ordering (delivery date should be after document date)
        const docDate = dates.find(d => d.qualifier === '137');
        const deliveryDates = dates.filter(d => ['2', '35', '63', '64'].includes(d.qualifier));

        for (const dd of deliveryDates) {
            if (docDate && dd.date < docDate.date) {
                anomalies.push({
                    type: 'DATE_ORDER',
                    severity: 'warning',
                    message: `${DTM_QUALIFIERS[dd.qualifier] || 'Delivery date'} (${dd.rawValue}) is before document date (${docDate.rawValue})`,
                    position: dd.position
                });
            }
        }

        // 6. IMD description quality (excessive spaces, very short descriptions)
        for (const seg of segments) {
            if (seg.tag === 'IMD') {
                const descComp = seg.fields[2]?.components || [];
                const desc = descComp.slice(3).filter(Boolean).join(' ') || descComp.filter(Boolean).join(' ');
                if (desc && /\s{3,}/.test(desc)) {
                    anomalies.push({
                        type: 'DESCRIPTION_QUALITY',
                        severity: 'info',
                        message: `Item description has irregular spacing: "${desc.trim()}"`,
                        position: seg.position,
                        description: desc.trim()
                    });
                }
            }
        }

        // 7. Missing NAD parties (buyer or supplier missing)
        const nadQualifiers = segments.filter(s => s.tag === 'NAD').map(s => s.fields[0]?.value || '');
        if (!nadQualifiers.includes('BY')) {
            anomalies.push({
                type: 'MISSING_PARTY',
                severity: 'warning',
                message: 'No Buyer (NAD+BY) party found in message'
            });
        }
        if (!nadQualifiers.includes('SU') && !nadQualifiers.includes('SE')) {
            anomalies.push({
                type: 'MISSING_PARTY',
                severity: 'warning',
                message: 'No Supplier/Seller (NAD+SU/SE) party found in message'
            });
        }

        return {
            anomalyCount: anomalies.length,
            hasAnomalies: anomalies.length > 0,
            anomalies,
            summary: {
                errors: anomalies.filter(a => a.severity === 'error').length,
                warnings: anomalies.filter(a => a.severity === 'warning').length,
                info: anomalies.filter(a => a.severity === 'info').length
            }
        };
    }
};

/**
 * Tool: validateDataTypes
 * Validate field types, formats, and value ranges
 */
export const validateDataTypes = {
    name: 'validateDataTypes',
    description: 'Validate EDIFACT message fields for correct data types, date formats, numeric ranges, and identifier formats. Pass the raw EDIFACT message string.',
    category: 'validation',
    module: 'edifact',
    version: '2.0',
    inputSchema: {
        type: 'object',
        properties: {
            raw: {
                type: 'string',
                description: 'Complete raw EDIFACT message string'
            }
        },
        required: ['raw']
    },
    execute: async (args) => {
        const { raw } = args;
        const { segments } = parseRawEdifact(raw);

        if (segments.length === 0) {
            return { valid: false, error: 'No segments found', errors: [] };
        }

        const errors = [];

        for (const seg of segments) {
            switch (seg.tag) {
                case 'DTM': {
                    // Validate date format
                    const comp = seg.fields[0]?.components || [];
                    const qualifier = comp[0] || '';
                    const dateValue = comp[1] || '';
                    const format = comp[2] || '';

                    if (dateValue) {
                        if (format === '102' && dateValue.length !== 8) {
                            errors.push({
                                segment: 'DTM',
                                position: seg.position,
                                field: 'C507.2380',
                                expected: '8-digit date (CCYYMMDD)',
                                actual: dateValue,
                                message: `Date "${dateValue}" should be 8 digits for format 102`
                            });
                        }
                        if (format === '203' && dateValue.length !== 12) {
                            errors.push({
                                segment: 'DTM',
                                position: seg.position,
                                field: 'C507.2380',
                                expected: '12-digit datetime (CCYYMMDDHHMM)',
                                actual: dateValue,
                                message: `DateTime "${dateValue}" should be 12 digits for format 203`
                            });
                        }
                        // Validate parsability
                        const parsed = parseEdifactDate(dateValue, format);
                        if (!parsed || isNaN(parsed.getTime())) {
                            errors.push({
                                segment: 'DTM',
                                position: seg.position,
                                field: 'C507.2380',
                                expected: 'Valid date',
                                actual: dateValue,
                                message: `Date "${dateValue}" is not a valid date`
                            });
                        }
                    }
                    break;
                }
                case 'QTY': {
                    const comp = seg.fields[0]?.components || [];
                    const qty = comp[1] || '';
                    if (qty && isNaN(parseFloat(qty))) {
                        errors.push({
                            segment: 'QTY',
                            position: seg.position,
                            field: 'C186.6060',
                            expected: 'Numeric value',
                            actual: qty,
                            message: `Quantity "${qty}" is not a valid number`
                        });
                    }
                    if (qty && parseFloat(qty) < 0) {
                        errors.push({
                            segment: 'QTY',
                            position: seg.position,
                            field: 'C186.6060',
                            expected: 'Non-negative quantity',
                            actual: qty,
                            message: `Quantity "${qty}" is negative`
                        });
                    }
                    break;
                }
                case 'PRI': {
                    const comp = seg.fields[0]?.components || [];
                    const price = comp[1] || '';
                    if (price && isNaN(parseFloat(price))) {
                        errors.push({
                            segment: 'PRI',
                            position: seg.position,
                            field: 'C509.5118',
                            expected: 'Numeric value',
                            actual: price,
                            message: `Price "${price}" is not a valid number`
                        });
                    }
                    if (price && parseFloat(price) < 0) {
                        errors.push({
                            segment: 'PRI',
                            position: seg.position,
                            field: 'C509.5118',
                            expected: 'Non-negative price',
                            actual: price,
                            message: `Price "${price}" is negative`
                        });
                    }
                    break;
                }
                case 'MOA': {
                    const comp = seg.fields[0]?.components || [];
                    const amount = comp[1] || '';
                    if (amount && isNaN(parseFloat(amount))) {
                        errors.push({
                            segment: 'MOA',
                            position: seg.position,
                            field: 'C516.5004',
                            expected: 'Numeric value',
                            actual: amount,
                            message: `Monetary amount "${amount}" is not a valid number`
                        });
                    }
                    break;
                }
                case 'NAD': {
                    // Check party ID format
                    const partyId = seg.fields[1]?.components?.[0] || '';
                    const idQualifier = seg.fields[1]?.components?.[2] || '';

                    // GLN should be 13 digits
                    if (idQualifier === '9' && partyId && !/^\d{13}$/.test(partyId)) {
                        errors.push({
                            segment: 'NAD',
                            position: seg.position,
                            field: 'C082.3039',
                            expected: '13-digit GLN',
                            actual: partyId,
                            message: `GLN "${partyId}" should be exactly 13 digits`
                        });
                    }
                    break;
                }
                case 'LIN': {
                    // Check EAN/GTIN format
                    const itemId = seg.fields[2]?.components?.[0] || '';
                    const itemType = seg.fields[2]?.components?.[1] || '';

                    if (itemType === 'EN' && itemId && !/^\d{8,14}$/.test(itemId)) {
                        errors.push({
                            segment: 'LIN',
                            position: seg.position,
                            field: 'C212.7140',
                            expected: 'EAN/GTIN (8-14 digits)',
                            actual: itemId,
                            message: `EAN "${itemId}" should be 8-14 digits`
                        });
                    }
                    break;
                }
                case 'CUX': {
                    // Currency code should be 3 uppercase letters
                    const currCode = seg.fields[0]?.components?.[1] || '';
                    if (currCode && !/^[A-Z]{3}$/.test(currCode)) {
                        errors.push({
                            segment: 'CUX',
                            position: seg.position,
                            field: 'C504.6345',
                            expected: 'ISO 4217 currency code (3 uppercase letters)',
                            actual: currCode,
                            message: `Currency code "${currCode}" should be 3 uppercase letters`
                        });
                    }
                    break;
                }
                case 'UNT': {
                    const segCount = seg.fields[0]?.value || '';
                    if (segCount && isNaN(parseInt(segCount, 10))) {
                        errors.push({
                            segment: 'UNT',
                            position: seg.position,
                            field: '0074',
                            expected: 'Integer (segment count)',
                            actual: segCount,
                            message: `Segment count "${segCount}" is not a valid integer`
                        });
                    }
                    break;
                }
                case 'UNZ': {
                    const msgCount = seg.fields[0]?.value || '';
                    if (msgCount && isNaN(parseInt(msgCount, 10))) {
                        errors.push({
                            segment: 'UNZ',
                            position: seg.position,
                            field: '0036',
                            expected: 'Integer (message count)',
                            actual: msgCount,
                            message: `Message count "${msgCount}" is not a valid integer`
                        });
                    }
                    break;
                }
            }
        }

        return {
            valid: errors.length === 0,
            errorCount: errors.length,
            errors,
            segmentsChecked: segments.length
        };
    }
};

/**
 * Tool: suggestFixes
 * Recommend fixes for validation issues
 */
export const suggestFixes = {
    name: 'suggestFixes',
    description: 'Generate fix suggestions for EDIFACT validation issues. Pass the raw EDIFACT message to automatically detect all issues and generate fixes.',
    category: 'validation',
    module: 'edifact',
    version: '2.1',
    inputSchema: {
        type: 'object',
        properties: {
            raw: {
                type: 'string',
                description: 'Raw EDIFACT message string to analyze and suggest fixes for'
            },
            issues: {
                type: 'array',
                description: 'Optional: pre-computed array of validation issues. If omitted, issues are collected automatically from raw.',
                items: { type: 'object' }
            }
        },
        required: ['raw']
    },
    execute: async (args) => {
        let issues = args.issues;

        // If no pre-computed issues, run all validators to collect them
        if (!issues || issues.length === 0) {
            issues = [];
            if (args.raw) {
                const validationResult = await validateRules.execute({ raw: args.raw });
                if (validationResult.violations?.length > 0) {
                    issues.push(...validationResult.violations);
                }
                const complianceResult = await checkCompliance.execute({ raw: args.raw });
                if (complianceResult.issues?.length > 0) {
                    issues.push(...complianceResult.issues);
                }
                const anomalyResult = await detectAnomalies.execute({ raw: args.raw });
                if (anomalyResult.anomalies?.length > 0) {
                    issues.push(...anomalyResult.anomalies);
                }
                const dataTypeResult = await validateDataTypes.execute({ raw: args.raw });
                if (dataTypeResult.issues?.length > 0) {
                    issues.push(...dataTypeResult.issues);
                }
            }
        }

        const suggestions = [];

        for (const issue of issues) {
            const suggestion = { original: issue, fixes: [] };

            // Pattern-based fix suggestions
            const rule = issue.rule || issue.type || '';
            const message = issue.message || '';

            if (rule === 'REQUIRED_SEGMENT' || rule === 'EXPECTED_SEGMENT') {
                suggestion.fixes.push({
                    action: `Add missing ${issue.segment} segment`,
                    description: `Insert the required ${issue.segment} segment in the correct position within the message structure.`,
                    priority: issue.severity === 'error' ? 'high' : 'medium'
                });
            }

            if (rule === 'SEGMENT_COUNT' || rule === 'MESSAGE_COUNT') {
                suggestion.fixes.push({
                    action: `Update count in ${issue.segment}`,
                    description: `Change the declared count from ${issue.expected} to ${issue.actual} to match the actual number of segments/messages.`,
                    priority: 'medium'
                });
            }

            if (rule === 'CONTROL_REFERENCE') {
                suggestion.fixes.push({
                    action: 'Align UNB and UNZ control references',
                    description: 'Ensure the control reference in UNZ matches the one declared in UNB.',
                    priority: 'high'
                });
            }

            if (rule === 'DUPLICATE_REFERENCE') {
                suggestion.fixes.push({
                    action: `Review duplicate reference ${issue.qualifier}:${issue.value}`,
                    description: 'Verify if the duplicate reference is intentional. If not, assign unique reference values to each occurrence.',
                    priority: 'medium'
                });
            }

            if (rule === 'DUPLICATE_PRODUCT') {
                suggestion.fixes.push({
                    action: `Review duplicate product ${issue.itemId}`,
                    description: 'If the same product appears in multiple line items intentionally, consider consolidating. Otherwise, verify the product codes.',
                    priority: 'medium'
                });
            }

            if (rule === 'UNUSUAL_PRICE') {
                suggestion.fixes.push({
                    action: `Verify price ${issue.price}`,
                    description: `This price deviates significantly from the average (${issue.averagePrice}). Confirm it is correct.`,
                    priority: 'medium'
                });
            }

            if (rule === 'DESCRIPTION_QUALITY') {
                suggestion.fixes.push({
                    action: 'Normalize item description spacing',
                    description: `Clean up excessive whitespace in description: "${issue.description}"`,
                    priority: 'low'
                });
            }

            if (rule === 'MISSING_PARTY') {
                suggestion.fixes.push({
                    action: 'Add missing party segment',
                    description: message,
                    priority: 'high'
                });
            }

            // Data type fixes
            if (message.includes('not a valid number')) {
                suggestion.fixes.push({
                    action: `Fix numeric value in ${issue.segment}`,
                    description: `Field ${issue.field}: expected numeric value but found "${issue.actual}". Correct the value format.`,
                    priority: 'high'
                });
            }

            if (message.includes('not a valid date')) {
                suggestion.fixes.push({
                    action: `Fix date format in ${issue.segment}`,
                    description: `Field ${issue.field}: date "${issue.actual}" could not be parsed. Ensure it matches the declared format.`,
                    priority: 'high'
                });
            }

            if (message.includes('GLN') || message.includes('EAN')) {
                suggestion.fixes.push({
                    action: `Correct identifier in ${issue.segment}`,
                    description: `${issue.message}. Verify the identifier and ensure the correct check digit.`,
                    priority: 'high'
                });
            }

            // Fallback for unmatched issues
            if (suggestion.fixes.length === 0) {
                suggestion.fixes.push({
                    action: `Review: ${message}`,
                    description: 'Manual review recommended for this issue.',
                    priority: issue.severity === 'error' ? 'high' : 'low'
                });
            }

            suggestions.push(suggestion);
        }

        return {
            suggestionCount: suggestions.length,
            suggestions,
            prioritySummary: {
                high: suggestions.filter(s => s.fixes.some(f => f.priority === 'high')).length,
                medium: suggestions.filter(s => s.fixes.some(f => f.priority === 'medium')).length,
                low: suggestions.filter(s => s.fixes.some(f => f.priority === 'low')).length
            }
        };
    }
};

export default {
    validateRules,
    checkCompliance,
    detectAnomalies,
    validateDataTypes,
    suggestFixes
};
