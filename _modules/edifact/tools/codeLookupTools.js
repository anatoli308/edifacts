/**
 * EDIFACT Code Lookup & Party Identification Tools
 * ================================================
 * Domain tools for resolving EDI codes and validating trading-party identifiers.
 *
 * Tools:
 *  1. lookupEdifactCode          — Resolve qualifier codes (DTM/RFF/NAD/BGM/Currency/Country) to human-readable meaning
 *  2. lookupCompanyByVATorGLN    — Resolve a VAT-ID (via VIES) or validate a GLN check digit (GS1 mod-10)
 *  3. validateAgainstGS1Profile  — Lightweight EANCOM / GS1 profile validation (required segments per message type)
 *
 * Design notes:
 *  - All tools are deterministic where possible (pure lookups) and fail-loud on input errors.
 *  - External HTTP calls (VIES, currency, etc.) are wrapped with a hard timeout (AbortController, 6s)
 *    so a stalling external service can never block the agent loop indefinitely.
 *  - No secrets required: VIES is public, GLN validation is local arithmetic, code lookups are static.
 */

import {
	DTM_QUALIFIERS,
	RFF_QUALIFIERS,
	NAD_QUALIFIERS
} from '../parser.js';

// ==================== CONSTANTS ====================

const HTTP_TIMEOUT_MS = 6000;

/**
 * BGM Document/Message type codes (UN/EDIFACT Code List 1001 — most common subset).
 * Source: UN/CEFACT Trade Data Element Directory.
 */
const BGM_DOCUMENT_TYPES = {
	'105': 'Purchase order',
	'220': 'Order',
	'221': 'Blanket order',
	'223': 'Hire order',
	'224': 'Spare parts order',
	'225': 'Campaign order',
	'226': 'Production order',
	'227': 'Service order',
	'241': 'Delivery instructions',
	'242': 'Despatch advice',
	'245': 'Delivery release',
	'248': 'Authorization for repair',
	'251': 'Inquiry',
	'270': 'Delivery note',
	'325': 'Proforma invoice',
	'326': 'Partial invoice',
	'380': 'Commercial invoice',
	'381': 'Credit note',
	'383': 'Debit note',
	'384': 'Corrected invoice',
	'385': 'Consolidated invoice',
	'386': 'Prepayment invoice',
	'389': 'Self-billed invoice',
	'393': 'Factored invoice',
	'394': 'Lease invoice',
	'395': 'Consignment invoice',
	'457': 'Order acknowledgement',
	'632': 'Receiving advice',
	'700': 'Customs declaration',
	'703': 'Booking confirmation',
	'750': 'Despatch order',
	'751': 'Inventory report'
};

/**
 * ISO 4217 currency code subset (UN/EDIFACT Code List 6345).
 * Limited to the most commonly used B2B currencies — broader resolution
 * is delegated to the `currencyConvert` tool which talks to ECB.
 */
const CURRENCY_CODES = {
	EUR: 'Euro',
	USD: 'US Dollar',
	GBP: 'Pound Sterling',
	CHF: 'Swiss Franc',
	JPY: 'Japanese Yen',
	CNY: 'Chinese Yuan Renminbi',
	SEK: 'Swedish Krona',
	NOK: 'Norwegian Krone',
	DKK: 'Danish Krone',
	PLN: 'Polish Zloty',
	CZK: 'Czech Koruna',
	HUF: 'Hungarian Forint',
	CAD: 'Canadian Dollar',
	AUD: 'Australian Dollar',
	TRY: 'Turkish Lira'
};

/**
 * ISO 3166-1 alpha-2 country codes (UN/EDIFACT Code List 3207, subset).
 */
const COUNTRY_CODES = {
	DE: 'Germany',
	AT: 'Austria',
	CH: 'Switzerland',
	FR: 'France',
	IT: 'Italy',
	ES: 'Spain',
	NL: 'Netherlands',
	BE: 'Belgium',
	LU: 'Luxembourg',
	GB: 'United Kingdom',
	IE: 'Ireland',
	DK: 'Denmark',
	SE: 'Sweden',
	NO: 'Norway',
	FI: 'Finland',
	PL: 'Poland',
	CZ: 'Czech Republic',
	SK: 'Slovakia',
	HU: 'Hungary',
	PT: 'Portugal',
	GR: 'Greece',
	US: 'United States',
	CA: 'Canada',
	JP: 'Japan',
	CN: 'China'
};

