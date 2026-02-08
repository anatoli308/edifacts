/**
 * EDIFACT Validator (Main)
 * =======================
 * Core validation engine for EDIFACT messages.
 *
 * Orchestrates all validation checks against the rule engine (rules.js)
 * and the deterministic parser (parser.js). Returns a comprehensive
 * validation report with severity levels, statistics and actionable feedback.
 *
 * Validation Pipeline:
 * 1. Parse raw EDIFACT (parser.js)
 * 2. Detect message type & standard from UNB/UNH
 * 3. Load applicable rules (rules.js, filtered by type + standard)
 * 4. Execute each rule, collect results
 * 5. Aggregate into validation report
 *
 * Usage:
 *   import { validate } from '_modules/edifact/validators/edifactValidator.js';
 *   const report = validate(rawEdifactString);
 *   // or with options:
 *   const report = validate(rawEdifactString, { standard: 'EANCOM' });
 */

import { parseRawEdifact, parseEdifactDate, KNOWN_SEGMENT_TAGS } from '../parser.js';
import { getRules, getRequiredSegments } from './rules.js';

// ─────────────────────────────────────────────────────────────
//  Helper: detect message type and standard from parsed segments
// ─────────────────────────────────────────────────────────────

function _detectMessageMeta(segments) {
    const unbSegment = segments.find(s => s.tag === 'UNB');
    const unhSegment = segments.find(s => s.tag === 'UNH');
    const unzSegment = segments.find(s => s.tag === 'UNZ');

    const unhMsgId = unhSegment?.fields[1]?.components || [];
    const messageType = unhMsgId[0] || '';
    const messageVersion = unhMsgId[1] || '';
    const messageRelease = unhMsgId[2] || '';
    const controllingAgency = unhMsgId[3] || '';
    const associationCode = unhMsgId[4] || '';

    // Standard detection
    let standard = 'UN/EDIFACT';
    if (associationCode.toUpperCase().includes('EAN')) standard = 'EANCOM';
    else if (associationCode.toUpperCase().includes('ODETTE')) standard = 'ODETTE';

    return {
        messageType,
        messageVersion,
        messageRelease,
        controllingAgency,
        associationCode,
        standard,
        version: `${messageVersion}${messageRelease}`,
        unbSegment,
        unhSegment,
        unzSegment
    };
}

// ═════════════════════════════════════════════════════════════
//  PUBLIC API
// ═════════════════════════════════════════════════════════════

/**
 * Validate a raw EDIFACT message string.
 *
 * @param {string} raw - Complete raw EDIFACT message string
 * @param {object} [options] - Optional overrides
 * @param {string} [options.standard] - Force a specific standard (e.g. 'EANCOM')
 * @param {string} [options.messageType] - Force a specific message type (e.g. 'INVOIC')
 * @param {Array}  [options.extraRules] - Additional custom rules to execute
 * @param {Array}  [options.disabledRules] - Rule codes to skip (e.g. ['BIZ_004'])
 * @returns {{ valid, messageType, standard, version, statistics, results }}
 */
