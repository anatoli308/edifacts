/**
 * Provider Adapter Registry & Factory
 * ====================================
 * Purpose: Central point for instantiating and managing LLM provider adapters.
 *
 * Responsibilities:
 * - Export all provider adapters (OpenAI, Anthropic, vLLM, etc.)
 * - Factory function to create provider instance from config
 * - Runtime provider switching (if allowed by config)
 * - Centralized error handling for provider issues
 * - Provider capability detection (parallel tools? streaming? etc.)
 *
 * Exports:
 * - OpenAIAdapter
 * - AnthropicAdapter
 * - vLLMAdapter
 * - LocalGPTAdapter (future)
 * - createProvider(config) factory function
 * - PROVIDER_CAPABILITIES (metadata about each provider)
 *
 * Usage:
 * import { createProvider } from 'lib/ai/providers';
 * 
 * const provider = createProvider({
 *   type: 'openai',
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-4',
 *   temperature: 0.7
 * });
 *
 * Provider Capabilities:
 * {
 *   parallel_tool_calls: boolean,
 *   streaming: boolean,
 *   vision: boolean,
 *   context_window: number
 * }
 *
 * Implementation Notes:
 * - Stateless factory: each provider instance is self-contained
 * - Config validated at instantiation time
 * - API keys never logged or exposed
 * - Provider switching requires new instance creation
 *
 * Error Handling:
 * - Invalid provider type → throw error
 * - Missing API key → throw error
 * - Provider not available → Recovery Agent fallback
 */

// TODO: Export all providers and create factory
