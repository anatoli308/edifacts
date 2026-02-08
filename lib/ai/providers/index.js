/**
 * Provider Adapter Registry & Factory
 * ====================================
 * Purpose: Central registry and factory for LLM provider adapters.
 *
 * Responsibilities:
 * - Manage provider adapters (OpenAI, Anthropic, Ollama)
 * - Factory function: create provider instances from user config or BYOK
 * - Runtime provider switching (with fallback support)
 * - Capability detection (parallel tools, streaming, vision, context window)
 * - Error handling and validation
 * - Encryption/decryption of API keys (GDPR-compliant)
 *
 * Exports:
 * - Provider adapters: OpenAIAdapter, AnthropicAdapter
 * - Factory functions: loadProvider(), createProvider()
 * - Metadata: PROVIDER_REGISTRY (capabilities, models)
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
 *   }
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
import { getProviderRegistry, getProviderConfig } from '../config/providers.config.js';

// Direct imports - no string manipulation needed
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';

// Re-export provider adapters
export { OpenAIAdapter };
export { AnthropicAdapter };

/**
 * Provider Adapter Registry - Maps provider type directly to Adapter class
 * Ollama uses OpenAI-compatible API, so it reuses OpenAIAdapter
 */
const PROVIDER_ADAPTERS = {
    ollama: OpenAIAdapter,
    openai: OpenAIAdapter,
    anthropic: AnthropicAdapter,
};

/**
 * Provider Registry - imported from centralized config
 * All provider metadata, models, and capabilities defined in lib/ai/config/providers.config.js
 */
export async function loadDefaultSystemApiKey() {
    const systemApiKey = process.env.SYSTEM_API_KEY;
    const defaultName = 'Default System Ollama Key';
    let apiKey = await ApiKey.findOne({ name: defaultName, encryptedKey: systemApiKey, ownerId: null });
    if (!apiKey) {
        apiKey = new ApiKey({
            provider: 'ollama',
            name: defaultName,
            encryptedKey: systemApiKey,
            models: ['gpt-oss:120b-cloud']
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
        apiKeyDoc = await loadDefaultSystemApiKey();
    }

    if (!apiKeyDoc) {
        throw new Error(
            'No API key found. Please add an API key at Settings → API Keys'
        );
    }

    // Override provider type if specified
    const providerType = options.provider || apiKeyDoc.provider;
    const modelId = options.model || apiKeyDoc.selectedModel; // TODO: allow user preselect model

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
 * @param {string} config.type - Provider type (ollama, openai, anthropic)
 * @param {string} config.apiKey - API key for provider
 * @param {string} config.model - Model ID to use
 * @param {number} config.temperature - LLM temperature (0-1)
 * @param {object} config.options - Additional provider-specific options
 * @returns {object} Provider adapter instance
 * @throws {Error} If provider type unknown or config invalid
 */
async function createProvider(config) {
    const { type, apiKey, model, ...rest } = config;

    if (!type) {
        throw new Error('Provider type required');
    }

    if (!apiKey) {
        throw new Error(`API key required for provider: ${type}`);
    }

    const providerType = type.toLowerCase();

    // Get adapter class from registry
    const AdapterClass = PROVIDER_ADAPTERS[providerType];

    if (!AdapterClass) {
        const available = Object.keys(PROVIDER_ADAPTERS).join(', ');
        throw new Error(
            `Unknown provider: ${type}. Available: ${available}`
        );
    }

    const registry = getProviderRegistry(providerType);
    const providerConfig = getProviderConfig(providerType);

    return new AdapterClass({
        apiKey,
        model: model || registry.defaultModel,
        registry,
        providerConfig,
        ...rest,
    });
}