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
 */

/**
 * OpenAI Provider Registry
 */
const OPENAI_REGISTRY = {
  name: 'OpenAI',
  description: 'OpenAI API (ChatGPT, GPT-4)',
  docUrl: 'https://platform.openai.com/docs',
  auth: 'API Key (sk-...)',
  models: [
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      contextWindow: 128000,
      costPer1mTokens: { input: 10, output: 30 },
    },
    {
      id: 'gpt-4',
      name: 'GPT-4',
      contextWindow: 8192,
      costPer1mTokens: { input: 30, output: 60 },
    },
    {
      id: 'gpt-3.5-turbo', 
      name: 'GPT-3.5 Turbo',
      contextWindow: 4096,
      costPer1mTokens: { input: 0.5, output: 1.5 },
    },
    {
      id: 'gpt-oss:120b-cloud',
      name: 'GPT-OSS 120B (Ollama Local)',
      contextWindow: 4096,
      costPer1mTokens: { input: 0.10, output: 0.15 },
    }
  ],
  defaultModel: 'gpt-oss:120b-cloud',
  features: {
    parallel_tool_calls: true,
    streaming: true,
    vision: true,
    function_calling: true,
  },
  tier_availability: {
    bronze: true,
    silver: true,
    gold: true,
  },
};

/**
 * Anthropic Provider Registry
 */
const ANTHROPIC_REGISTRY = {
  name: 'Anthropic',
  description: 'Anthropic API (Claude)',
  docUrl: 'https://docs.anthropic.com',
  auth: 'API Key (sk-ant-...)',
  models: [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      contextWindow: 200000,
      costPer1mTokens: { input: 3, output: 15 },
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      contextWindow: 200000,
      costPer1mTokens: { input: 15, output: 75 },
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      contextWindow: 200000,
      costPer1mTokens: { input: 3, output: 15 },
    },
  ],
  defaultModel: 'claude-3-5-sonnet-20241022',
  features: {
    parallel_tool_calls: false,
    streaming: true,
    vision: true,
    function_calling: true,
  },
  tier_availability: {
    bronze: true,
    silver: true,
    gold: true,
  },
};

/**
 * vLLM Provider Registry
 */
const VLLM_REGISTRY = {
  name: 'vLLM (Self-Hosted)',
  description: 'Open-source vLLM for on-prem or managed deployment',
  docUrl: 'https://docs.vllm.ai',
  auth: 'Service URL + optional API Key',
  models: [
    {
      id: 'meta-llama/Llama-2-7b-hf',
      name: 'Llama 2 7B',
      contextWindow: 4096,
      costPer1mTokens: { input: 0, output: 0 },
    },
    {
      id: 'meta-llama/Llama-2-70b-hf',
      name: 'Llama 2 70B',
      contextWindow: 4096,
      costPer1mTokens: { input: 0, output: 0 },
    },
  ],
  defaultModel: 'meta-llama/Llama-2-70b-hf',
  features: {
    parallel_tool_calls: true,
    streaming: true,
    vision: false,
    function_calling: true,
  },
  tier_availability: {
    bronze: false,
    silver: true,
    gold: true,
  },
};

/**
 * Provider Metadata & Registry
 */
const PROVIDERS_CONFIG = {
  // Provider registries (with models and capabilities)
  registry: {
    openai: OPENAI_REGISTRY,
    anthropic: ANTHROPIC_REGISTRY,
    vllm: VLLM_REGISTRY,
  },

  // Primary provider (user's choice at signup)
  primary: 'openai',

  // Fallback order: if primary fails, try next in list
  fallback_order: ['openai', 'anthropic', 'vllm'],

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
      allowed_providers: ['openai', 'anthropic', 'vllm'],
      allow_vllm: true,
      allow_local: false,
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
  },
};

/**
 * Get provider registry (metadata, models, features)
 */
export const getProviderRegistry = (provider) => {
  const reg = PROVIDERS_CONFIG.registry[provider];
  if (!reg) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return reg;
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
