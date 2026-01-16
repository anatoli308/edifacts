/**
 * AI Configuration Index
 * ======================
 * Purpose: Central export point for all AI configuration.
 *
 * Exports:
 * - Agent configuration (temperature, timeouts, retry logic)
 * - Provider configuration (capabilities, fallback order, tiers)
 * - Utilities for accessing and validating config
 *
 * Usage:
 * import { AGENT_CONFIG, PROVIDERS_CONFIG } from 'lib/ai/config';
 * import { getProviderCapabilities, isProviderAllowedForTier } from 'lib/ai/config';
 */

export {
  AGENT_CONFIG,
  ROUTER_CONFIG,
  PLANNER_CONFIG,
  EXECUTOR_CONFIG,
  CRITIC_CONFIG,
  MEMORY_CONFIG,
  RECOVERY_CONFIG,
} from './agents.config.js';

export {
  PROVIDERS_CONFIG,
  OPENAI_CAPABILITIES,
  ANTHROPIC_CAPABILITIES,
  VLLM_CAPABILITIES,
  LOCAL_CAPABILITIES,
  getProviderCapabilities,
  getFallbackProvider,
  isProviderAllowedForTier,
} from './providers.config.js';

// Re-export all in one object for convenience
import { AGENT_CONFIG } from './agents.config.js';
import { PROVIDERS_CONFIG } from './providers.config.js';

export const AI_CONFIG = {
  agents: AGENT_CONFIG,
  providers: PROVIDERS_CONFIG,
};

export default AI_CONFIG;
