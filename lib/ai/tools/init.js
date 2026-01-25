/**
 * Tool Registry Initialization
 * ============================
 * Purpose: Initialize and register all domain-specific tools at startup.
 *
 * This module:
 * - Imports all domain modules (EDIFACT, Twitter, ERP, etc.)
 * - Registers their tools with the central Tool Registry
 * - Validates all tool schemas
 * - Provides initialization status and diagnostics
 *
 * Usage:
 * // In server startup (server.js or api/agents/route.js)
 * import { initializeToolRegistry } from 'lib/ai/tools/init';
 * 
 * await initializeToolRegistry();
 * // Now all tools are available to Executor Agent
 *
 * Status:
 * - Call getToolRegistryStatus() to get diagnostic info
 * - Tools can only be called after successful initialization
 * - Errors during init are logged but don't crash the app (graceful degradation)
 *
 * Adding New Domains:
 * 1. Create _modules/{domain}/tools/index.js with `tools` export
 * 2. Add import + registry.register() call in initializeToolRegistry()
 * 3. Test with getToolRegistryStatus()
 */

import { registry } from './registry.js';

let isInitialized = false;
let initError = null;
const registeredModules = [];

/**
 * Initialize Tool Registry with all domain modules
 * Call this once at app startup
 */
export async function initializeToolRegistry() {
  if (isInitialized) {
    return {
      success: true,
      message: 'Tool registry already initialized',
      modules: registeredModules,
    };
  }

  try {
    // Register EDIFACT module tools
    try {
      const edifactModule = await import('../../../_modules/edifact/tools/index.js');
      if (edifactModule.tools) {
        registry.register(edifactModule.tools, 'edifact');
        registeredModules.push('edifact');
        console.log(`✓ Registered EDIFACT tools (${Object.keys(edifactModule.tools).length} tools)`);
      }
    } catch (err) {
      console.warn(`⚠ Failed to load EDIFACT tools:`, err.message);
      // Continue with other modules even if one fails
    }

    // Register Utility tools (Weather, WebSearch, etc.)
    try {
      const utilityTools = await import('./utilityTools.js');
      if (utilityTools.utilityTools) {
        registry.register(utilityTools.utilityTools, 'utility');
        registeredModules.push('utility');
        console.log(`✓ Registered Utility tools (${Object.keys(utilityTools.utilityTools).length} tools)`);
      }
    } catch (err) {
      console.warn(`⚠ Failed to load Utility tools:`, err.message);
    }

    // Future modules (Twitter, ERP, etc.) would be registered here
    // try {
    //   const twitterModule = await import('../../_modules/twitter/tools/index.js');
    //   if (twitterModule.tools) {
    //     registry.register(twitterModule.tools, 'twitter');
    //     registeredModules.push('twitter');
    //     console.log(`✓ Registered Twitter tools (${Object.keys(twitterModule.tools).length} tools)`);
    //   }
    // } catch (err) {
    //   console.warn(`⚠ Failed to load Twitter tools:`, err.message);
    // }

    isInitialized = true;

    const status = {
      success: true,
      message: `Tool registry initialized with ${registeredModules.length} module(s)`,
      modules: registeredModules,
      totalTools: registry.listTools().length,
    };

    console.log(`✓ Tool Registry initialized: ${status.totalTools} total tools available`);
    return status;
  } catch (err) {
    initError = err;
    const status = {
      success: false,
      message: `Failed to initialize tool registry: ${err.message}`,
      error: err,
      modules: registeredModules,
    };

    console.error(`✗ Tool Registry initialization failed:`, err);
    return status;
  }
}

/**
 * Get current Tool Registry status and diagnostics
 */
export function getToolRegistryStatus() {
  const allTools = registry.listTools();
  const toolsByModule = {};
  const toolsByCategory = {};

  for (const tool of allTools) {
    // Group by module
    if (!toolsByModule[tool.module]) {
      toolsByModule[tool.module] = [];
    }
    toolsByModule[tool.module].push(tool.name);

    // Group by category
    if (!toolsByCategory[tool.category]) {
      toolsByCategory[tool.category] = [];
    }
    toolsByCategory[tool.category].push(tool.name);
  }

  return {
    isInitialized,
    initError: initError ? initError.message : null,
    registeredModules,
    totalTools: allTools.length,
    toolsByModule,
    toolsByCategory,
    allTools,
  };
}

/**
 * Check if tool registry is ready
 */
export function isToolRegistryReady() {
  return isInitialized && !initError;
}

export default {
  initializeToolRegistry,
  getToolRegistryStatus,
  isToolRegistryReady,
};
