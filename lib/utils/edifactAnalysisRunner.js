/**
 * EDI Analysis Runner
 * ===================
 * Runs deterministic EDI analysis per message.
 * Supports both UN/EDIFACT and ANSI X12 formats.
 *
 * Analysis sources (checked in order):
 * 1. Raw EDI data in the userMessage (pasted by user)
 * 2. File uploaded with this message (future: per-message file upload)
 *
 * Detection order:
 * 1. X12 (ISA*...) — checked first (fixed-length ISA header)
 * 2. UN/EDIFACT (UNB+...) — checked second
 *
 * Designed to run in the agent handler flow (not in a worker thread)
 * so the result is immediately available for the agent pipeline.
 */
import { readFileSync, existsSync } from 'fs';
import { buildAnalysis } from '../../_workers/edifactAnalysisBuilder.js';
import { buildX12Analysis } from '../../_workers/x12AnalysisBuilder.js';
import { fileRepo } from '../db/repositories/index.js';

/**
 * Common EDIFACT segment tags used to detect raw EDIFACT in text.
 * @private
 */
const EDIFACT_INDICATORS = ['UNA', 'UNB', 'UNH', 'BGM', 'DTM', 'NAD', 'LIN', 'UNT', 'UNZ'];

/**
 * Common X12 segment tags used to detect raw X12 in text.
 * @private
 */
const X12_INDICATORS = ['ISA', 'GS', 'ST', 'SE', 'GE', 'IEA'];

/**
 * Detect if a string contains raw X12 data.
 * Supports both full X12 (ISA*...) and bare transaction sets (ST*...).
 * @param {string} text - Text to check
 * @returns {string|null} Extracted X12 content or null
 * @private
 */
function _extractX12FromText(text) {
    if (!text || typeof text !== 'string') return null;

    // Strategy 1: Full ISA envelope
    const isaMatch = text.match(/ISA[^A-Za-z0-9\s]/);
    if (isaMatch) {
        const isaStart = text.indexOf(isaMatch[0]);
        const elementSep = text.charAt(isaStart + 3);
        if (!elementSep) return null;

        const segmentTerm = text.charAt(isaStart + 105);
        if (!segmentTerm) return null;

        const lastTermIdx = text.lastIndexOf(segmentTerm);
        if (lastTermIdx <= isaStart) return text.substring(isaStart);
        return text.substring(isaStart, lastTermIdx + 1);
    }

    // Strategy 2: Bare X12 transaction set (ST* or GS* without ISA)
    const bareMatch = text.match(/(ST|GS)[*|]/);
    if (!bareMatch) return null;

    const startPos = text.indexOf(bareMatch[0]);
    if (startPos === -1) return null;

    // Infer element separator from first segment tag
    const elementSep = bareMatch[0].charAt(2);
    const escapedSep = elementSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Count X12 segment tags to validate
    let segmentCount = 0;
    for (const tag of X12_INDICATORS) {
        const regex = new RegExp(`${tag}${escapedSep}`, 'g');
        segmentCount += (text.match(regex) || []).length;
    }
    if (segmentCount < 2) return null;

    // Determine segment terminator (~ is most common, fallback to newline)
    const segmentTerm = text.includes('~') ? '~' : null;
    if (!segmentTerm) return null;

    const lastTermIdx = text.lastIndexOf(segmentTerm);
    if (lastTermIdx <= startPos) return text.substring(startPos);
    return text.substring(startPos, lastTermIdx + 1);
}

/**
 * Detect if a string contains raw EDIFACT data.
 * Looks for known segment tags followed by the field separator (+).
 * @param {string} text - Text to check
 * @returns {string|null} Extracted EDIFACT content or null
 * @private
 */
