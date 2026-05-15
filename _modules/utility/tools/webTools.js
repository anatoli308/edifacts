/**
 * Utility Web Tools
 * =================
 * Real-world web search backed by Tavily (primary) or Brave Search (fallback).
 *
 * Why these two:
 *   - Tavily is the de-facto LLM-agent search provider (clean text snippets +
 *     optional `answer` summary, 1k req/month free, used as default in
 *     LangChain/LangGraph). https://docs.tavily.com
 *   - Brave Search API runs an independent index (not Google-derived) and is
 *     a robust fallback when Tavily is rate-limited or unreachable.
 *     https://api-dashboard.search.brave.com/app/documentation/web-search
 *
 * Configuration (env):
 *   WEBSEARCH_PROVIDER    "tavily" | "brave"   (default: auto — Tavily if key set, else Brave)
 *   TAVILY_API_KEY        Tavily key
 *   BRAVE_SEARCH_API_KEY  Brave key
 *
 * Fails loud with a structured error if no provider is configured — no mocks.
 */

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESULTS_CAP = 10;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const _pickProvider = () => {
	const forced = (process.env.WEBSEARCH_PROVIDER || '').toLowerCase().trim();
	if (forced === 'tavily' || forced === 'brave') return forced;
	if (process.env.TAVILY_API_KEY) return 'tavily';
	if (process.env.BRAVE_SEARCH_API_KEY) return 'brave';
	return null;
};

const _withTimeout = (promise, ms) =>
	Promise.race([
		promise,
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error(`Web search timed out after ${ms}ms`)), ms),
		),
	]);

/**
 * Tavily — single REST call. Returns ranked results with cleaned content
 * snippets ready to feed back to the LLM.
 * https://docs.tavily.com/docs/rest-api/api-reference
 */
const _searchTavily = async ({ query, maxResults, language }) => {
	const apiKey = process.env.TAVILY_API_KEY;
	if (!apiKey) throw new Error('TAVILY_API_KEY is not set');

	const body = {
		api_key: apiKey,
		query,
		max_results: Math.min(maxResults, MAX_RESULTS_CAP),
		search_depth: 'basic',
		include_answer: true,
		include_raw_content: false,
		include_images: false,
	};

	const res = await _withTimeout(
		fetch(TAVILY_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}),
		DEFAULT_TIMEOUT_MS,
	);

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`Tavily error ${res.status}: ${text.slice(0, 300)}`);
	}

	const data = await res.json();
	const results = (data.results || []).map((r) => ({
		title: r.title,
		url: r.url,
		snippet: r.content,
		score: r.score,
		publishedDate: r.published_date || null,
	}));

	return {
		provider: 'tavily',
		answer: data.answer || null,
		results,
		requestedLanguage: language,
	};
};

/**
 * Brave Search — GET with key header.
 * https://api-dashboard.search.brave.com/app/documentation/web-search
 */
const _searchBrave = async ({ query, maxResults, language }) => {
	const apiKey = process.env.BRAVE_SEARCH_API_KEY;
	if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY is not set');

	const params = new URLSearchParams({
		q: query,
		count: String(Math.min(maxResults, MAX_RESULTS_CAP)),
		safesearch: 'moderate',
	});
	if (language) params.set('search_lang', language);

	const res = await _withTimeout(
		fetch(`${BRAVE_ENDPOINT}?${params.toString()}`, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Accept-Encoding': 'gzip',
				'X-Subscription-Token': apiKey,
			},
		}),
		DEFAULT_TIMEOUT_MS,
	);

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`Brave error ${res.status}: ${text.slice(0, 300)}`);
	}

	const data = await res.json();
	const items = data?.web?.results || [];
	const results = items.map((r) => ({
		title: r.title,
		url: r.url,
		snippet: r.description,
		score: null,
		publishedDate: r.age || null,
	}));

	return {
		provider: 'brave',
		answer: null,
		results,
		requestedLanguage: language,
	};
};

// ---------------------------------------------------------------------------
// Public tool
// ---------------------------------------------------------------------------

/**
 * webSearch: real web search via Tavily or Brave.
 * Includes a per-context guard against runaway re-searching of the same query.
 */
export const webSearch = {
	name: 'webSearch',
	description:
		'Search the public web for current information. Backed by an industry-standard search API (Tavily / Brave). Returns ranked results with title, URL, and snippet. Tavily additionally returns a short `answer` summary when available. Use this for questions about news, recent events, library/spec versions, or any fact that may have changed since the model was trained. Do NOT use for EDIFACT code lookups — prefer `searchEdifactKnowledge` for that.',
	category: 'utility',
	module: 'utility',
	version: '2.0',
	inputSchema: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description:
					'Search query in natural language (e.g. "current UN/EDIFACT directory version 2024", "EANCOM INVOIC 2002 changes").',
			},
			maxResults: {
				type: 'number',
				description: `Maximum number of results to return (1-${MAX_RESULTS_CAP}, default 5).`,
				default: 5,
			},
			language: {
				type: 'string',
				description: 'ISO language code for result preference (e.g. "en", "de", "fr"). Default "en".',
				default: 'en',
			},
		},
		required: ['query'],
	},

	async execute(args, context = {}) {
		const { query, maxResults = 5, language = 'en' } = args || {};

		if (typeof query !== 'string' || query.trim().length === 0) {
			return { success: false, error: 'query must be a non-empty string' };
		}

		// Anti-loop: prevent the agent from re-searching the same query repeatedly
		const searchKey = query.toLowerCase().trim().slice(0, 64);
		context._searchCount = context._searchCount || {};
		context._searchCount[searchKey] = (context._searchCount[searchKey] || 0) + 1;
		if (context._searchCount[searchKey] > 2) {
			return {
				success: false,
				error: `Already searched "${query}" ${context._searchCount[searchKey]} times — use the previous results instead of re-querying.`,
				hint: 'Analyse prior tool output and answer the user.',
			};
		}

		const provider = _pickProvider();
		if (!provider) {
			return {
				success: false,
				error:
					'No web search provider configured. Set TAVILY_API_KEY (preferred) or BRAVE_SEARCH_API_KEY in the environment.',
				hint: 'Get a free Tavily key at https://tavily.com — 1000 free searches per month.',
			};
		}

		const cappedMax = Math.max(1, Math.min(Number(maxResults) || 5, MAX_RESULTS_CAP));

		try {
			const payload =
				provider === 'tavily'
					? await _searchTavily({ query, maxResults: cappedMax, language })
					: await _searchBrave({ query, maxResults: cappedMax, language });

			return {
				success: true,
				provider: payload.provider,
				query,
				language: payload.requestedLanguage,
				answer: payload.answer,
				resultCount: payload.results.length,
				results: payload.results,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			return {
				success: false,
				provider,
				error: `Web search failed: ${error?.message || String(error)}`,
			};
		}
	},
};

export default { webSearch };

