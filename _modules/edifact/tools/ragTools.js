/**
 * RAG-backed knowledge search tool
 * =================================
 * Exposes the EDIFACT knowledge base (pgvector-indexed) to agents as a single
 * `searchEdifactKnowledge` tool.
 *
 * When to use:
 *   - Vague natural-language questions: "what qualifier should I use for tax point date?"
 *   - Exploring unfamiliar message types: "what is RECADV used for?"
 *   - Looking up a code when you're not sure which list it belongs to.
 *
 * When NOT to use:
 *   - You already know the code list AND the exact code → use `lookupEdifactCode`
 *     (deterministic, faster, no embedding round-trip).
 *   - You need to validate a party identifier → use `lookupCompanyByVATorGLN`.
 *
 * The tool returns up to `topK` chunks with similarity scores. Higher similarity
 * (closer to 1.0) means a better semantic match.
 */

import { hybridSearch } from '../../../lib/ai/rag/index.js';

const VALID_SOURCES = ['EDIFACT_CODE_LIST', 'GS1_PROFILE', 'EDIFACT_CONCEPT', 'EDI_EXAMPLE'];
const VALID_CATEGORIES = [
    // Code-list categories
    'DTM_QUALIFIER',
    'RFF_QUALIFIER',
    'NAD_QUALIFIER',
    'BGM_DOCUMENT_TYPE',
    'CURRENCY',
    'COUNTRY',
    'GS1_MESSAGE_PROFILE',
    'EDIFACT_CONCEPT',
    // Real-world example categories (one per format, mirrors the edi_files/ folder layout)
    'EDIFACT',
    'EANCOM',
    'X12',
    'HIPAA',
    'HL7',
    'NCPDP',
    'SCRIPT',
    'VDA',
    'DEX',
    'EDIGAS',
];

export const searchEdifactKnowledge = {
    name: 'searchEdifactKnowledge',
    description:
        'Semantic search over the EDIFACT knowledge base: code lists (DTM/RFF/NAD/BGM qualifiers, currency, country), GS1/EANCOM profiles, EDIFACT concepts, and real example files (source=EDI_EXAMPLE; formats: EDIFACT, EANCOM, X12, HIPAA, HL7, NCPDP, SCRIPT, VDA, DEX, EDIGAS). MUST be called for any "show me an example/real sample/aus dem Corpus" request — never invent payloads. Use the literal format the user named (EANCOM ≠ EDIFACT). For exact code lookup prefer `lookupEdifactCode`.',
    category: 'lookup',
    module: 'edifact',
    version: '1.0',
    inputSchema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Natural-language description of what you are looking for (e.g. "qualifier for tax point date", "what is the difference between despatch and delivery dates", "how is the invoice currency declared").',
            },
            code: {
                type: 'string',
                description: 'Optional: an exact code to look up first. If provided and matched, exact results are returned and semantic search is skipped.',
            },
            source: {
                type: 'string',
                enum: VALID_SOURCES,
                description: 'Optional pre-filter for the document source. Use `EDI_EXAMPLE` to restrict results to real-world example files; use `EDIFACT_CODE_LIST` for qualifier definitions; use `GS1_PROFILE` for message-structure profiles.',
            },
            category: {
                type: 'string',
                enum: VALID_CATEGORIES,
                description: 'Optional pre-filter for the chunk category. For code-list lookups use values like `DTM_QUALIFIER`. For real-world examples use the EXACT format name from the user\'s question: EANCOM → `EANCOM`, EDIFACT → `EDIFACT`, X12 → `X12`. These are SEPARATE corpora — EANCOM files are NOT in the EDIFACT category. When in doubt, omit this field instead of guessing.',
            },
            topK: {
                type: 'integer',
                minimum: 1,
                maximum: 25,
                default: 5,
                description: 'How many results to return for semantic search (ignored in exact-match mode).',
            },
        },
    },
    async execute(args /*, context */) {
        const { query, code, source, category, topK = 5 } = args ?? {};

        if (!query && !code) {
            return {
                success: false,
                error: 'Either "query" or "code" must be provided.',
            };
        }

        if (source && !VALID_SOURCES.includes(source)) {
            return { success: false, error: `Invalid source "${source}".` };
        }

        if (category && !VALID_CATEGORIES.includes(category)) {
            return { success: false, error: `Invalid category "${category}".` };
        }

        try {
            const { mode, results } = await hybridSearch({
                query: typeof query === 'string' ? query.trim() : undefined,
                code: typeof code === 'string' ? code.trim() : undefined,
                source,
                category,
                topK,
            });

            return {
                success: true,
                mode,
                resultCount: results.length,
                results: results.map((r) => ({
                    source: r.source,
                    category: r.category,
                    code: r.code,
                    title: r.title,
                    content: r.content,
                    metadata: r.metadata,
                    similarity: r.similarity,
                })),
            };
        } catch (err) {
            return {
                success: false,
                error: `Knowledge search failed: ${err?.message || String(err)}`,
            };
        }
    },
};