export function validate(raw, options = {}) {
    if (!raw || typeof raw !== 'string') {
        return {
            valid: false,
            messageType: '',
            standard: '',
            version: '',
            statistics: { total: 1, errors: 1, warnings: 0, info: 0, passed: 0 },
            results: [{
                code: 'PARSE_001',
                type: 'PARSE',
                severity: 'error',
                description: 'Input validation',
                pass: false,
                detail: 'No raw EDIFACT content provided or input is not a string'
            }]
        };
    }

    // 1. Parse
    const { segments, delimiters } = parseRawEdifact(raw);

    if (segments.length === 0) {
        return {
            valid: false,
            messageType: '',
            standard: '',
            version: '',
            statistics: { total: 1, errors: 1, warnings: 0, info: 0, passed: 0 },
            results: [{
                code: 'PARSE_002',
                type: 'PARSE',
                severity: 'error',
                description: 'Segment parsing',
                pass: false,
                detail: 'No segments could be parsed from the raw EDIFACT content'
            }]
        };
    }

    // 2. Detect message metadata
    const meta = _detectMessageMeta(segments);
    const messageType = options.messageType || meta.messageType;
    const standard = options.standard || meta.standard;

    // 3. Load applicable rules
    const applicableRules = getRules({ messageType, standard });

    // Merge extra rules if provided
    const allRules = options.extraRules
        ? [...applicableRules, ...options.extraRules]
        : applicableRules;

    // Filter out disabled rules
    const disabledSet = new Set(options.disabledRules || []);
    const activeRules = allRules.filter(r => !disabledSet.has(r.code));

    // 4. Build rule execution context
    const segmentTags = segments.map(s => s.tag);
    const uniqueTags = [...new Set(segmentTags)];

    const ctx = {
        segments,
        segmentTags,
        uniqueTags,
        delimiters,
        knownTags: KNOWN_SEGMENT_TAGS,
        unbSegment: meta.unbSegment,
        unhSegment: meta.unhSegment,
        unzSegment: meta.unzSegment,
        messageType,
        standard,
        version: meta.version,
        parseDate: parseEdifactDate
    };

    // 5. Execute rules
    const results = [];

    for (const rule of activeRules) {
        try {
            const outcome = rule.check(ctx);
            const pass = typeof outcome === 'boolean' ? outcome : outcome.pass;
            const detail = typeof outcome === 'boolean' ? '' : (outcome.detail || '');

            results.push({
                code: rule.code,
                type: rule.type,
                severity: rule.severity,
                description: rule.description,
                pass,
                detail
            });
        } catch (err) {
            results.push({
                code: rule.code,
                type: rule.type,
                severity: 'error',
                description: rule.description,
                pass: false,
                detail: `Rule execution error: ${err.message}`
            });
        }
    }

    // 6. Aggregate statistics
    const failed = results.filter(r => !r.pass);
    const statistics = {
        total: results.length,
        passed: results.filter(r => r.pass).length,
        errors: failed.filter(r => r.severity === 'error').length,
        warnings: failed.filter(r => r.severity === 'warning').length,
        info: failed.filter(r => r.severity === 'info').length
    };

    return {
        valid: statistics.errors === 0,
        messageType,
        standard,
        version: meta.version,
        controllingAgency: meta.controllingAgency,
        associationCode: meta.associationCode,
        totalSegments: segments.length,
        uniqueSegmentTags: uniqueTags,
        requiredSegments: getRequiredSegments(messageType).map(r => r.tag),
        statistics,
        results,
        // Convenience: only failed results
        failures: failed
    };
}

/**
 * Quick check: is a raw EDIFACT string structurally valid?
 * Faster than full validate() — only runs ENVELOPE rules.
 *
 * @param {string} raw
 * @returns {{ valid: boolean, errorCount: number, errors: string[] }}
 */
export function quickCheck(raw) {
    if (!raw || typeof raw !== 'string') {
        return { valid: false, errorCount: 1, errors: ['No input provided'] };
    }

    const { segments } = parseRawEdifact(raw);
    if (segments.length === 0) {
        return { valid: false, errorCount: 1, errors: ['No segments parsed'] };
    }

    const meta = _detectMessageMeta(segments);
    const envelopeRules = getRules({ messageType: meta.messageType, standard: meta.standard })
        .filter(r => r.type === 'ENVELOPE');

    const segmentTags = segments.map(s => s.tag);
    const ctx = {
        segments,
        segmentTags,
        uniqueTags: [...new Set(segmentTags)],
        knownTags: KNOWN_SEGMENT_TAGS,
        unbSegment: meta.unbSegment,
        unhSegment: meta.unhSegment,
        unzSegment: meta.unzSegment,
        messageType: meta.messageType,
        standard: meta.standard,
        parseDate: parseEdifactDate
    };

    const errors = [];
    for (const rule of envelopeRules) {
        try {
            const outcome = rule.check(ctx);
            const pass = typeof outcome === 'boolean' ? outcome : outcome.pass;
            if (!pass && rule.severity === 'error') {
                const detail = typeof outcome === 'boolean' ? rule.description : (outcome.detail || rule.description);
                errors.push(`[${rule.code}] ${detail}`);
            }
        } catch (err) {
            errors.push(`[${rule.code}] Rule error: ${err.message}`);
        }
    }

    return {
        valid: errors.length === 0,
        errorCount: errors.length,
        errors
    };
}

export default { validate, quickCheck };
