/**
 * Provider Adapter Registry & Factory
 * ====================================
 * Purpose: Central registry and factory for LLM provider adapters.
 *
 * Responsibilities:
 * - Manage provider adapters (OpenAI, Anthropic, vLLM, etc.)
 * - Factory function: create provider instances from user config or BYOK
 * - Runtime provider switching (with fallback support)
 * - Capability detection (parallel tools, streaming, vision, context window)
 * - Error handling and validation
 * - Encryption/decryption of API keys (GDPR-compliant)
 *
 * Exports:
 * - Provider adapters: OpenAIAdapter, AnthropicAdapter, vLLMAdapter
 * - Factory functions: loadProvider(), createProvider()
 * - Metadata: PROVIDER_REGISTRY (capabilities, models, defaults)
 * - Utilities: getAvailableProviders(), getProviderMetadata()
 *
 * Architecture:
 * ┌─────────────────────────────────────────┐
 * │    User Request (agent call)            │
 * └────────────────────┬────────────────────┘
 *                      │
 *                      ▼
 * ┌─────────────────────────────────────────┐
 * │  loadProvider(user, options)            │
 * │  - Query ApiKey model (BYOK)            │
 * │  - Decrypt API key                      │
 * │  - Instantiate provider                 │
 * └────────────────────┬────────────────────┘
 *                      │
 *          ┌───────────┴───────────┐
 *          │                       │
 *    ┌─────▼─────┐         ┌───────▼──────┐
 *    │ OpenAI    │         │ Anthropic    │
 *    │ Adapter   │         │ Adapter      │
 *    └───────────┘         └──────────────┘
 *
 * BYO-Key Flow:
 * 1. User provides API key at setup
 * 2. Key encrypted and stored in ApiKey model
 * 3. Agent requests provider via loadProvider(user)
 * 4. Factory decrypts key and instantiates adapter
 * 5. Adapter used for LLM calls
 *
 * Managed vLLM Flow (Future):
 * 1. User enables managed vLLM (Silver/Gold tier)
 * 2. Factory creates vLLMAdapter with service URL
 * 3. Falls back to BYOK if vLLM unavailable
 *
 * Provider Capabilities:
 * {
 *   name: string,
 *   description: string,
 *   models: [{ name, contextWindow, costPer1kTokens }],
 *   features: {
 *     parallel_tool_calls: boolean,
 *     streaming: boolean,
 *     vision: boolean,
 *     function_calling: boolean
 *   },
 *   tier_availability: { bronze, silver, gold } boolean map
 * }
 *
 * Implementation Notes:
 * - Stateless: each call to loadProvider() returns fresh instance
 * - No global state: thread-safe for concurrent requests
 * - API keys never logged; redacted in error messages
 * - Config validation at instantiation time
 * - Recovery Agent handles provider failures/fallbacks
 *
 * Error Handling:
 * - Invalid provider type → throw with helpful message
 * - Missing API key → throw (no fallback in factory; Recovery Agent handles)
 * - Encrypted key corruption → throw and log for support
 * - Network issues → let provider adapter handle (Recovery Agent retries)
 */

import dbConnect from '../../dbConnect.js';
import ApiKey from '../../../models/shared/ApiKey.js';

// Re-export provider adapters
export { OpenAIAdapter } from './openai.js';
export { AnthropicAdapter } from './anthropic.js';

/**
 * Provider Registry Metadata
 * Central source of truth for provider capabilities, models, and defaults
 */
export const PROVIDER_REGISTRY = {
    openai: {
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
        defaultModel: 'gpt-oss:120b-cloud',
        features: {
            parallel_tool_calls: true,
            streaming: true,
            vision: true,
            function_calling: true,
        },
        tier_availability: {
            bronze: true,  // BYOK only
            silver: true,  // BYOK or managed
            gold: true,    // BYOK or managed
        },
    },
    anthropic: {
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
            parallel_tool_calls: false, // Sequential only
            streaming: true,
            vision: true,
            function_calling: true,
        },
        tier_availability: {
            bronze: true,
            silver: true,
            gold: true,
        },
    },
    vllm: {
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
            bronze: false, // Requires on-prem or managed
            silver: true,  // Managed vLLM
            gold: true,    // On-prem vLLM
        },
    },
};
async function loadDefaultSystemApiKeyOpenAI() {
    //load OPENAI_API_KEY from env or create a default one
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const defaultName = 'Default System OpenAI Key';
    let apiKey = await ApiKey.findOne({ name: defaultName, encryptedKey: openaiApiKey });
    if (!apiKey) {
        apiKey = new ApiKey({
            provider: 'openai',
            name: defaultName,
            encryptedKey: openaiApiKey,
            models: ['gpt-4.1', 'gpt-3.5-turbo']
        });
    }
    return apiKey;
}
/**
 * Load provider from user's saved API key (BYOK)
 * 
 * @param {object} user - User document with _id
 * @param {object} options - Optional overrides
 * @returns {object} Provider adapter instance (OpenAIAdapter, AnthropicAdapter, etc)
 * @throws {Error} If no API key found or provider unknown
 */
