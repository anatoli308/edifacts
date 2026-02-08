/**
 * EDIFACT Segment Analysis Tools
 * ==============================
 * Real implementations using the deterministic EDIFACT parser.
 *
 * Tools:
 * 1. segmentAnalyze   — Parse and analyze a segment (or all segments from raw EDIFACT)
 * 2. parseSegmentField — Extract a specific field from a segment
 * 3. compareSegments   — Diff two segments
 * 4. groupSegmentsByType — Group all segments by tag
 */

import {
    parseRawEdifact,
    parseUNA,
    parseSegment,
    parseEdifactDate,
    KNOWN_SEGMENT_TAGS,
    DTM_QUALIFIERS,
    RFF_QUALIFIERS,
    NAD_QUALIFIERS
} from '../parser.js';

// ==================== SEMANTIC INTERPRETERS ====================

/**
 * Build semantic interpretation for a parsed segment
 * @private
 */
function _interpretSegment(tag, fields) {
    switch (tag) {
        case 'UNB': {
            const syntax = fields[0]?.components || [];
            const sender = fields[1]?.components || [];
            const receiver = fields[2]?.components || [];
            const dateTime = fields[3]?.components || [];
            const controlRef = fields[4]?.value || '';
            return {
                meaning: 'Interchange Header',
                details: {
                    syntaxIdentifier: syntax[0] || '',
                    syntaxVersion: syntax[1] || '',
                    sender: sender[0] || '',
                    senderQualifier: sender[1] || '',
                    receiver: receiver[0] || '',
                    receiverQualifier: receiver[1] || '',
                    date: dateTime[0] || '',
                    time: dateTime[1] || '',
                    controlReference: controlRef
                }
            };
        }
        case 'UNH': {
            const msgRef = fields[0]?.value || '';
            const msgId = fields[1]?.components || [];
            return {
                meaning: 'Message Header',
                details: {
                    messageReference: msgRef,
                    messageType: msgId[0] || '',
                    version: msgId[1] || '',
                    release: msgId[2] || '',
                    controllingAgency: msgId[3] || '',
                    associationCode: msgId[4] || ''
                }
            };
        }
        case 'BGM': {
            const docType = fields[0]?.components || [];
            const docNumber = fields[1]?.value || '';
            const functionCode = fields[2]?.value || '';
            return {
                meaning: 'Beginning of Message',
                details: {
                    documentTypeCode: docType[0] || '',
                    documentNumber: docNumber,
                    functionCode
                }
            };
        }
        case 'DTM': {
            const dtmComp = fields[0]?.components || [];
            const qualifier = dtmComp[0] || '';
            const dateValue = dtmComp[1] || '';
            const format = dtmComp[2] || '';
            const parsed = parseEdifactDate(dateValue, format);
            return {
                meaning: DTM_QUALIFIERS[qualifier] || `Date/Time (qualifier ${qualifier})`,
                details: {
                    qualifier,
                    qualifierMeaning: DTM_QUALIFIERS[qualifier] || 'Unknown',
                    rawValue: dateValue,
                    format,
                    parsedDate: parsed ? parsed.toISOString() : null
                }
            };
        }
        case 'NAD': {
            const qualifier = fields[0]?.value || '';
            const idField = fields[1]?.components || [];
            const nameField = fields[3]?.components || [];
            return {
                meaning: `Party: ${NAD_QUALIFIERS[qualifier] || qualifier}`,
                details: {
                    qualifier,
                    qualifierMeaning: NAD_QUALIFIERS[qualifier] || 'Unknown',
                    partyId: idField[0] || '',
                    idCodeQualifier: idField[2] || '',
                    name: nameField.filter(Boolean).join(' ')
                }
            };
        }
        case 'RFF': {
            const rffComp = fields[0]?.components || [];
            const qualifier = rffComp[0] || '';
            const value = rffComp[1] || '';
            return {
                meaning: `Reference: ${RFF_QUALIFIERS[qualifier] || qualifier}`,
                details: {
                    qualifier,
                    qualifierMeaning: RFF_QUALIFIERS[qualifier] || 'Unknown',
                    value
                }
            };
        }
        case 'LIN': {
            const lineNumber = fields[0]?.value || '';
            const actionCode = fields[1]?.value || '';
            const itemId = fields[2]?.components || [];
            return {
                meaning: 'Line Item',
                details: {
                    lineNumber,
                    actionCode,
                    itemNumber: itemId[0] || '',
                    itemNumberType: itemId[1] || ''
                }
            };
        }
        case 'PIA': {
            const qualifierCode = fields[0]?.value || '';
            const additionalIds = fields.slice(1).map(f => ({
                number: f.components?.[0] || '',
                type: f.components?.[1] || ''
            }));
            return {
                meaning: 'Additional Product ID',
                details: { qualifierCode, additionalIds }
            };
        }
        case 'IMD': {
            const descType = fields[0]?.value || '';
            const descComp = fields[2]?.components || [];
            return {
                meaning: 'Item Description',
                details: {
                    descriptionType: descType,
                    description: descComp.slice(3).filter(Boolean).join(' ') || descComp.filter(Boolean).join(' ')
                }
            };
        }
        case 'QTY': {
            const qtyComp = fields[0]?.components || [];
            return {
                meaning: 'Quantity',
                details: {
                    qualifier: qtyComp[0] || '',
                    quantity: parseFloat(qtyComp[1]) || 0,
                    unit: qtyComp[2] || ''
                }
            };
        }
        case 'PRI': {
            const priComp = fields[0]?.components || [];
            return {
                meaning: 'Price',
                details: {
                    qualifier: priComp[0] || '',
                    price: parseFloat(priComp[1]) || 0,
                    priceType: priComp[2] || '',
                    priceBasis: priComp[3] || '',
                    unitPriceBasis: priComp[4] || '',
                    measureUnit: priComp[5] || ''
                }
            };
        }
        case 'MOA': {
            const moaComp = fields[0]?.components || [];
            return {
                meaning: 'Monetary Amount',
                details: {
                    qualifier: moaComp[0] || '',
                    amount: parseFloat(moaComp[1]) || 0,
                    currency: moaComp[2] || ''
                }
            };
        }
        case 'CUX': {
            const cuxComp = fields[0]?.components || [];
            return {
                meaning: 'Currencies',
                details: {
                    usageQualifier: cuxComp[0] || '',
                    currencyCode: cuxComp[1] || '',
                    currencyQualifier: cuxComp[2] || ''
                }
            };
        }
        case 'PAT': {
            const paymentTermsType = fields[0]?.value || '';
            const termsComp = fields[2]?.components || [];
            return {
                meaning: 'Payment Terms',
                details: {
                    paymentTermsType,
                    timeMeasure: termsComp[0] || '',
                    timePeriod: termsComp[1] || '',
                    timeRelation: termsComp[2] || '',
                    numberOfPeriods: termsComp[3] || ''
                }
            };
        }
        case 'CNT': {
            const cntComp = fields[0]?.components || [];
            return {
                meaning: 'Control Total',
                details: {
                    qualifier: cntComp[0] || '',
                    value: cntComp[1] || ''
                }
            };
        }
        case 'UNT': {
            return {
                meaning: 'Message Trailer',
                details: {
                    segmentCount: fields[0]?.value || '',
                    messageReference: fields[1]?.value || ''
                }
            };
        }
        case 'UNZ': {
            return {
                meaning: 'Interchange Trailer',
                details: {
                    messageCount: fields[0]?.value || '',
                    controlReference: fields[1]?.value || ''
                }
            };
        }
        case 'UNS': {
            return {
                meaning: 'Section Control',
                details: { sectionIdentification: fields[0]?.value || '' }
            };
        }
        case 'TAX': {
            const taxFunction = fields[0]?.value || '';
            const taxType = fields[1]?.components || [];
            return {
                meaning: 'Tax Details',
                details: {
                    functionQualifier: taxFunction,
                    taxType: taxType[0] || '',
                    taxRate: fields[4]?.components?.[3] || ''
                }
            };
        }
        case 'FTX': {
            const textSubject = fields[0]?.value || '';
            const textRef = fields[2]?.components || [];
            const freeText = fields[3]?.components || [];
            return {
                meaning: 'Free Text',
                details: {
                    textSubject,
                    textReference: textRef[0] || '',
                    text: freeText.filter(Boolean).join(' ')
                }
            };
        }
        default: {
            return {
                meaning: KNOWN_SEGMENT_TAGS.has(tag) ? `Known segment: ${tag}` : `Unknown segment: ${tag}`,
                details: {}
            };
        }
    }
}