/**
 * Minimal EANCOM / GS1 message profiles — mandatory header/footer segments
 * and required-once business segments per message type.
 * Real-world EANCOM specs are far larger; this is a sanity floor that catches
 * 90 % of malformed messages without pretending to be a full conformance tool.
 */
const GS1_PROFILES = {
	INVOIC: {
		description: 'EANCOM Invoice',
		mandatory: ['UNH', 'BGM', 'DTM', 'NAD', 'CUX', 'LIN', 'MOA', 'UNS', 'UNT'],
		mandatoryParties: ['BY', 'SE'],
		notes: 'At minimum one BY (Buyer) and SE (Seller) NAD segment must be present. MOA must include grand total (qualifier 9 or 86).'
	},
	ORDERS: {
		description: 'EANCOM Purchase Order',
		mandatory: ['UNH', 'BGM', 'DTM', 'NAD', 'LIN', 'UNS', 'UNT'],
		mandatoryParties: ['BY', 'SU'],
		notes: 'Requires at least one buyer (BY) and supplier (SU) party.'
	},
	DESADV: {
		description: 'EANCOM Despatch Advice',
		mandatory: ['UNH', 'BGM', 'DTM', 'NAD', 'CPS', 'LIN', 'UNT'],
		mandatoryParties: ['SU', 'BY'],
		notes: 'CPS (Consignment Packing Sequence) is required for hierarchical packaging.'
	},
	ORDRSP: {
		description: 'EANCOM Order Response',
		mandatory: ['UNH', 'BGM', 'DTM', 'NAD', 'LIN', 'UNT'],
		mandatoryParties: ['BY', 'SU']
	},
	RECADV: {
		description: 'EANCOM Receiving Advice',
		mandatory: ['UNH', 'BGM', 'DTM', 'NAD', 'LIN', 'UNT'],
		mandatoryParties: ['SU', 'BY']
	}
};

// ==================== HELPERS ====================

/**
 * fetch wrapper with hard timeout — never let an external service stall the agent.
 * @private
 */
async function _fetchWithTimeout(url, options = {}, timeoutMs = HTTP_TIMEOUT_MS) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...options, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

/**
 * GS1 GLN check-digit validation (mod-10).
 * GLN = 13 digits, last digit is the check digit.
 * @private
 */
function _validateGLN(gln) {
	const digits = String(gln).replace(/\D/g, '');
	if (digits.length !== 13) {
		return { valid: false, reason: `GLN must be exactly 13 digits, got ${digits.length}` };
	}

	const body = digits.slice(0, 12);
	const expectedCheck = Number(digits[12]);

	let sum = 0;
	for (let i = 0; i < 12; i++) {
		const d = Number(body[i]);
		// Mod-10: positions from the right alternate weights 3 and 1.
		// For a 12-digit body the leftmost digit gets weight 3.
		sum += d * (i % 2 === 0 ? 3 : 1);
	}
	const calculatedCheck = (10 - (sum % 10)) % 10;
	const valid = calculatedCheck === expectedCheck;

	// GS1 company prefix country range (first 3 digits)
	const prefix = Number(digits.slice(0, 3));
	let countryHint = 'Unknown';
	if (prefix >= 400 && prefix <= 440) countryHint = 'Germany';
	else if (prefix >= 500 && prefix <= 509) countryHint = 'United Kingdom';
	else if (prefix >= 759 && prefix <= 759) countryHint = 'Venezuela';
	else if (prefix >= 760 && prefix <= 769) countryHint = 'Switzerland';
	else if (prefix >= 800 && prefix <= 839) countryHint = 'Italy';
	else if (prefix >= 840 && prefix <= 849) countryHint = 'Spain';
	else if (prefix >= 870 && prefix <= 879) countryHint = 'Netherlands';
	else if (prefix >= 900 && prefix <= 919) countryHint = 'Austria';

	return {
		valid,
		reason: valid ? 'Check digit OK' : `Invalid check digit (expected ${calculatedCheck}, got ${expectedCheck})`,
		gln: digits,
		companyPrefixCountry: countryHint
	};
}

/**
 * VIES VAT lookup (EU only) using the public REST endpoint.
 * Docs: https://ec.europa.eu/taxation_customs/vies/
 * @private
 */
