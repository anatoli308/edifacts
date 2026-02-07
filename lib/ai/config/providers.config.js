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
  ],
  defaultModel: 'gpt-4-turbo',
  features: {
    parallel_tool_calls: true,
    streaming: true,
    vision: true,
    function_calling: true,
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
};

/**
 * Ollama Provider Registry (System Default)
 * Uses OpenAI-compatible API endpoint
 */
const OLLAMA_REGISTRY = {
  name: 'Ollama',
  description: 'Ollama local/managed LLM server (OpenAI-compatible API)',
  docUrl: 'https://ollama.com',
  auth: 'Service URL (no key required for local)',
  models: [
    {
      id: 'gpt-oss:120b-cloud',
      name: 'GPT-OSS 120B',
      contextWindow: 4096,
      costPer1mTokens: { input: 0.1, output: 0.15 }, //custom pricing for local models (for tracking only)
    },
  ],
  defaultModel: 'gpt-oss:120b-cloud',
  features: {
    parallel_tool_calls: true,
    streaming: true,
    vision: false,
    function_calling: true,
  },
};

/**
 * Provider Metadata & Registry
 */
const PROVIDERS_CONFIG = {
  // Provider registries (with models and capabilities)
  registry: {
    ollama: OLLAMA_REGISTRY,
    openai: OPENAI_REGISTRY,
    anthropic: ANTHROPIC_REGISTRY,
  },

  // Primary provider (system default when nothing configured)
  primary: 'ollama',

  // Fallback order: if primary fails, try next in list
  fallback_order: ['ollama', 'openai', 'anthropic'],

  // Provider-specific options
  options: {
    ollama: {
      api_base: process.env.SYSTEM_BASE_URL || 'http://localhost:11434/v1',
      timeout_ms: 60000,
      retry_strategy: 'linear',
    },
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
  return order[index + 1] || null;
};

export default PROVIDERS_CONFIG;
