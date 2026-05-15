/**
 * Utility Tools Registry & Export
 * ===============================
 * Central export for all Utility (web) tools.
 */

export * from './webTools.js';
export * from './financeTools.js';

import * as webTools from './webTools.js';
import * as financeTools from './financeTools.js';

// Keep the import alive so the file is still tree-shaken cleanly and bundlers
// don't complain about an unused namespace. webSearch is intentionally not
// registered below — see note.
void webTools;

/**
 * All Utility tools as object (for registry registration).
 *
 * NOTE: `webSearch` is implemented in ./webTools.js (Tavily/Brave) but
 * intentionally NOT registered here. For EDIFACT-domain questions the
 * deterministic RAG tool (`searchEdifactKnowledge`) is strictly better:
 * cited, free, and aligned with the local corpus. Re-enable by adding
 *   webSearch: webTools.webSearch,
 * below if a real web-research need appears.
 */
export const tools = {
	currencyConvert: financeTools.currencyConvert
};

export default tools;

