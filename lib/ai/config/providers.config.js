/**
 * Provider Configuration
 * =====================
 * Purpose: Centralized configuration for LLM providers.
 *
 * Responsibilities:
 * - Define provider capabilities
 * - Provider fallback order
 * - Rate limits and quotas
 * - Model-specific parameters
 *
 * Usage:
 * import { PROVIDERS_CONFIG, getProviderCapabilities } from 'lib/ai/config';
 * 
 * const caps = getProviderCapabilities('openai');
 * const fallback = PROVIDERS_CONFIG.fallback_order;
 */

/**
 * OpenAI Provider Capabilities
 */
export const OPENAI_CAPABILITIES = {
  provider: 'openai',
  parallel_tool_calls: true,
  streaming: true,
  vision: true,
  max_context_window: 128000, // GPT-4 Turbo
  supported_models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  default_model: 'gpt-4',
  rate_limits: {
    requests_per_minute: 3500, // Tier 1
    tokens_per_minute: 90000,
  },
};

/**
 * Anthropic Provider Capabilities
 */
export const ANTHROPIC_CAPABILITIES = {
  provider: 'anthropic',
  parallel_tool_calls: false, // Sequential only
  streaming: true,
  vision: true,
  max_context_window: 200000, // Claude 3
  supported_models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  default_model: 'claude-3-sonnet',
  rate_limits: {
    requests_per_minute: 1000,
    tokens_per_minute: 100000,
  },
};

/**
 * vLLM Provider Capabilities (self-hosted)
 */
export const VLLM_CAPABILITIES = {
  provider: 'vllm',
  parallel_tool_calls: true,
  streaming: true,
  vision: false,
  max_context_window: 32000, // Configurable, defaults to 32k
  supported_models: ['mistral-7b', 'llama2-70b', 'openchat-3.5'], // Examples
  default_model: 'mistral-7b',
  rate_limits: {
    requests_per_minute: 1000, // Depends on hardware
    tokens_per_minute: 500000, // Depends on hardware
  },
};

/**
 * Local Provider Capabilities (future)
 */
export const LOCAL_CAPABILITIES = {
  provider: 'local',
  parallel_tool_calls: true,
  streaming: true,
  vision: false,
  max_context_window: 8000, // Depends on model
  supported_models: ['gpt2', 'distilbert'], // Examples
  default_model: 'gpt2',
  rate_limits: {
    requests_per_minute: 10000,
    tokens_per_minute: 1000000,
  },
};

/**
 * Provider Metadata
 */
export const PROVIDERS_CONFIG = {
  // Primary provider (user's choice at signup)
  primary: 'openai',

  // Fallback order: if primary fails, try next in list
  fallback_order: ['openai', 'anthropic', 'vllm', 'local'],

  // Provider capabilities
  capabilities: {
    openai: OPENAI_CAPABILITIES,
    anthropic: ANTHROPIC_CAPABILITIES,
    vllm: VLLM_CAPABILITIES,
    local: LOCAL_CAPABILITIES,
  },

  // Service tier restrictions
  tier_restrictions: {
    bronze: {
      // BYOK only: users supply own keys
      allowed_providers: ['openai', 'anthropic'],
      allow_vllm: false,
      allow_local: false,
    },
    silver: {
      // Managed vLLM + BYOK
      allowed_providers: ['openai', 'anthropic', 'vllm'],
      allow_vllm: true,
      allow_local: false,
      rate_limit_multiplier: 1.5,
    },
    gold: {
      // All providers, including on-prem + local
      allowed_providers: ['openai', 'anthropic', 'vllm', 'local'],
      allow_vllm: true,
      allow_local: true,
      rate_limit_multiplier: 2.0,
    },
  },

  // Provider-specific options
  options: {
    openai: {
      api_base: 'https://api.openai.com/v1',
      timeout_ms: 30000,
      retry_strategy: 'exponential',
    },
    anthropic: {
      api_base: 'https://api.anthropic.com/v1',
      timeout_ms: 30000,
      retry_strategy: 'exponential',
    },
    vllm: {
      api_base: process.env.VLLM_API_BASE || 'http://localhost:8000/v1',
      timeout_ms: 60000, // Longer timeout for self-hosted
      retry_strategy: 'linear',
    },
    local: {
      api_base: 'http://localhost:5000', // Local inference server
      timeout_ms: 120000, // Very long timeout
      retry_strategy: 'linear',
    },
  },
};

/**
 * Get provider capabilities
 */
export const getProviderCapabilities = (provider) => {
  const caps = PROVIDERS_CONFIG.capabilities[provider];
  if (!caps) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return caps;
};

/**
 * Get fallback provider for a given provider
 */
export const getFallbackProvider = (currentProvider) => {
  const order = PROVIDERS_CONFIG.fallback_order;
  const index = order.indexOf(currentProvider);
  if (index === -1) {
    throw new Error(`Unknown provider: ${currentProvider}`);
  }
  return order[index + 1] || null; // null if no more fallbacks
};

/**
 * Check if provider is allowed for tier
 */
export const isProviderAllowedForTier = (provider, tier) => {
  const restrictions = PROVIDERS_CONFIG.tier_restrictions[tier];
  if (!restrictions) {
    throw new Error(`Unknown tier: ${tier}`);
  }
  return restrictions.allowed_providers.includes(provider);
};

export default PROVIDERS_CONFIG;
