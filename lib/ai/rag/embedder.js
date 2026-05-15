/**
 * Ollama Embedder
 * ===============
 * Thin client around Ollama's native `/api/embed` endpoint.
 *
 * Why native, not OpenAI-compat /v1/embeddings:
 * - /api/embed accepts both single string and batch array natively
 * - Returns normalized payload `{ embeddings: number[][] }`
 * - No SDK overhead for a single HTTP call
 *
 * Configuration:
 *   OLLAMA_BASE_URL — full Ollama base (default: strip `/v1` from SYSTEM_BASE_URL,
 *                     fallback http://localhost:11434)
 *   RAG_EMBED_MODEL — embedding model name (default: 'nomic-embed-text', 768 dim)
 *
 * Public API:
 *   embed(text)           → number[]      single embedding
 *   embedBatch(texts)     → number[][]    one HTTP call per chunk of `BATCH_SIZE`
 *   getEmbeddingDim()     → number        configured dimensionality (768)
 */

const DEFAULT_MODEL = 'nomic-embed-text';
const DEFAULT_DIM = 768;
const BATCH_SIZE = 32;
const REQUEST_TIMEOUT_MS = 30_000;

const _resolveBaseUrl = () => {
    const raw = process.env.OLLAMA_BASE_URL
        || process.env.SYSTEM_BASE_URL
        || 'http://localhost:11434/v1';
    return raw.replace(/\/v1\/?$/, '').replace(/\/$/, '');
};

const _model = () => process.env.RAG_EMBED_MODEL || DEFAULT_MODEL;

const _post = async (path, body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const res = await fetch(`${_resolveBaseUrl()}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Ollama ${path} failed: ${res.status} ${res.statusText} — ${text}`);
        }

        return await res.json();
    } finally {
        clearTimeout(timer);
    }
};

export const embed = async (text) => {
    if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('embed: text must be a non-empty string');
    }
    const data = await _post('/api/embed', { model: _model(), input: text });
    const vec = data?.embeddings?.[0];
    if (!Array.isArray(vec)) {
        throw new Error('Ollama returned no embedding vector');
    }
    return vec;
};

export const embedBatch = async (texts) => {
    if (!Array.isArray(texts) || texts.length === 0) {
        return [];
    }

    const out = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const chunk = texts.slice(i, i + BATCH_SIZE);
        const data = await _post('/api/embed', { model: _model(), input: chunk });
        const vecs = data?.embeddings;
        if (!Array.isArray(vecs) || vecs.length !== chunk.length) {
            throw new Error(
                `Ollama embed batch returned ${vecs?.length ?? 0} vectors for ${chunk.length} inputs`
            );
        }
        out.push(...vecs);
    }
    return out;
};

export const getEmbeddingDim = () => DEFAULT_DIM;
