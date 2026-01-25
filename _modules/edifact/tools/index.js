/**
 * EDIFACT Tools Registry & Export
 * ================================
 * Purpose: Central export point for all EDIFACT-specific agent tools.
 *
 * Exports:
 * - All tool implementations from segmentTools.js, validationTools.js, etc.
 * - Tool metadata (name, description, inputSchema, etc.)
 * - Tool factory (if needed)
 *
 * Usage:
 * import { segmentAnalyze, validateRules } from '_modules/edifact/tools';
 * 
 * // Or import all tools as object
 * import * as edifactTools from '_modules/edifact/tools';
 * 
 * // Register with Tool Registry
 * registry.register(edifactTools.tools, 'edifact');
 *
 * Tool Categories:
 * 1. Analysis tools: segmentAnalyze, parseSegmentField, compareSegments, groupSegmentsByType
 * 2. Validation tools: validateRules, checkCompliance, detectAnomalies, validateDataTypes, suggestFixes
 * 3. Utility tools: (future)
 *
 * Implementation Notes:
 * - Each tool exported with full metadata (name, description, inputSchema)
 * - All tools are deterministic (no side effects)
 * - Tools are sandboxed (no direct DB access)
 * - Tool arguments validated before execution
 */

export * from './segmentTools.js';
export * from './validationTools.js';

// Import all tools for convenient bundling
import * as segmentTools from './segmentTools.js';
import * as validationTools from './validationTools.js';

/**
 * All EDIFACT tools as object (for registry registration)
 */
export const tools = {
  // Analysis tools
  segmentAnalyze: segmentTools.segmentAnalyze,
  parseSegmentField: segmentTools.parseSegmentField,
  compareSegments: segmentTools.compareSegments,
  groupSegmentsByType: segmentTools.groupSegmentsByType,

  // Validation tools
  validateRules: validationTools.validateRules,
  checkCompliance: validationTools.checkCompliance,
  detectAnomalies: validationTools.detectAnomalies,
  validateDataTypes: validationTools.validateDataTypes,
  suggestFixes: validationTools.suggestFixes,
};

export default tools;