// ==================== TOOL IMPLEMENTATIONS ====================

/**
 * Tool: segmentAnalyze
 * Analyze EDIFACT segments with full semantic interpretation.
 *
 * Accepts EITHER:
 * - A raw EDIFACT string (parses all segments) via `raw`
 * - A single segment via `tag` + `data`
 */
export const segmentAnalyze = {
    name: 'segmentAnalyze',
    description: 'Analyze EDIFACT segments: parse structure, extract semantic meaning, and identify issues. Pass either a full raw EDIFACT message (via "raw") to analyze all segments, or a single segment via "tag" and "data".',
    category: 'analysis',
    module: 'edifact',
    version: '2.0',
    inputSchema: {
        type: 'object',
        properties: {
            raw: {
                type: 'string',
                description: 'Complete raw EDIFACT message string. If provided, all segments are parsed and analyzed.'
            },
            tag: {
                type: 'string',
                description: 'Single segment tag (e.g., "DTM"). Used together with "data" for single-segment analysis.'
            },
            data: {
                type: 'string',
                description: 'Single segment data string (e.g., "137:20170210:102"). Used together with "tag".'
            }
        },
        required: []
    },
    execute: async (args) => {
        // Mode 1: Full raw EDIFACT message
        if (args.raw) {
            const { segments, delimiters } = parseRawEdifact(args.raw);

            if (segments.length === 0) {
                return { success: false, error: 'No segments found in raw EDIFACT content' };
            }

            const analyzed = segments.map(seg => {
                const interpretation = _interpretSegment(seg.tag, seg.fields);
                const isKnown = KNOWN_SEGMENT_TAGS.has(seg.tag);
                return {
                    position: seg.position,
                    tag: seg.tag,
                    raw: seg.raw,
                    fieldCount: seg.fields.length,
                    fields: seg.fields,
                    isKnown,
                    ...interpretation
                };
            });

            return {
                segmentCount: analyzed.length,
                uniqueTags: [...new Set(analyzed.map(s => s.tag))],
                segments: analyzed,
                delimiters: {
                    hasUNA: delimiters.hasUNA,
                    componentSeparator: delimiters.componentSeparator,
                    fieldSeparator: delimiters.fieldSeparator,
                    segmentTerminator: delimiters.segmentTerminator
                }
            };
        }

        // Mode 2: Single segment (tag + data)
        if (args.tag && args.data !== undefined) {
            const delimiters = parseUNA('');
            const segStr = `${args.tag}${delimiters.fieldSeparator}${args.data}`;
            const parsed = parseSegment(segStr, delimiters);
            const interpretation = _interpretSegment(parsed.tag, parsed.fields);
            const isKnown = KNOWN_SEGMENT_TAGS.has(parsed.tag);

            return {
                tag: parsed.tag,
                raw: segStr,
                fieldCount: parsed.fields.length,
                fields: parsed.fields,
                isKnown,
                ...interpretation,
                valid: isKnown
            };
        }

        return { success: false, error: 'Provide either "raw" (full EDIFACT message) or "tag" + "data" (single segment)' };
    }
};

