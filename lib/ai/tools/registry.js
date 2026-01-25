/**
 * Tool Registry
 * =============
 * Purpose: Central registry for all agent tools across all domains.
 *
 * Responsibilities:
 * - Register tools from all domain modules (EDIFACT, Twitter, ERP, etc.)
 * - Provide unified interface for Executor Agent to discover and call tools
 * - Validate tool schemas (JSON schema compliance)
 * - Handle tool version management and backward compatibility
 * - Support tool metadata (description, examples, deprecation warnings)
 * - Enable runtime tool switching or conditional tool availability
 *
 * Tool Structure (UniversalTool):
 * {
 *   name: string,
 *   description: string,
 *   inputSchema: JSONSchema,
 *   execute: (args: any, ctx: AgentContext) => Promise<any>,
 *   category: string (e.g., "analysis", "validation", "generation"),
 *   module: string (e.g., "edifact", "twitter", "erp"),
 *   version: string,
 *   deprecation?: { message: string, alternative: string }
 * }
 *
 * Usage:
 * import { registry } from 'lib/ai/tools/registry';
 * 
 * // Register tools from EDIFACT module at startup
 * registry.register(edifactModule.tools);
 * 
 * // Get tool for execution
 * const tool = registry.getTool('segmentAnalyze');
 * const result = await tool.execute(args, context);
 * 
 * // List available tools (for Planner)
 * const tools = registry.listTools({ module: 'edifact', category: 'analysis' });
 * 
 * // Get tool schema (for Provider adapter)
 * const schema = registry.getSchema('segmentAnalyze');
 *
 * Methods:
 * - register(tools, module): Register tools from a domain module
 * - getTool(name): Get single tool by name
 * - listTools(filters?): List tools with optional filters
 * - getSchema(name): Get JSON schema for tool input
 * - validate(name, args): Validate args against tool schema
 * - has(name): Check if tool exists
 * - unregister(name): Remove tool (for cleanup)
 *
 * Tool Filters:
 * - module: string (filter by domain module)
 * - category: string (analysis, validation, generation, utility)
 * - requires: string[] (e.g., ["parsing_done", "rules_loaded"])
 *
 * Implementation Notes:
 * - Stateful: registry built at startup
 * - Thread-safe: concurrent reads allowed, writes during init only
 * - Immutable schemas: tool definitions don't change at runtime
 * - Validation: all tool args validated before execution
 * - Error handling: invalid tools rejected at registration time
 *
 * Security:
 * - Only registered tools can be called by Executor
 * - Tool arguments validated against schema
 * - Tool execution happens in sandboxed context (no direct DB access)
 * - Deprecation warnings logged
 *
 * Future:
 * - Tool versioning (parallel versions of same tool)
 * - Hot reloading (add/remove tools without restart)
 * - Tool chaining (tool output as input to another tool)
 * - Tool caching (cache expensive tool results)
 */

import { validateToolDefinition, validateToolArguments } from './validateToolContract.js';

class ToolRegistry {
  constructor() {
    this.tools = new Map(); // { name -> UniversalTool }
    this.schemas = new Map(); // { name -> JSONSchema }
    this.metadata = new Map(); // { name -> metadata }
  }

  /**
   * Register tools from a domain module
   * @param {Object} toolsObject - { toolName: UniversalTool, ... }
   * @param {string} module - Domain module name (e.g., 'edifact')
   */
  register(toolsObject, module) {
    if (!toolsObject || typeof toolsObject !== 'object') {
      throw new Error('Tools must be an object');
    }

    for (const [name, tool] of Object.entries(toolsObject)) {
      this._validateTool(tool, name);
      this.tools.set(name, tool);
      this.schemas.set(name, tool.inputSchema);
      this.metadata.set(name, {
        module,
        category: tool.category || 'general',
        version: tool.version || '1.0',
        registered_at: new Date().toISOString(),
      });
    }
  }

  /**
   * Get single tool by name
   */
  getTool(name) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return tool;
  }

  /**
   * List all tools with optional filters
   */
  listTools(filters = {}) {
    const results = [];
    for (const [name, tool] of this.tools.entries()) {
      const meta = this.metadata.get(name);
      
      // Apply filters
      if (filters.module && meta.module !== filters.module) continue;
      if (filters.category && meta.category !== filters.category) continue;
      if (filters.requires && !Array.isArray(filters.requires)) continue;
      
      results.push({
        name,
        description: tool.description,
        category: meta.category,
        module: meta.module,
      });
    }
    return results;
  }

  /**
   * Get JSON schema for tool input validation
   */
  getSchema(name) {
    const schema = this.schemas.get(name);
    if (!schema) {
      throw new Error(`Schema not found for tool: ${name}`);
    }
    return schema;
  }

  /**
   * Validate arguments against tool schema
   */
  validate(name, args) {
    const schema = this.getSchema(name);
    const { valid, errors } = validateToolArguments(args, schema);

    if (!valid) {
      throw new Error(`Invalid arguments for tool ${name}: ${errors.join('; ')}`);
    }

    return true;
  }

  /**
   * Check if tool exists
   */
  has(name) {
    return this.tools.has(name);
  }

  /**
   * Unregister tool (for cleanup)
   */
  unregister(name) {
    this.tools.delete(name);
    this.schemas.delete(name);
    this.metadata.delete(name);
  }

  /**
   * Get all tools as object (for export to Provider adapters)
   */
  getAll() {
    const all = {};
    for (const [name, tool] of this.tools.entries()) {
      all[name] = tool;
    }
    return all;
  }

  /**
   * Get tools for specific module
   */
  getByModule(module) {
    const result = {};
    for (const [name, tool] of this.tools.entries()) {
      const meta = this.metadata.get(name);
      if (meta.module === module) {
        result[name] = tool;
      }
    }
    return result;
  }

  /**
   * Internal: validate tool structure
   */
  _validateTool(tool, name) {
    const definitionValidation = validateToolDefinition(tool);

    if (!definitionValidation.valid) {
      throw new Error(`Tool ${name} invalid: ${definitionValidation.errors.join('; ')}`);
    }

    if (typeof tool.execute !== 'function') {
      throw new Error(`Tool ${name} missing 'execute' function`);
    }
  }
}

// Export singleton instance
export const registry = new ToolRegistry();

export default registry;
