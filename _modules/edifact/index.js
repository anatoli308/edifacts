/**
 * EDIFACT Module Entry Point
 * ==========================
 * Central registry and interface for all EDIFACT-specific agent tools and validators.
 *
 * Exports:
 * - tools:      All agent tools (segmentAnalyze, validateRules, etc.)
 * - validator:  { validate, quickCheck } from edifactValidator.js
 * - rules:      { getRules, getRequiredSegments, ... } from rules.js
 * - parser:     { parseRawEdifact, parseUNA, ... } from parser.js
 *
 * Usage:
 *   import edifact from '_modules/edifact';
 *   const report = edifact.validator.validate(rawString);
 *   const rules  = edifact.rules.getRules({ messageType: 'INVOIC' });
 */

import { tools } from './tools/index.js';
import { validate, quickCheck } from './validators/edifactValidator.js';
import {
    getRules,
    getRequiredSegments,
    getPartyRequirements,
    getFieldFormat,
    getSupportedMessageTypes,
    getEancomRules
} from './validators/rules.js';
import {
    parseRawEdifact,
    parseUNA,
    splitSegments,
    parseSegment,
    parseEdifactDate,
    KNOWN_SEGMENT_TAGS,
    DTM_QUALIFIERS,
    RFF_QUALIFIERS,
    NAD_QUALIFIERS
} from './parser.js';

export { tools };

export const validator = { validate, quickCheck };

export const rules = {
    getRules,
    getRequiredSegments,
    getPartyRequirements,
    getFieldFormat,
    getSupportedMessageTypes,
    getEancomRules
};

export const parser = {
    parseRawEdifact,
    parseUNA,
    splitSegments,
    parseSegment,
    parseEdifactDate,
    KNOWN_SEGMENT_TAGS,
    DTM_QUALIFIERS,
    RFF_QUALIFIERS,
    NAD_QUALIFIERS
};

export default { tools, validator, rules, parser };