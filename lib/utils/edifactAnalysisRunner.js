/**
 * EDIFACT Analysis Runner
 * =======================
 * Runs the deterministic EDIFACT analysis per message.
 *
 * Analysis sources (checked in order):
 * 1. Raw EDIFACT data in the userMessage (pasted by user)
 * 2. File uploaded with this message (future: per-message file upload)
 *
 * Designed to run in the agent handler flow (not in a worker thread)
 * so the result is immediately available for the agent pipeline.
 */
import { readFileSync, existsSync } from 'fs';
import { buildAnalysis } from '../../_workers/edifactAnalysisBuilder.js';
import File from '../../models/shared/File.js';

/**
 * Common EDIFACT segment tags used to detect raw EDIFACT in text.
 * @private
 */
const EDIFACT_INDICATORS = ['UNA', 'UNB', 'UNH', 'BGM', 'DTM', 'NAD', 'LIN', 'UNT', 'UNZ'];

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
 * Run EDIFACT analysis for the current message.
 *
 * @param {object} params
 * @param {string} params.userMessage - The user's message text (may contain raw EDIFACT)
 * @param {string} [params.messageFileId] - File uploaded with this message (future)
 * @returns {Promise<object|null>} Analysis result or null if no EDIFACT data found
 */
export async function runEdifactAnalysis({ userMessage, messageFileId }) {
    const userContext = {};

    // Source 1: Raw EDIFACT data pasted in the user message
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
    const fileDoc = await File.findById(fileId).lean();
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