export async function loadProvider(user, options = {}) {
    await dbConnect();

    if (!user?._id) {
        throw new Error('User ID required to load provider');
    }

    // Query user's API keys
    let apiKeyDoc = await ApiKey.findOne({ ownerId: user._id });
    if (!apiKeyDoc) {
        apiKeyDoc = await loadDefaultSystemApiKeyOpenAI();
    }

    if (!apiKeyDoc) {
        throw new Error(
            'No API key found. Please add an API key at Settings → API Keys ' +
            'or enable managed vLLM (Silver/Gold tier)'
        );
    }

    // Override provider type if specified
    const providerType = options.provider || apiKeyDoc.provider;
    const modelId = options.model || apiKeyDoc.modelId;

    // Decrypt API key (TODO: implement actual decryption)
    const apiKey = apiKeyDoc.encryptedKey; // Will be decrypted in actual implementation

    // Create provider instance
    return createProvider({
        type: providerType,
        apiKey,
        model: modelId,
        ...options,
    });
}

/**
 * Create provider instance from config
 * 
 * @param {object} config - Provider configuration
 * @param {string} config.type - Provider type (openai, anthropic, vllm)
 * @param {string} config.apiKey - API key for provider
 * @param {string} config.model - Model ID to use
 * @param {number} config.temperature - LLM temperature (0-1)
 * @param {object} config.options - Additional provider-specific options
 * @returns {object} Provider adapter instance
 * @throws {Error} If provider type unknown or config invalid
 */
export async function createProvider(config) {
    const { type, apiKey, model, ...rest } = config;

    if (!type) {
        throw new Error('Provider type required');
    }

    if (!apiKey) {
        throw new Error(`API key required for provider: ${type}`);
    }

    const providerType = type.toLowerCase();

    // Dynamic import based on provider type
    switch (providerType) {
        case 'openai': {
            const { OpenAIAdapter } = await import('./openai.js');
            const registry = PROVIDER_REGISTRY.openai;
            return new OpenAIAdapter({
                apiKey,
                model: model || registry.defaultModel,
                ...rest,
            });
        }

        case 'anthropic': {
            const { AnthropicAdapter } = await import('./anthropic.js');
            const registry = PROVIDER_REGISTRY.anthropic;
            return new AnthropicAdapter({
                apiKey,
                model: model || registry.defaultModel,
                ...rest,
            });
        }

        case 'vllm': {
            // TODO: Implement vLLMAdapter when available
            throw new Error('vLLM provider not yet implemented');
        }

        default: {
            const available = Object.keys(PROVIDER_REGISTRY).join(', ');
            throw new Error(
                `Unknown provider: ${type}. Available: ${available}`
            );
        }
    }
}

/**
 * Get list of available providers for user tier
 * 
 * @param {string} userTier - User tier (bronze, silver, gold)
 * @returns {string[]} List of available provider types
 */
export function getAvailableProviders(userTier = 'bronze') {
    return Object.entries(PROVIDER_REGISTRY)
        .filter(([_, config]) => config.tier_availability[userTier])
        .map(([type, _]) => type);
}

/**
 * Get metadata for a specific provider
 * 
 * @param {string} providerType - Provider type
 * @returns {object|null} Provider metadata or null if not found
 */
export function getProviderMetadata(providerType) {
    return PROVIDER_REGISTRY[providerType.toLowerCase()] || null;
}

/**
 * Get all models available for a provider
 * 
 * @param {string} providerType - Provider type
 * @returns {array} List of available models
 */
export function getProviderModels(providerType) {
    const provider = PROVIDER_REGISTRY[providerType.toLowerCase()];
    return provider?.models || [];
}

/**
 * Check if provider supports a specific feature
 * 
 * @param {string} providerType - Provider type
 * @param {string} feature - Feature name (e.g., parallel_tool_calls, streaming)
 * @returns {boolean} Whether provider supports the feature
 */
export function supportsFeature(providerType, feature) {
    const provider = PROVIDER_REGISTRY[providerType.toLowerCase()];
    return provider?.features?.[feature] || false;
}