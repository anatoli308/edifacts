/**
 * EDIFACT Analysis Tools
 * =======================
 * Tools for running full deterministic EDIFACT analysis from agent context.
 *
 * Tools:
 * 1. analyzeEdifact — Extract EDIFACT from mixed text, parse, validate, return structured analysis
 *
 * Use Case:
 * When users paste EDIFACT data mixed with natural language text, the automatic
 * detection in agentHandlers may miss it because _extractEdifactFromText requires
 * the message to start with UNB/UNH. This tool lets the LLM intelligently decide
 * to extract and analyze EDIFACT data found anywhere in user input.
 *
 * v1.0 — Initial implementation
 */

import {
    parseRawEdifact,
    KNOWN_SEGMENT_TAGS,
} from '../parser.js';
import { buildAnalysis } from '../../../_workers/edifactAnalysisBuilder.js';

// ==================== EDIFACT EXTRACTION ====================

/**
 * Extract raw EDIFACT content from mixed text.
 * More aggressive than the runner's detection — looks for any EDIFACT-like
 * segment pattern and extracts the contiguous block.
 * @param {string} text - Mixed text possibly containing EDIFACT
 * @returns {string|null} Extracted EDIFACT string or null
 * @private
 */
function _extractEdifact(text) {
    if (!text || typeof text !== 'string') return null;

    // Find first segment tag followed by + (field separator)
    const segmentPattern = /\b(UNA|UNB|UNH|BGM|DTM|NAD|RFF|CUX|LIN|QTY|PRI|MOA|TAX|UNS|CNT|UNT|UNZ|FTX|ALC|TDT|LOC|CTA|COM|PAT|PIA|IMD|PAC|PCI|TOD|SCC|MEA|GIN|GIR|ALI|DOC|EQD|SEL|DGS|FII|PCD|RNG|STS|IDE|TSR|ERP|RCS|AJT|UNG|UNE)\+/;
    const firstMatch = text.search(segmentPattern);
    if (firstMatch === -1) return null;

    // Check for UNA before UNB
    const unaPos = text.indexOf('UNA');
    const startPos = (unaPos !== -1 && unaPos < firstMatch) ? unaPos : firstMatch;

    // Find the last segment terminator (')
    const lastTerminator = text.lastIndexOf("'");
    if (lastTerminator <= startPos) return null;

    const extracted = text.substring(startPos, lastTerminator + 1).trim();

    // Validate: must have at least 2 segment tags with + separator
    const tagMatches = extracted.match(/\b[A-Z]{3}\+/g) || [];
    if (tagMatches.length < 2) return null;

    return extracted;
}

// ==================== TOOL: analyzeEdifact ====================

/**
 * Tool: analyzeEdifact
 * 
 * Extracts EDIFACT data from mixed text, runs full deterministic analysis
 * (parsing, validation, compliance, business data extraction), and returns
 * a structured analysis result.
 *
 * The LLM agent calls this when it detects EDIFACT content in user input
 * that the automatic pre-analysis may have missed.
 */
export const analyzeEdifact = {
    name: 'analyzeEdifact',
    description: 'Extract EDIFACT data from text and run a full deterministic analysis (parsing, validation, compliance check, business data extraction). Use this when the user message contains EDIFACT segments mixed with natural language text. Returns a structured analysis with segments, validation results, parties, business data, and compliance status.',
    category: 'analysis',
    module: 'edifact',
    version: '1.0',
    inputSchema: {
        type: 'object',
        properties: {
            raw: {
                type: 'string',
                description: 'The text containing EDIFACT data. Can be pure EDIFACT or mixed with natural language — the tool will extract the EDIFACT portion automatically.'
            }
        },
        required: ['raw']
    },
    execute: async (args) => {
        const { raw } = args;

        if (!raw || typeof raw !== 'string') {
            return { success: false, error: 'No input text provided' };
        }

        // Extract EDIFACT content from mixed text
        const edifactContent = _extractEdifact(raw);
        if (!edifactContent) {
            return {
                success: false,
                error: 'No valid EDIFACT data found in the provided text. Expected segment tags like UNB+, UNH+, BGM+, etc.'
            };
        }

        // Run full analysis via the deterministic builder
        const fileInfo = {
            name: 'agent-extracted.edi',
            size: Buffer.byteLength(edifactContent, 'utf8'),
            path: 'inline',
        };

        const analysis = buildAnalysis(edifactContent, fileInfo, {});

        // Return analysis with type marker so frontend can render EdifactAnalysisPanel
        return {
            _type: 'edifact_analysis',
            analysis,
            extractedRaw: edifactContent,
            summary: `Analyzed ${analysis.segmentCount} segments | Type: ${analysis.messageHeader?.messageType || 'unknown'} | Status: ${analysis.status} | Errors: ${analysis.validation?.errorCount || 0} | Warnings: ${analysis.validation?.warningCount || 0}`
        };
    }
};
