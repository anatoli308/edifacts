/**
 * Utility Tools Registry & Export
 * ===============================
 * Central export for all Utility (web) tools.
 */

export * from './webTools.js';

import * as webTools from './webTools.js';

/**
 * All Utility tools as object (for registry registration)
 */
export const tools = {
	getWeather: webTools.getWeather,
	webSearch: webTools.webSearch
};

export default tools;

