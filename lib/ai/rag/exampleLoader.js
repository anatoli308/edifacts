/**
 * EDI Example Corpus Loader
 * =========================
 * Walks the on-disk `edi_files/` folder and emits one RAG chunk per
 * example message file. Format-agnostic: works for EDIFACT, EANCOM, X12,
 * HIPAA, HL7, NCPDP, SCRIPT, VDA, DEX, EDIGAS and anything else dropped
 * into a top-level subfolder later.
 *
 * Design:
 *   - 1 chunk per file (KISS — can be split into segment-level chunks later).
 *   - Format inferred from parent folder name.
 *   - MessageType detected best-effort from the first relevant segment
 *     (UNH for EDIFACT, ST for X12, MSH for HL7).
 *   - Filenames containing "Corrupt", "Duplicate" or "Mixed" are tagged
 *     accordingly so negative examples are retrievable too.
 *   - Stable conflict key: `code = relative path` → idempotent re-ingest.
 *
 * Output shape matches `lib/ai/rag/writer.upsertChunks`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SOURCE = 'EDI_EXAMPLE';
const ACCEPTED_EXTENSIONS = new Set(['.txt', '.edi']);
const MAX_BYTES = 64 * 1024; // 64 KB — any single example bigger than that gets truncated

// edi_files/ lives at the repo root, two levels up from this file
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(__filename, '..', '..', '..', '..');
const DEFAULT_ROOT = join(REPO_ROOT, 'edi_files');

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Recursively walk a directory and yield absolute file paths matching
 * the accepted extensions.
 */
const _walk = function* (dir) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            yield* _walk(full);
        } else if (entry.isFile() && ACCEPTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
            yield full;
        }
    }
};

/**
 * Detect message type from the first informative segment. Returns null
 * if nothing recognisable is found — caller falls back to "unknown".
 */
const _detectMessageType = (raw, format) => {
    // EDIFACT / EANCOM: UNH+1+INVOIC:D:96A:UN:EAN008'
    if (format === 'EDIFACT' || format === 'EANCOM' || format === 'EDIGAS' || format === 'VDA') {
        const m = raw.match(/UNH\+[^+]+\+([A-Z0-9]+):/);
        if (m) return m[1];
    }
    // X12 / HIPAA / DEX: ST*850*0001 or ST*837*...
    if (format === 'X12' || format === 'HIPAA' || format === 'DEX') {
        const m = raw.match(/\bST\*(\d{3})\*/);
        if (m) return m[1];
    }
    // HL7: MSH|^~\&|...|...|...|...|...|ADT^A01|
    if (format === 'HL7') {
        const m = raw.match(/MSH\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|([A-Z0-9]+(\^[A-Z0-9]+)?)/);
        if (m) return m[1];
    }
    // NCPDP / SCRIPT: UIH+SCRIPT:010:001:NEWRX' or similar
    if (format === 'NCPDP' || format === 'SCRIPT') {
        const m = raw.match(/UIH\+[^:]+:\d+:\d+:([A-Z]+)/);
        if (m) return m[1];
    }
    return null;
};

/**
 * Best-effort segment count. Splits on common EDI terminators.
 * Not exact for all formats — just a useful relative size signal.
 */
const _countSegments = (raw) => {
    // EDIFACT/EANCOM use ' as segment terminator; X12 uses ~; HL7 uses \r or \n
    const candidates = [
        (raw.match(/'/g) || []).length,
        (raw.match(/~/g) || []).length,
        raw.split(/\r?\n/).filter((l) => l.trim().length > 0).length,
    ];
    return Math.max(...candidates);
};

/**
 * Filename-based tagging — corrupt/duplicate/mixed are deliberately kept
 * in the corpus so the agent can also retrieve "what a broken X looks like".
 */
const _classifyFromName = (name) => {
    const lower = name.toLowerCase();
    return {
        isCorrupt: lower.includes('corrupt'),
        isDuplicate: lower.includes('duplicate'),
        isMixed: lower.includes('mixed'),
        isInvalid: lower.includes('invalid'),
    };
};

const _truncate = (text, max) =>
    text.length <= max ? text : `${text.slice(0, max)}\n\n[...truncated, original ${text.length} bytes]`;

const _buildChunk = (absPath, root) => {
    const stat = statSync(absPath);
    if (stat.size === 0) return null;

    const raw = readFileSync(absPath, 'utf-8');
    const rel = relative(root, absPath).split(sep).join('/');
    const parts = rel.split('/');
    const format = parts.length > 1 ? parts[0].toUpperCase() : 'UNKNOWN';
    const fileName = basename(absPath);
    const messageType = _detectMessageType(raw, format) || 'unknown';
    const segmentCount = _countSegments(raw);
    const tags = _classifyFromName(fileName);

    const titlePrefix = [format, messageType !== 'unknown' ? messageType : null]
        .filter(Boolean)
        .join(' ');

    const flagTokens = Object.entries(tags)
        .filter(([, v]) => v)
        .map(([k]) => k.replace(/^is/, '').toLowerCase());
    const flagSuffix = flagTokens.length > 0 ? ` [${flagTokens.join(', ')}]` : '';

    const header = `Real-world ${format} example file "${fileName}"${
        messageType !== 'unknown' ? ` carrying a ${messageType} message` : ''
    }${flagSuffix}. Source path: ${rel}. Segment count: ${segmentCount}.`;

    const content = `${header}\n\n---\n\n${_truncate(raw, MAX_BYTES)}`;

    return {
        source: SOURCE,
        category: format,
        code: rel,
        title: `${titlePrefix} example — ${fileName}${flagSuffix}`,
        content,
        metadata: {
            format,
            messageType,
            fileName,
            relPath: rel,
            byteSize: stat.size,
            segmentCount,
            ...tags,
        },
    };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the full example-file chunk corpus.
 *
 * @param {string} [root] absolute path to the examples folder
 *   (defaults to `<repo>/edi_files`).
 * @returns {Array<{source:string,category:string,code:string,title:string,content:string,metadata:object}>}
 */
export const getAllExampleChunks = (root = DEFAULT_ROOT) => {
    const chunks = [];
    for (const abs of _walk(root)) {
        const chunk = _buildChunk(abs, root);
        if (chunk) chunks.push(chunk);
    }
    return chunks;
};

export const EXAMPLE_SOURCE = SOURCE;
