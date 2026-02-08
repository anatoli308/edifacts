/**
 * EDI Validation Tools
 * ====================
 * Real implementations using the deterministic EDIFACT/X12 parser and analysis engine.
 * Supports both UN/EDIFACT and ANSI X12 formats with automatic detection.
 *
 * Tools:
 * 1. validateRules      — Structural validation (envelope, counts, required segments)
 * 2. checkCompliance    — Standard compliance (EANCOM, UN/EDIFACT, X12 version detection)
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

// ==================== X12 FORMAT DETECTION & PARSING ====================

/**
 * Known X12 segment tags for validation.
 * @private
 */
const KNOWN_X12_TAGS = new Set([
    'ISA', 'IEA', 'GS', 'GE', 'ST', 'SE',
    'BHT', 'HL', 'NM1', 'N3', 'N4', 'REF', 'DTP', 'TRN', 'STC',
    'SBR', 'CLM', 'CLP', 'CAS', 'SV1', 'SV2', 'SVD', 'HI',
    'DMG', 'OI', 'NTE', 'PER', 'AMT', 'QTY', 'LX', 'LQ',
    'PRV', 'CLM', 'CN1', 'PWK', 'CR1', 'CR2', 'CRC', 'HCP',
    'PAT', 'INS', 'HD', 'DTP', 'EB', 'MSG', 'III', 'LS', 'LE',
    'AAA', 'MOA', 'MIA', 'PLB', 'RDM', 'BPR', 'DTM', 'ENT',
    'AK1', 'AK2', 'AK3', 'AK4', 'AK5', 'AK9', 'CTX',
    'BGN', 'CUR', 'K3', 'MEA', 'PWK', 'RAS', 'TOO',
    'TA1', 'IK3', 'IK4', 'IK5', 'FA1', 'FA2'
]);

/**
 * Detect if raw content is X12 format.
 * @param {string} raw - Raw EDI content
 * @returns {boolean}
 * @private
 */
function _isX12Format(raw) {
    if (!raw || typeof raw !== 'string') return false;
    const trimmed = raw.trim();
    // Full X12 with ISA envelope
    if (/^ISA[^A-Za-z0-9\s]/.test(trimmed)) return true;
    // Partial X12 (transaction set or functional group without ISA envelope)
    // Detect ST, GS followed by a typical X12 element separator (* or |)
    if (/^(ST|GS)[*|]/.test(trimmed)) return true;
    return false;
}

/**
 * Parse X12 raw content into segments array compatible with validation tools.
 * Returns { segments, delimiters, format: 'x12' }
 * @param {string} raw - Raw X12 content
 * @returns {{ segments: Array, delimiters: object, format: string }}
 * @private
 */
function _parseRawX12(raw) {
    const trimmed = raw.trim();
    let elementSep, componentSep, segmentTerm;

    if (/^ISA[^A-Za-z0-9\s]/.test(trimmed) && trimmed.length >= 106) {
        // Full ISA: use fixed character positions
        elementSep = trimmed.charAt(3);
        componentSep = trimmed.charAt(104);
        segmentTerm = trimmed.charAt(105);
    } else {
        // No ISA (bare ST/GS): infer delimiters from content
        const sepMatch = trimmed.match(/^[A-Z][A-Z0-9]{1,2}([^A-Za-z0-9\s\r\n])/);
        elementSep = sepMatch?.[1] || '*';
        segmentTerm = trimmed.includes('~') ? '~' : '\n';
        // Component separator: X12 typically uses : or >
        componentSep = trimmed.includes('>') ? '>' : ':';
    }

    if (!elementSep || !segmentTerm) {
        return { segments: [], delimiters: {}, format: 'x12' };
    }

    const rawSegments = trimmed
        .split(segmentTerm)
        .map(s => s.trim().replace(/^[\r\n]+|[\r\n]+$/g, ''))
        .filter(s => s.length > 0);

    const segments = rawSegments.map((segStr, idx) => {
        const parts = segStr.split(elementSep);
        const tag = parts[0] || '';
        const fields = parts.slice(1).map(val => ({
            value: val,
            components: componentSep ? val.split(componentSep) : [val]
        }));
        return { tag, fields, position: idx + 1, raw: segStr };
    });

    return {
        segments,
        delimiters: { element: elementSep, component: componentSep, segment: segmentTerm },
        format: 'x12'
    };
}

