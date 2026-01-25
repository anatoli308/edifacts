/**
 * Tool Registry & Export
 * ======================
 * Purpose: Central export point for all tool-related utilities.
 *
 * Exports:
 * - registry: ToolRegistry instance (singleton)
 * - Universal tool types and interfaces
 * - Tool utilities and helpers
 *
 * Usage:
 * import { registry } from 'lib/ai/tools';
 * import edifactTools from '_modules/edifact/tools';
 * 
 * // Register EDIFACT tools at startup
 * registry.register(edifactTools, 'edifact');
 * 
 * // Use in Executor
 * const tool = registry.getTool('segmentAnalyze');
 * const result = await tool.execute(args, context);
 */

export { registry, default } from './registry.js';
export { initializeToolRegistry, getToolRegistryStatus, isToolRegistryReady } from './init.js';
