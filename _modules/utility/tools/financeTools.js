/**
 * Utility Finance Tools
 * =====================
 * Generic finance helpers usable across domains.
 *
 * Tools:
 *  1. currencyConvert — Convert an amount between two ISO 4217 currencies using
 *                       ECB reference rates (via the free Frankfurter API). Supports
 *                       historical rates by date for invoice re-pricing scenarios.
 *
 * Design notes:
 *  - Frankfurter wraps the official ECB reference rate feed. No API key required.
 *    Endpoint: https://api.frankfurter.app/{date|latest}?from=X&to=Y&amount=N
 *  - All outbound HTTP is wrapped with AbortController so the agent never stalls.
 */

const HTTP_TIMEOUT_MS = 6000;
const FRANKFURTER_BASE = 'https://api.frankfurter.app';

/**
 * @private
 */
async function _fetchWithTimeout(url, timeoutMs = HTTP_TIMEOUT_MS) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Validate ISO 4217 currency code shape (3 uppercase letters).
 * Actual code validity is enforced by the Frankfurter API response.
 * @private
 */
function _isIsoCurrency(code) {
	return typeof code === 'string' && /^[A-Z]{3}$/.test(code);
}

/**
 * Validate ISO 8601 calendar date (YYYY-MM-DD).
 * @private
 */
function _isIsoDate(value) {
	if (typeof value !== 'string') return false;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = new Date(value + 'T00:00:00Z');
	return !Number.isNaN(d.getTime());
}

export const currencyConvert = {
	name: 'currencyConvert',
	description:
		'Convert an amount between two ISO 4217 currencies using official ECB reference rates. Supports historical dates (e.g., for re-pricing invoices on their original document date). Returns the converted amount and the exact rate used.',
	category: 'utility',
	module: 'utility',
	version: '1.0',
	inputSchema: {
		type: 'object',
		properties: {
			amount: {
				type: 'number',
				description: 'The amount to convert (must be a finite number, may be negative for credits).'
			},
			from: {
				type: 'string',
				description: 'Source currency as ISO 4217 code (e.g., "EUR", "USD", "JPY").'
			},
			to: {
				type: 'string',
				description: 'Target currency as ISO 4217 code (e.g., "EUR", "USD", "JPY").'
			},
			date: {
				type: 'string',
				description:
					'Optional reference date in YYYY-MM-DD format. If omitted, the latest published ECB rate is used. ECB only publishes business-day rates; weekends/holidays fall back to the previous trading day.'
			}
		},
		required: ['amount', 'from', 'to']
	},
	async execute(args /*, context */) {
		const { amount, from, to, date } = args;

		// --- Boundary validation (fail loud) ---
		if (typeof amount !== 'number' || !Number.isFinite(amount)) {
			return { success: false, error: 'Argument "amount" must be a finite number.' };
		}
		const fromCcy = typeof from === 'string' ? from.toUpperCase() : '';
		const toCcy = typeof to === 'string' ? to.toUpperCase() : '';

		if (!_isIsoCurrency(fromCcy)) {
			return { success: false, error: `Argument "from" must be a 3-letter ISO 4217 code, got "${from}".` };
		}
		if (!_isIsoCurrency(toCcy)) {
			return { success: false, error: `Argument "to" must be a 3-letter ISO 4217 code, got "${to}".` };
		}
		if (date && !_isIsoDate(date)) {
			return { success: false, error: `Argument "date" must be YYYY-MM-DD, got "${date}".` };
		}

		// Same currency → identity, no API call needed.
		if (fromCcy === toCcy) {
			return {
				success: true,
				amount,
				from: fromCcy,
				to: toCcy,
				rate: 1,
				converted: amount,
				date: date || new Date().toISOString().slice(0, 10),
				source: 'identity (same currency)'
			};
		}

		const datePath = date || 'latest';
		const url = `${FRANKFURTER_BASE}/${datePath}?amount=${encodeURIComponent(amount)}&from=${fromCcy}&to=${toCcy}`;

		try {
			const res = await _fetchWithTimeout(url);
			if (!res.ok) {
				const body = await res.text().catch(() => '');
				return {
					success: false,
					error: `Frankfurter (ECB) returned HTTP ${res.status}. ${body.slice(0, 200)}`
				};
			}

			const data = await res.json();
			const converted = data.rates?.[toCcy];

			if (typeof converted !== 'number') {
				return {
					success: false,
					error: `Conversion failed: API did not return a rate for ${toCcy}. Currency may be unsupported by ECB.`,
					raw: data
				};
			}

			// ECB publishes rates against EUR. Derive the effective rate the API used.
			const rate = amount !== 0 ? converted / amount : null;

			return {
				success: true,
				amount,
				from: fromCcy,
				to: toCcy,
				converted,
				rate,
				date: data.date || datePath,
				source: 'ECB reference rate via frankfurter.app',
				note: date && data.date && data.date !== date
					? `Requested date ${date} is not an ECB trading day; used rate from ${data.date} instead.`
					: undefined
			};
		} catch (err) {
			return {
				success: false,
				error: `Currency conversion failed: ${err.name === 'AbortError' ? 'request timed out' : err.message}`
			};
		}
	}
};

export default { currencyConvert };