/**
 * Tool: parseSegmentField
 * Extract and interpret a specific field from a segment
 */
export const parseSegmentField = {
    name: 'parseSegmentField',
    description: 'Extract and interpret a specific field from an EDIFACT segment string',
    category: 'analysis',
    module: 'edifact',
    version: '2.0',
    inputSchema: {
        type: 'object',
        properties: {
            segment: {
                type: 'string',
                description: 'Full segment string (e.g., "DTM+137:20170210:102")'
            },
            fieldIndex: {
                type: 'number',
                description: 'Index of field to extract (0-based, after the tag)'
            }
        },
        required: ['segment', 'fieldIndex']
    },
    execute: async (args) => {
        const { segment, fieldIndex } = args;
        const delimiters = parseUNA('');
        const parsed = parseSegment(segment, delimiters);

        if (fieldIndex < 0 || fieldIndex >= parsed.fields.length) {
            return {
                success: false,
                error: `Field index ${fieldIndex} out of range. Segment has ${parsed.fields.length} fields (0-${parsed.fields.length - 1}).`
            };
        }

        const field = parsed.fields[fieldIndex];
        const interpretation = _interpretSegment(parsed.tag, parsed.fields);

        return {
            tag: parsed.tag,
            fieldIndex,
            value: field.value,
            components: field.components,
            isComposite: field.isComposite,
            isEmpty: !field.value || field.value.length === 0,
            segmentMeaning: interpretation.meaning,
            segmentDetails: interpretation.details
        };
    }
};

