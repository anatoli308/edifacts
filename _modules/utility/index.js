/**
 * Utility Module Entry Point
 * ==========================
 * Purpose: Central registry and interface for all utility tools.
 *
 * Current Status:
 * - Not actively used yet; tools are imported directly from tools/index.js
 * - This file serves as a future aggregator when the module grows
 *
 * Future Exports (when needed):
 * - tools: { webSearch, currencyConvert, ... }
 * - Additional utility categories as they're added
 *
 * Usage (future):
 * import utilityModule from '_modules/utility';
 * 
 * // Use utility tools in Executor
 * const hits = await utilityModule.tools.webSearch({ query: 'EDIFACT D24A directory' });
 *
 * Module Structure:
 * utility/
 *   ├── index.js (this file - aggregator)
 *   └── tools/
 *       ├── webTools.js (webSearch)
 *       ├── financeTools.js (currencyConvert)
 *       └── index.js (export all tools)
 *
 * Implementation Notes:
 * - Tools are directly registered via tools/index.js in lib/ai/tools/init.js
 * - Keep this file for consistency with other modules (edifact, future twitter/erp)
 * - When adding validators or context builders, export them here
 */

// Uncomment when you want to expose a module-level API:
// export { tools } from './tools/index.js';
// export default { tools };