async function _lookupVAT(countryCode, vatNumber) {
	const cc = String(countryCode).toUpperCase();
	const num = String(vatNumber).replace(/\s+/g, '');
	const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number`;

	const res = await _fetchWithTimeout(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ countryCode: cc, vatNumber: num })
	});

	if (!res.ok) {
		throw new Error(`VIES responded with HTTP ${res.status}`);
	}

	const data = await res.json();
	return {
		valid: data.valid === true,
		countryCode: data.countryCode || cc,
		vatNumber: data.vatNumber || num,
		name: data.name || null,
		address: data.address || null,
		requestDate: data.requestDate || new Date().toISOString()
	};
}

// ==================== TOOL: lookupEdifactCode ====================

export const lookupEdifactCode = {
	name: 'lookupEdifactCode',
	description:
		'Resolve an EDIFACT qualifier code to its human-readable meaning. Supports DTM, RFF, NAD, BGM (document type 1001), currency (ISO 4217 / 6345) and country (ISO 3166 / 3207) code lists.',
	category: 'lookup',
	module: 'edifact',
	version: '1.0',
	inputSchema: {
		type: 'object',
		properties: {
			code: {
				type: 'string',
				description: 'The code value to look up (e.g., "137", "BY", "EUR", "DE", "380")'
			},
			codeList: {
				type: 'string',
				enum: ['DTM', 'RFF', 'NAD', 'BGM', 'CURRENCY', 'COUNTRY', 'AUTO'],
				description: 'Which code list to search. Use "AUTO" to search all (default).',
				default: 'AUTO'
			}
		},
		required: ['code']
	},
	async execute(args /*, context */) {
		const { code, codeList = 'AUTO' } = args;

		if (!code || typeof code !== 'string') {
			return { success: false, error: 'Argument "code" must be a non-empty string.' };
		}

		const key = code.trim();
		const upperKey = key.toUpperCase();

		const lists = {
			DTM: { table: DTM_QUALIFIERS, lookupKey: key, label: 'Date/Time Qualifier' },
			RFF: { table: RFF_QUALIFIERS, lookupKey: upperKey, label: 'Reference Qualifier' },
			NAD: { table: NAD_QUALIFIERS, lookupKey: upperKey, label: 'Party Qualifier' },
			BGM: { table: BGM_DOCUMENT_TYPES, lookupKey: key, label: 'Document/Message Type (1001)' },
			CURRENCY: { table: CURRENCY_CODES, lookupKey: upperKey, label: 'Currency (ISO 4217)' },
			COUNTRY: { table: COUNTRY_CODES, lookupKey: upperKey, label: 'Country (ISO 3166-1 alpha-2)' }
		};

		const searchOrder = codeList === 'AUTO' ? Object.keys(lists) : [codeList];
		const matches = [];

		for (const listName of searchOrder) {
			const entry = lists[listName];
			if (!entry) continue;
			const meaning = entry.table[entry.lookupKey];
			if (meaning) {
				matches.push({ codeList: listName, label: entry.label, meaning });
			}
		}

		if (matches.length === 0) {
			return {
				success: true,
				code: key,
				found: false,
				message: `Code "${key}" not found in ${codeList === 'AUTO' ? 'any known' : codeList} code list.`,
				searchedLists: searchOrder
			};
		}

		return {
			success: true,
			code: key,
			found: true,
			matches,
			matchCount: matches.length
		};
	}
};

// ==================== TOOL: lookupCompanyByVATorGLN ====================

export const lookupCompanyByVATorGLN = {
	name: 'lookupCompanyByVATorGLN',
	description:
		'Resolve or validate a trading party identifier. For EU VAT IDs queries the official VIES service (returns company name + address if registered). For GS1 GLN performs local mod-10 check-digit validation and detects the country prefix.',
	category: 'lookup',
	module: 'edifact',
	version: '1.0',
	inputSchema: {
		type: 'object',
		properties: {
			identifier: {
				type: 'string',
				description: 'The identifier value (e.g., "DE123456789" or "4012345678901").'
			},
			type: {
				type: 'string',
				enum: ['VAT', 'GLN', 'AUTO'],
				description: 'Identifier type. "AUTO" detects based on format (default).',
				default: 'AUTO'
			}
		},
		required: ['identifier']
	},
	async execute(args /*, context */) {
		const { identifier, type = 'AUTO' } = args;

		if (!identifier || typeof identifier !== 'string') {
			return { success: false, error: 'Argument "identifier" must be a non-empty string.' };
		}

		const cleaned = identifier.trim().replace(/\s+/g, '');

		// Auto-detect: 13 digits → GLN, 2 letters + digits → VAT
		let resolvedType = type;
		if (type === 'AUTO') {
			if (/^\d{13}$/.test(cleaned)) resolvedType = 'GLN';
			else if (/^[A-Z]{2}[A-Z0-9]+$/i.test(cleaned)) resolvedType = 'VAT';
			else {
				return {
					success: false,
					error: `Could not auto-detect identifier type for "${cleaned}". Expected 13-digit GLN or 2-letter-country + VAT number.`
				};
			}
		}

		if (resolvedType === 'GLN') {
			const result = _validateGLN(cleaned);
			return {
				success: true,
				type: 'GLN',
				identifier: cleaned,
				...result,
				note: 'GLN lookup is limited to local check-digit validation. Full GS1 GEPIR resolution requires a paid GS1 membership API key and is not available here.'
			};
		}

		if (resolvedType === 'VAT') {
			const match = cleaned.match(/^([A-Z]{2})(.+)$/i);
			if (!match) {
				return {
					success: false,
					error: `VAT format invalid. Expected 2-letter country code followed by VAT number (e.g., "DE123456789"), got "${cleaned}".`
				};
			}
			const [, countryCode, vatNumber] = match;
			try {
				const vies = await _lookupVAT(countryCode, vatNumber);
				return {
					success: true,
					type: 'VAT',
					source: 'VIES (EU Commission)',
					...vies
				};
			} catch (err) {
				return {
					success: false,
					type: 'VAT',
					identifier: cleaned,
					error: `VIES lookup failed: ${err.message}`,
					hint: 'VIES is only available for EU member states and may be temporarily unavailable.'
				};
			}
		}

		return { success: false, error: `Unsupported identifier type: ${resolvedType}` };
	}
};

// ==================== TOOL: validateAgainstGS1Profile ====================

export const validateAgainstGS1Profile = {
	name: 'validateAgainstGS1Profile',
	description:
		'Lightweight EANCOM / GS1 profile compliance check. Verifies that an EDIFACT message contains the mandatory segments and party qualifiers required by the named profile (INVOIC, ORDERS, DESADV, ORDRSP, RECADV). Returns a list of missing segments and party roles.',
	category: 'validation',
	module: 'edifact',
	version: '1.0',
	inputSchema: {
		type: 'object',
		properties: {
			segments: {
				type: 'array',
				description:
					'Parsed segments from the EDIFACT message. Each entry should be either a string tag (e.g., "UNH", "NAD") or an object { tag, qualifier? }.',
				items: {
					oneOf: [
						{ type: 'string' },
						{
							type: 'object',
							properties: {
								tag: { type: 'string' },
								qualifier: { type: 'string' }
							},
							required: ['tag']
						}
					]
				}
			},
			profile: {
				type: 'string',
				enum: Object.keys(GS1_PROFILES),
				description: 'Which GS1/EANCOM profile to validate against.'
			}
		},
		required: ['segments', 'profile']
	},
	async execute(args /*, context */) {
		const { segments, profile } = args;
		const spec = GS1_PROFILES[profile];

		if (!spec) {
			return {
				success: false,
				error: `Unknown profile "${profile}". Available: ${Object.keys(GS1_PROFILES).join(', ')}`
			};
		}
		if (!Array.isArray(segments) || segments.length === 0) {
			return { success: false, error: 'Argument "segments" must be a non-empty array.' };
		}

		// Normalize segments → list of { tag, qualifier }
		const normalized = segments.map((s) =>
			typeof s === 'string' ? { tag: s.toUpperCase(), qualifier: null } : { tag: String(s.tag).toUpperCase(), qualifier: s.qualifier || null }
		);

		const presentTags = new Set(normalized.map((s) => s.tag));
		const presentPartyQualifiers = new Set(
			normalized.filter((s) => s.tag === 'NAD' && s.qualifier).map((s) => String(s.qualifier).toUpperCase())
		);

		const missingSegments = spec.mandatory.filter((tag) => !presentTags.has(tag));
		const missingParties = (spec.mandatoryParties || []).filter((q) => !presentPartyQualifiers.has(q));

		const compliant = missingSegments.length === 0 && missingParties.length === 0;

		return {
			success: true,
			profile,
			profileDescription: spec.description,
			compliant,
			missingSegments,
			missingParties,
			presentSegmentCount: presentTags.size,
			notes: spec.notes || null,
			recommendation: compliant
				? 'Message satisfies the minimum profile requirements. Note: this is a sanity check, not a full EANCOM conformance test.'
				: `Add the missing segments/parties before the message can be considered ${profile}-compliant.`
		};
	}
};

export default {
	lookupEdifactCode,
	lookupCompanyByVATorGLN,
	validateAgainstGS1Profile
};