/**
 * Universal parse: auto-detect format and parse.
 * @param {string} raw - Raw EDI content
 * @returns {{ segments: Array, delimiters: object, format: string }}
 * @private
 */
function _parseEDI(raw) {
    if (_isX12Format(raw)) {
        return _parseRawX12(raw);
    }
    const result = parseRawEdifact(raw);
    return { ...result, format: 'edifact' };
}

// ==================== TOOL IMPLEMENTATIONS ====================

/**
 * Tool: validateRules
 * Structural validation of an EDIFACT message
 */
export const validateRules = {
    name: 'validateRules',
    description: 'Validate an EDI message structure (UN/EDIFACT or ANSI X12): check required envelope segments, segment counts, control references, and structural integrity. Pass the raw EDI message string.',
    category: 'validation',
    module: 'edifact',
    version: '2.1',
    inputSchema: {
        type: 'object',
        properties: {
            raw: {
                type: 'string',
                description: 'Complete raw EDI message string (EDIFACT or X12)'
            }
        },
        required: ['raw']
    },
    execute: async (args) => {
        const { raw } = args;
        const { segments, delimiters, format } = _parseEDI(raw);

        if (segments.length === 0) {
            return { valid: false, error: 'No segments found in raw EDI content', violations: [] };
        }

        // Dispatch to format-specific validation
        if (format === 'x12') {
            return _validateRulesX12(segments);
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
                        severity: 'error',
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
 * X12-specific structural validation.
 * @param {Array} segments - Parsed X12 segments
 * @returns {object} Validation result
 * @private
 */
function _validateRulesX12(segments) {
    const violations = [];
    const segmentTags = segments.map(s => s.tag);

    // 1. Required envelope segments
    const requiredEnvelope = [
        { tag: 'ISA', label: 'Interchange Control Header' },
        { tag: 'IEA', label: 'Interchange Control Trailer' },
        { tag: 'GS', label: 'Functional Group Header' },
        { tag: 'GE', label: 'Functional Group Trailer' },
        { tag: 'ST', label: 'Transaction Set Header' },
        { tag: 'SE', label: 'Transaction Set Trailer' }
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

    // 2. ISA/IEA pairing and control number match
    const isaSegments = segments.filter(s => s.tag === 'ISA');
    const ieaSegments = segments.filter(s => s.tag === 'IEA');

    if (isaSegments.length !== ieaSegments.length) {
        violations.push({
            rule: 'ENVELOPE_PAIRING',
            severity: 'error',
            segment: 'ISA/IEA',
            message: `ISA/IEA count mismatch: ${isaSegments.length} ISA vs ${ieaSegments.length} IEA`
        });
    }

    for (let i = 0; i < Math.min(isaSegments.length, ieaSegments.length); i++) {
        const isaControl = (isaSegments[i].fields[12]?.value || '').trim();
        const ieaControl = (ieaSegments[i].fields[1]?.value || '').trim();
        if (isaControl && ieaControl && isaControl !== ieaControl) {
            violations.push({
                rule: 'CONTROL_REFERENCE',
                severity: 'error',
                segment: 'ISA/IEA',
                message: `Control number mismatch: ISA="${isaControl}" vs IEA="${ieaControl}"`
            });
        }
    }

    // 3. GS/GE pairing and control number match
    const gsSegments = segments.filter(s => s.tag === 'GS');
    const geSegments = segments.filter(s => s.tag === 'GE');

    if (gsSegments.length !== geSegments.length) {
        violations.push({
            rule: 'ENVELOPE_PAIRING',
            severity: 'error',
            segment: 'GS/GE',
            message: `GS/GE count mismatch: ${gsSegments.length} GS vs ${geSegments.length} GE`
        });
    }

    for (let i = 0; i < Math.min(gsSegments.length, geSegments.length); i++) {
        const gsControl = (gsSegments[i].fields[5]?.value || '').trim();
        const geControl = (geSegments[i].fields[1]?.value || '').trim();
        if (gsControl && geControl && gsControl !== geControl) {
            violations.push({
                rule: 'CONTROL_REFERENCE',
                severity: 'error',
                segment: 'GS/GE',
                message: `Group control number mismatch: GS="${gsControl}" vs GE="${geControl}"`
            });
        }
    }

    // 4. ST/SE pairing and segment count
    const stSegments = segments.filter(s => s.tag === 'ST');
    const seSegments = segments.filter(s => s.tag === 'SE');

    if (stSegments.length !== seSegments.length) {
        violations.push({
            rule: 'ENVELOPE_PAIRING',
            severity: 'error',
            segment: 'ST/SE',
            message: `ST/SE count mismatch: ${stSegments.length} ST vs ${seSegments.length} SE`
        });
    }

    for (let i = 0; i < Math.min(stSegments.length, seSegments.length); i++) {
        const se = seSegments[i];
        const st = stSegments[i];
        const stControl = (st.fields[1]?.value || '').trim();
        const seControl = (se.fields[1]?.value || '').trim();

        if (stControl && seControl && stControl !== seControl) {
            violations.push({
                rule: 'CONTROL_REFERENCE',
                severity: 'error',
                segment: 'ST/SE',
                message: `Transaction set control number mismatch: ST="${stControl}" vs SE="${seControl}"`
            });
        }

        // SE segment count validation
        const declaredCount = parseInt(se.fields[0]?.value, 10);
        if (declaredCount) {
            const stIdx = segments.indexOf(st);
            const seIdx = segments.indexOf(se);
            const actualCount = seIdx - stIdx + 1;
            if (declaredCount !== actualCount) {
                violations.push({
                    rule: 'SEGMENT_COUNT',
                    severity: 'error',
                    segment: 'SE',
                    message: `SE declares ${declaredCount} segments but actual count is ${actualCount} (ST to SE inclusive)`,
                    expected: declaredCount,
                    actual: actualCount
                });
            }
        }
    }

    // 5. IEA group count
    for (const iea of ieaSegments) {
        const declaredGroups = parseInt(iea.fields[0]?.value, 10);
        if (declaredGroups && declaredGroups !== gsSegments.length) {
            violations.push({
                rule: 'MESSAGE_COUNT',
                severity: 'warning',
                segment: 'IEA',
                message: `IEA declares ${declaredGroups} functional groups but found ${gsSegments.length}`,
                expected: declaredGroups,
                actual: gsSegments.length
            });
        }
    }

    // 6. GE transaction set count
    for (const ge of geSegments) {
        const declaredTxSets = parseInt(ge.fields[0]?.value, 10);
        if (declaredTxSets && declaredTxSets !== stSegments.length) {
            violations.push({
                rule: 'MESSAGE_COUNT',
                severity: 'warning',
                segment: 'GE',
                message: `GE declares ${declaredTxSets} transaction sets but found ${stSegments.length}`,
                expected: declaredTxSets,
                actual: stSegments.length
            });
        }
    }

    // 7. Unknown segment tags
    for (const seg of segments) {
        if (!KNOWN_X12_TAGS.has(seg.tag) && /^[A-Z]{2,3}\d?$/.test(seg.tag)) {
            violations.push({
                rule: 'UNKNOWN_SEGMENT',
                severity: 'info',
                segment: seg.tag,
                position: seg.position,
                message: `Unknown X12 segment tag: ${seg.tag}`
            });
        }
    }

    const errorCount = violations.filter(v => v.severity === 'error').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;

    return {
        valid: errorCount === 0,
        totalSegments: segments.length,
        messageCount: stSegments.length,
        standard: 'ANSI X12',
        errorCount,
        warningCount,
        violationCount: violations.length,
        violations
    };
}

/**
 * Tool: checkCompliance
 * Check EDI message compliance against a standard
 */
export const checkCompliance = {
    name: 'checkCompliance',
    description: 'Check EDI message compliance against a standard (EANCOM, UN/EDIFACT, ODETTE, ANSI X12). Detects standard, version, and subset from the message itself. Pass the raw EDI message string.',
    category: 'validation',
    module: 'edifact',
    version: '2.1',
    inputSchema: {
        type: 'object',
        properties: {
            raw: {
                type: 'string',
                description: 'Complete raw EDI message string (EDIFACT or X12)'
            },
            standard: {
                type: 'string',
                description: 'Optional: expected standard (e.g., "EANCOM", "UN/EDIFACT", "ANSI X12"). If omitted, auto-detected.'
            },
            subset: {
                type: 'string',
                description: 'Optional: expected subset or version (e.g., "D96A", "005010X222A1"). If omitted, auto-detected.'
            }
        },
        required: ['raw']
    },
    execute: async (args) => {
        const { raw, standard: expectedStandard, subset: expectedSubset } = args;
        const { segments, format } = _parseEDI(raw);

        if (segments.length === 0) {
            return { compliant: false, error: 'No segments found in raw EDI content' };
        }

        // Dispatch to X12 compliance check
        if (format === 'x12') {
            return _checkComplianceX12(segments, expectedStandard, expectedSubset);
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
 * X12-specific compliance check.
 * @param {Array} segments - Parsed X12 segments
 * @param {string|undefined} expectedStandard
 * @param {string|undefined} expectedSubset
 * @returns {object} Compliance result
 * @private
 */
function _checkComplianceX12(segments, expectedStandard, expectedSubset) {
    const issues = [];
    const segmentTags = segments.map(s => s.tag);
    const uniqueTags = [...new Set(segmentTags)];

    // Extract version info from GS and ST
    const gsSegment = segments.find(s => s.tag === 'GS');
    const stSegment = segments.find(s => s.tag === 'ST');
    const isaSegment = segments.find(s => s.tag === 'ISA');

    const functionalIdCode = gsSegment?.fields[0]?.value || '';
    const gsVersion = gsSegment?.fields[7]?.value || '';
    const messageType = stSegment?.fields[0]?.value || '';
    const stVersion = stSegment?.fields[2]?.value || '';
    const isaVersion = isaSegment?.fields[11]?.value?.trim() || '';

    const detectedStandard = 'ANSI X12';
    const detectedVersion = stVersion || gsVersion || isaVersion;
    const standard = expectedStandard || detectedStandard;
    const subset = expectedSubset || functionalIdCode;

    // Required envelope segments
    const requiredSegments = ['ISA', 'GS', 'ST', 'SE', 'GE', 'IEA'];
    const missingRequired = requiredSegments.filter(tag => !segmentTags.includes(tag));

    for (const tag of missingRequired) {
        issues.push({
            severity: 'error',
            segment: tag,
            message: `${standard}: Missing required envelope segment ${tag}`
        });
    }

    // ISA version check (should be 00501 for 5010)
    if (isaVersion && !['00501', '00401', '00400', '00402'].includes(isaVersion)) {
        issues.push({
            severity: 'info',
            segment: 'ISA',
            message: `Unusual ISA version: "${isaVersion}". Common versions: 00401, 00501`
        });
    }

    // GS version responsibility designator should match ST implementation
    if (gsVersion && stVersion && !stVersion.startsWith(gsVersion.slice(0, 5))) {
        issues.push({
            severity: 'info',
            segment: 'GS/ST',
            message: `GS version "${gsVersion}" and ST implementation "${stVersion}" may be inconsistent`
        });
    }

    // Expected standard mismatch
    if (expectedStandard && expectedStandard !== detectedStandard) {
        issues.push({
            severity: 'warning',
            segment: 'ISA',
            message: `Expected standard "${expectedStandard}" but detected "${detectedStandard}"`
        });
    }

    // Test indicator check
    const testIndicator = isaSegment?.fields[14]?.value?.trim() || '';
    if (testIndicator === 'T') {
        issues.push({
            severity: 'info',
            segment: 'ISA',
            message: 'Interchange is flagged as TEST (ISA15=T). Not suitable for production processing.'
        });
    }

    return {
        compliant: issues.filter(i => i.severity === 'error').length === 0,
        standard,
        detectedStandard,
        subset,
        detectedVersion,
        messageType,
        functionalIdCode,
        isaVersion,
        requiredSegments,
        missingSegments: missingRequired,
        presentSegments: uniqueTags,
        issueCount: issues.length,
        issues
    };
}

/**
 * Tool: detectAnomalies
 * Find unusual patterns or data quality issues
 */
export const detectAnomalies = {
    name: 'detectAnomalies',
    description: 'Detect anomalies and data quality issues in an EDI message (EDIFACT or X12): duplicate references, unusual values, missing data, inconsistencies. Pass the raw EDI message string.',
    category: 'validation',
    module: 'edifact',
    version: '2.1',
    inputSchema: {
        type: 'object',
        properties: {
            raw: {
                type: 'string',
                description: 'Complete raw EDI message string (EDIFACT or X12)'
            }
        },
        required: ['raw']
    },
    execute: async (args) => {
        const { raw } = args;
        const { segments, format } = _parseEDI(raw);

        if (segments.length === 0) {
            return { anomalyCount: 0, anomalies: [], error: 'No segments found' };
        }

        // Dispatch to X12 anomaly detection
        if (format === 'x12') {
            return _detectAnomaliesX12(segments);
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
 * X12-specific anomaly detection.
 * @param {Array} segments - Parsed X12 segments
 * @returns {object} Anomaly detection result
 * @private
 */
function _detectAnomaliesX12(segments) {
    const anomalies = [];

    // 1. Duplicate TRN trace numbers
    const traceNumbers = [];
    for (const seg of segments) {
        if (seg.tag === 'TRN') {
            const traceType = seg.fields[0]?.value || '';
            const traceNum = seg.fields[1]?.value || '';
            if (traceNum) {
                traceNumbers.push({ traceType, traceNum, position: seg.position });
            }
        }
    }

    const trnCounts = {};
    for (const trn of traceNumbers) {
        const key = `${trn.traceType}:${trn.traceNum}`;
        if (!trnCounts[key]) trnCounts[key] = [];
        trnCounts[key].push(trn.position);
    }

    for (const [key, positions] of Object.entries(trnCounts)) {
        if (positions.length > 1) {
            anomalies.push({
                type: 'DUPLICATE_TRACE',
                severity: 'warning',
                message: `Duplicate TRN trace number "${key}" appears ${positions.length} times`,
                positions
            });
        }
    }

    // 2. Duplicate REF references
    const references = [];
    for (const seg of segments) {
        if (seg.tag === 'REF') {
            const qualifier = seg.fields[0]?.value || '';
            const value = seg.fields[1]?.value || '';
            if (value) references.push({ qualifier, value, position: seg.position });
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
                message: `Duplicate REF ${qual}: "${val}" appears ${positions.length} times`,
                positions,
                qualifier: qual,
                value: val
            });
        }
    }

    // 3. AMT value anomalies (very high amounts)
    const amounts = [];
    for (const seg of segments) {
        if (seg.tag === 'AMT') {
            const qualifier = seg.fields[0]?.value || '';
            const amount = parseFloat(seg.fields[1]?.value);
            if (!isNaN(amount)) {
                amounts.push({ qualifier, amount, position: seg.position });
            }
        }
    }

    if (amounts.length > 1) {
        const avgAmount = amounts.reduce((sum, a) => sum + a.amount, 0) / amounts.length;
        const stdDev = Math.sqrt(amounts.reduce((sum, a) => sum + Math.pow(a.amount - avgAmount, 2), 0) / amounts.length);
        for (const a of amounts) {
            if (stdDev > 0 && Math.abs(a.amount - avgAmount) > 2 * stdDev) {
                anomalies.push({
                    type: 'UNUSUAL_AMOUNT',
                    severity: 'warning',
                    message: `Amount ${a.amount} (${a.qualifier}) at position ${a.position} is unusual (avg: ${avgAmount.toFixed(2)})`,
                    position: a.position,
                    amount: a.amount
                });
            }
        }
    }

    // 4. QTY anomalies (very high quantities)
    for (const seg of segments) {
        if (seg.tag === 'QTY') {
            const qty = parseFloat(seg.fields[1]?.value);
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

    // 5. DTP date consistency (dates should be in reasonable range)
    for (const seg of segments) {
        if (seg.tag === 'DTP') {
            const dateVal = seg.fields[2]?.value || '';
            const format = seg.fields[1]?.value || '';
            if (format === 'D8' && dateVal.length === 8) {
                const year = parseInt(dateVal.slice(0, 4), 10);
                if (year < 2000 || year > 2030) {
                    anomalies.push({
                        type: 'DATE_RANGE',
                        severity: 'warning',
                        message: `Date ${dateVal} at position ${seg.position} has unusual year ${year}`,
                        position: seg.position
                    });
                }
            }
        }
    }

    // 6. Missing NM1 parties (no payer or subscriber in healthcare)
    const nm1Qualifiers = segments.filter(s => s.tag === 'NM1').map(s => s.fields[0]?.value || '');
    if (nm1Qualifiers.length > 0 && !nm1Qualifiers.includes('PR') && !nm1Qualifiers.includes('40')) {
        anomalies.push({
            type: 'MISSING_PARTY',
            severity: 'info',
            message: 'No Payer party (NM1*PR) found in X12 message'
        });
    }

    // 7. HL hierarchy gaps
    const hlSegments = segments.filter(s => s.tag === 'HL');
    if (hlSegments.length > 0) {
        const hlIds = hlSegments.map(s => parseInt(s.fields[0]?.value, 10)).filter(n => !isNaN(n));
        for (let i = 0; i < hlIds.length - 1; i++) {
            if (hlIds[i + 1] !== hlIds[i] + 1) {
                anomalies.push({
                    type: 'HL_ID_GAP',
                    severity: 'info',
                    message: `HL hierarchy ID gap: ${hlIds[i]} → ${hlIds[i + 1]} (expected sequential)`,
                    position: hlSegments[i + 1]?.position
                });
            }
        }
    }

    return {
        anomalyCount: anomalies.length,
        hasAnomalies: anomalies.length > 0,
        standard: 'ANSI X12',
        anomalies,
        summary: {
            errors: anomalies.filter(a => a.severity === 'error').length,
            warnings: anomalies.filter(a => a.severity === 'warning').length,
            info: anomalies.filter(a => a.severity === 'info').length
        }
    };
}

/**
 * Tool: validateDataTypes
 * Validate field types, formats, and value ranges
 */
export const validateDataTypes = {
    name: 'validateDataTypes',
    description: 'Validate EDI message fields for correct data types, date formats, numeric ranges, and identifier formats. Pass the raw EDI message string (EDIFACT or X12).',
    category: 'validation',
    module: 'edifact',
    version: '2.1',
    inputSchema: {
        type: 'object',
        properties: {
            raw: {
                type: 'string',
                description: 'Complete raw EDI message string (EDIFACT or X12)'
            }
        },
        required: ['raw']
    },
    execute: async (args) => {
        const { raw } = args;
        const { segments, format } = _parseEDI(raw);

        if (segments.length === 0) {
            return { valid: false, error: 'No segments found', errors: [] };
        }

        // X12 data type validation
        if (format === 'x12') {
            return _validateDataTypesX12(segments);
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
 * X12-specific data type validation.
 * @param {Array} segments - Parsed X12 segments
 * @returns {object} Validation result
 * @private
 */
function _validateDataTypesX12(segments) {
    const errors = [];

    for (const seg of segments) {
        switch (seg.tag) {
            case 'DTP': {
                // Validate X12 date formats
                const format = seg.fields[1]?.value || '';
                const dateValue = seg.fields[2]?.value || '';
                if (dateValue) {
                    if (format === 'D8' && !/^\d{8}$/.test(dateValue)) {
                        errors.push({
                            segment: 'DTP',
                            position: seg.position,
                            field: 'DTP03',
                            expected: '8-digit date (CCYYMMDD)',
                            actual: dateValue,
                            message: `Date "${dateValue}" should be 8 digits for format D8`
                        });
                    }
                    if (format === 'RD8' && !/^\d{8}-\d{8}$/.test(dateValue)) {
                        errors.push({
                            segment: 'DTP',
                            position: seg.position,
                            field: 'DTP03',
                            expected: 'Date range (CCYYMMDD-CCYYMMDD)',
                            actual: dateValue,
                            message: `Date range "${dateValue}" should be CCYYMMDD-CCYYMMDD for format RD8`
                        });
                    }
                }
                break;
            }
            case 'AMT': {
                const amount = seg.fields[1]?.value || '';
                if (amount && isNaN(parseFloat(amount))) {
                    errors.push({
                        segment: 'AMT',
                        position: seg.position,
                        field: 'AMT02',
                        expected: 'Numeric value',
                        actual: amount,
                        message: `Amount "${amount}" is not a valid number`
                    });
                }
                break;
            }
            case 'QTY': {
                const qty = seg.fields[1]?.value || '';
                if (qty && isNaN(parseFloat(qty))) {
                    errors.push({
                        segment: 'QTY',
                        position: seg.position,
                        field: 'QTY02',
                        expected: 'Numeric value',
                        actual: qty,
                        message: `Quantity "${qty}" is not a valid number`
                    });
                }
                if (qty && parseFloat(qty) < 0) {
                    errors.push({
                        segment: 'QTY',
                        position: seg.position,
                        field: 'QTY02',
                        expected: 'Non-negative quantity',
                        actual: qty,
                        message: `Quantity "${qty}" is negative`
                    });
                }
                break;
            }
            case 'NM1': {
                // Entity type qualifier should be 1 (person) or 2 (non-person entity)
                const entityType = seg.fields[1]?.value || '';
                if (entityType && !['1', '2'].includes(entityType)) {
                    errors.push({
                        segment: 'NM1',
                        position: seg.position,
                        field: 'NM102',
                        expected: '1 (Person) or 2 (Non-Person Entity)',
                        actual: entityType,
                        message: `Entity type qualifier "${entityType}" should be 1 or 2`
                    });
                }
                break;
            }
            case 'SE': {
                const segCount = seg.fields[0]?.value || '';
                if (segCount && isNaN(parseInt(segCount, 10))) {
                    errors.push({
                        segment: 'SE',
                        position: seg.position,
                        field: 'SE01',
                        expected: 'Integer (segment count)',
                        actual: segCount,
                        message: `Segment count "${segCount}" is not a valid integer`
                    });
                }
                break;
            }
            case 'IEA': {
                const groupCount = seg.fields[0]?.value || '';
                if (groupCount && isNaN(parseInt(groupCount, 10))) {
                    errors.push({
                        segment: 'IEA',
                        position: seg.position,
                        field: 'IEA01',
                        expected: 'Integer (group count)',
                        actual: groupCount,
                        message: `Group count "${groupCount}" is not a valid integer`
                    });
                }
                break;
            }
        }
    }

    return {
        valid: errors.length === 0,
        standard: 'ANSI X12',
        errorCount: errors.length,
        errors,
        segmentsChecked: segments.length
    };
}

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