/**
 * Tool: compareSegments
 * Compare two segments and identify differences
 */
export const compareSegments = {
    name: 'compareSegments',
    description: 'Compare two EDIFACT segments and identify field-level differences',
    category: 'analysis',
    module: 'edifact',
    version: '2.0',
    inputSchema: {
        type: 'object',
        properties: {
            segment1: { type: 'string', description: 'First segment string (e.g., "NAD+BY+4024506000001::9")' },
            segment2: { type: 'string', description: 'Second segment string' }
        },
        required: ['segment1', 'segment2']
    },
    execute: async (args) => {
        const { segment1, segment2 } = args;
        const delimiters = parseUNA('');
        const parsed1 = parseSegment(segment1, delimiters);
        const parsed2 = parseSegment(segment2, delimiters);

        const sameTag = parsed1.tag === parsed2.tag;
        const maxFields = Math.max(parsed1.fields.length, parsed2.fields.length);
        const differences = [];

        for (let i = 0; i < maxFields; i++) {
            const f1 = parsed1.fields[i];
            const f2 = parsed2.fields[i];
            const val1 = f1?.value || '';
            const val2 = f2?.value || '';

            if (val1 !== val2) {
                differences.push({
                    fieldIndex: i,
                    segment1Value: val1,
                    segment2Value: val2,
                    changeType: !val1 ? 'added' : !val2 ? 'removed' : 'modified'
                });
            }
        }

        const interp1 = _interpretSegment(parsed1.tag, parsed1.fields);
        const interp2 = _interpretSegment(parsed2.tag, parsed2.fields);

        return {
            sameTag,
            tag1: parsed1.tag,
            tag2: parsed2.tag,
            identical: sameTag && differences.length === 0,
            differenceCount: differences.length,
            differences,
            interpretation1: interp1,
            interpretation2: interp2
        };
    }
};

/**
 * Tool: groupSegmentsByType
 * Group all segments from a raw EDIFACT message by tag
 */
export const groupSegmentsByType = {
    name: 'groupSegmentsByType',
    description: 'Parse a raw EDIFACT message and group all segments by their tag (UNB, UNH, DTM, NAD, LIN, etc.)',
    category: 'analysis',
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
            return { success: false, error: 'No segments found in raw EDIFACT content' };
        }

        const grouped = {};
        for (const seg of segments) {
            if (!grouped[seg.tag]) {
                grouped[seg.tag] = [];
            }
            const interpretation = _interpretSegment(seg.tag, seg.fields);
            grouped[seg.tag].push({
                position: seg.position,
                raw: seg.raw,
                fields: seg.fields,
                ...interpretation
            });
        }

        const distribution = Object.entries(grouped)
            .map(([tag, segs]) => ({ tag, count: segs.length, isKnown: KNOWN_SEGMENT_TAGS.has(tag) }))
            .sort((a, b) => b.count - a.count);

        return {
            totalSegments: segments.length,
            uniqueTagCount: Object.keys(grouped).length,
            distribution,
            groupedSegments: grouped
        };
    }
};

export default {
    segmentAnalyze,
    parseSegmentField,
    compareSegments,
    groupSegmentsByType
};