function _extractEdifactFromText(text) {
    if (!text || typeof text !== 'string') return null;

    // Must contain at least UNB or UNH with field separator to be EDIFACT
    const hasEnvelope = /UNB\+/.test(text) || /UNH\+/.test(text);
    if (!hasEnvelope) return null;

    // Count how many EDIFACT segment tags appear with + separator
    const segmentCount = EDIFACT_INDICATORS.reduce((count, tag) => {
        const regex = new RegExp(`${tag}\\+`, 'g');
        return count + (text.match(regex) || []).length;
    }, 0);

    // Need at least 3 EDIFACT segments to consider it valid
    if (segmentCount < 3) return null;

    // Extract the EDIFACT portion: from UNA or UNB to the end of the last segment
    const unaStart = text.indexOf('UNA');
    const unbStart = text.indexOf('UNB');
    const edifactStart = unaStart !== -1 ? unaStart : unbStart;

    if (edifactStart === -1) return null;

    // Find the last segment terminator (typically ')
    const lastTerminator = text.lastIndexOf("'");
    if (lastTerminator <= edifactStart) return text.substring(edifactStart);

    return text.substring(edifactStart, lastTerminator + 1);
}

/**
 * Run EDI analysis for the current message.
 * Detects both X12 and UN/EDIFACT formats.
 *
 * @param {object} params
 * @param {string} params.userMessage - The user's message text (may contain raw EDI)
 * @param {string} [params.messageFileId] - File uploaded with this message (future)
 * @returns {Promise<object|null>} Analysis result or null if no EDI data found
 */
export async function runEdifactAnalysis({ userMessage, messageFileId }) {
    const userContext = {};

    // Source 1a: X12 data pasted in user message (check first — ISA* pattern)
    const rawX12 = _extractX12FromText(userMessage);
    if (rawX12) {
        console.log('[EdifactAnalysisRunner] Detected raw X12 in userMessage');
        const fileInfo = {
            name: 'inline-message.x12',
            size: Buffer.byteLength(rawX12, 'utf8'),
            path: 'inline',
        };
        const analysis = buildX12Analysis(rawX12, fileInfo, userContext);
        console.log(`[EdifactAnalysisRunner] X12 analysis complete: ${analysis.segmentCount} segments, status: ${analysis.status}, duration: ${analysis.processing.totalDuration}ms`);
        return { analysis, rawEdifact: rawX12 };
    }

    // Source 1b: Raw EDIFACT data pasted in the user message
    const rawEdifact = _extractEdifactFromText(userMessage);
    if (rawEdifact) {
        console.log('[EdifactAnalysisRunner] Detected raw EDIFACT in userMessage');
        const fileInfo = {
            name: 'inline-message.edi',
            size: Buffer.byteLength(rawEdifact, 'utf8'),
            path: 'inline',
        };
        const analysis = buildAnalysis(rawEdifact, fileInfo, userContext);
        console.log(`[EdifactAnalysisRunner] Inline analysis complete: ${analysis.segmentCount} segments, status: ${analysis.status}, duration: ${analysis.processing.totalDuration}ms`);
        return { analysis, rawEdifact };
    }

    // Source 2: File uploaded with this message (future per-message file upload)
    if (messageFileId) {
        const fileResult = await _analyzeFile(messageFileId, userContext);
        if (fileResult) return fileResult;
    }

    return null;
}

/**
 * Analyze an EDIFACT file by its File document ID.
 * @param {string} fileId - MongoDB ObjectId of the File document
 * @param {object} userContext - User-provided context (subset, messageType, etc.)
 * @returns {Promise<object|null>} Analysis result or null
 * @private
 */
async function _analyzeFile(fileId, userContext) {
    const fileDoc = await fileRepo.findById(fileId);
    if (!fileDoc) {
        console.error(`[EdifactAnalysisRunner] File not found: ${fileId}`);
        return null;
    }

    if (!existsSync(fileDoc.path)) {
        console.error(`[EdifactAnalysisRunner] File not on disk: ${fileDoc.path}`);
        return null;
    }

    const rawContent = readFileSync(fileDoc.path, 'utf8');
    const fileInfo = {
        name: fileDoc.originalName || 'upload.edi',
        size: fileDoc.size || Buffer.byteLength(rawContent, 'utf8'),
        path: fileDoc.path,
    };

    const analysis = buildAnalysis(rawContent, fileInfo, userContext);
    console.log(`[EdifactAnalysisRunner] File analysis complete: ${analysis.segmentCount} segments, status: ${analysis.status}, duration: ${analysis.processing.totalDuration}ms`);
    return { analysis, rawEdifact: rawContent };
}
