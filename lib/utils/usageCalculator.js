/**
 * LLM Usage Calculator
 * ====================
 * Purpose: Calculate cost and format usage data from provider responses
 * 
 * Features:
 * - Provider-agnostic usage normalization
 * - Automatic cost calculation based on provider rates
 * - Latency tracking (TTFT, tokens/sec)
 * - Support for Anthropic Prompt Caching
 */

import { getProviderRegistry } from '../ai/config/providers.config.js';

/**
 * Calculate usage data from provider response
 * @param {Object} params
 * @param {string} params.provider - Provider name ('ollama', 'openai', 'anthropic')
 * @param {string} params.model - Model ID
 * @param {Object} params.providerUsage - Raw usage object from provider
 * @param {Object} params.timing - Optional timing data { startTime, firstTokenTime, endTime }
 * @param {string} params.content - Optional content for token estimation fallback (output)
 * @param {Array} params.messages - Optional messages array for input token estimation
 * @returns {Object} Formatted usage object for AnalysisMessage schema
 */
export function calculateUsage({ provider, model, providerUsage, timing = {}, content = '', messages = [] }) {
    // Normalize token counts (provider-agnostic)
    let tokens = normalizeTokens(provider, providerUsage);
    let estimated = false;
    
    // Fallback: Estimate tokens if provider didn't return usage
    if (tokens.total === 0 && (content || messages.length > 0)) {
        tokens = estimateTokens(content, messages);
        estimated = true;
        console.log(`[UsageCalculator] Provider usage not available. Estimated ${tokens.total} tokens (input: ${tokens.input}, output: ${tokens.output}).`);
    }
    
    // Calculate cost
    const cost = calculateCost(provider, model, tokens);
    
    // Calculate latency metrics
    const latency = calculateLatency(tokens, timing);
    
    return {
        provider,
        model,
        tokens,
        cost,
        latency,
        estimated  // ✨ Flag to indicate if tokens were estimated
    };
}

/**
 * Normalize token counts from different providers
 * @private
 */
function normalizeTokens(provider, usage) {
    if (!usage) {
        return { input: 0, output: 0, total: 0, cached: 0 };
    }
    
    switch (provider) {
        case 'openai':
        case 'ollama':
            return {
                input: usage.prompt_tokens || usage.promptTokens || 0,
                output: usage.completion_tokens || usage.completionTokens || 0,
                total: usage.total_tokens || usage.totalTokens || 0,
                cached: 0 // OpenAI doesn't have prompt caching (yet)
            };
        
        case 'anthropic':
            return {
                input: usage.input_tokens || 0,
                output: usage.output_tokens || 0,
                total: (usage.input_tokens || 0) + (usage.output_tokens || 0),
                cached: usage.cache_read_input_tokens || 0 // Anthropic Prompt Caching
            };
        
        default:
            console.warn(`[UsageCalculator] Unknown provider: ${provider}`);
            return { input: 0, output: 0, total: 0, cached: 0 };
    }
}

/**
 * Estimate token count from text content and messages
 * Rule of thumb: ~4 characters per token (English)
 * @private
 * @param {string} content - Output content from LLM
 * @param {Array} messages - Input messages to LLM
 */
function estimateTokens(content = '', messages = []) {
    // Estimate output tokens from content
    const estimatedOutput = content ? Math.ceil(content.length / 4) : 0;
    
    // Estimate input tokens from messages
    let estimatedInput = 0;
    if (messages && messages.length > 0) {
        for (const msg of messages) {
            if (msg.content && typeof msg.content === 'string') {
                estimatedInput += Math.ceil(msg.content.length / 4);
            }
        }
    }
    
    return {
        input: estimatedInput,
        output: estimatedOutput,
        total: estimatedInput + estimatedOutput,
        cached: 0
    };
}

/**
 * Calculate cost in USD based on provider pricing
 * @private
 */
function calculateCost(provider, model, tokens) {
    const pricing = getModelPricing(provider, model);
    
    if (!pricing) {
        console.warn(`[UsageCalculator] No pricing found for ${provider}/${model}`);
        return { input: 0, output: 0, total: 0 };
    }
    
    // Cost per 1M tokens → cost per token
    const inputCost = (tokens.input / 1_000_000) * pricing.input;
    const outputCost = (tokens.output / 1_000_000) * pricing.output;
    
    // Anthropic Prompt Caching: cached tokens are 90% cheaper
    const cachedDiscount = provider === 'anthropic' ? 0.1 : 1;
    const cachedCost = (tokens.cached / 1_000_000) * pricing.input * cachedDiscount;
    
    return {
        input: parseFloat(inputCost.toFixed(6)),
        output: parseFloat(outputCost.toFixed(6)),
        total: parseFloat((inputCost + outputCost + cachedCost).toFixed(6))
    };
}

/**
 * Get pricing for a specific model
 * @private
 */
function getModelPricing(provider, modelId) {
    try {
        const registry = getProviderRegistry(provider);
        
        if (!registry || !registry.models) {
            return null;
        }
        
        const modelConfig = registry.models.find(m => m.id === modelId);
        return modelConfig?.costPer1mTokens || null;
    } catch (error) {
        console.warn(`[UsageCalculator] Failed to get pricing for ${provider}/${modelId}:`, error.message);
        return null;
    }
}

/**
 * Calculate latency metrics
 * @private
 */
function calculateLatency(tokens, timing) {
    const { startTime, firstTokenTime, endTime } = timing;
    
    const latency = {};
    
    // Time to first token (TTFT)
    if (startTime && firstTokenTime) {
        latency.firstToken_ms = firstTokenTime - startTime;
    }
    
    // Total response time
    if (startTime && endTime) {
        latency.total_ms = endTime - startTime;
        
        // Tokens per second (generation speed)
        if (tokens.output > 0) {
            const seconds = latency.total_ms / 1000;
            latency.tokensPerSecond = parseFloat((tokens.output / seconds).toFixed(2));
        }
    }
    
    return latency;
}

/**
 * Aggregate usage from multiple messages (e.g., for scheduler metrics)
 * @param {Array<Object>} usageArray - Array of usage objects
 * @returns {Object} Aggregated usage
 */
export function aggregateUsage(usageArray) {
    if (!usageArray || usageArray.length === 0) {
        return null;
    }
    
    // Get provider and model from first usage entry
    const firstUsage = usageArray.find(u => u);
    const provider = firstUsage?.provider || 'unknown';
    const model = firstUsage?.model || 'unknown';
    
    const aggregated = {
        provider,  // ✨ Include provider
        model,     // ✨ Include model
        tokens: { input: 0, output: 0, total: 0, cached: 0 },
        cost: { input: 0, output: 0, total: 0 },
        latency: { total_ms: 0, tokensPerSecond: 0 },
        estimated: false  // ✨ Track if any usage was estimated
    };
    
    for (const usage of usageArray) {
        if (!usage) continue;
        
        // Sum tokens
        aggregated.tokens.input += usage.tokens?.input || 0;
        aggregated.tokens.output += usage.tokens?.output || 0;
        aggregated.tokens.total += usage.tokens?.total || 0;
        aggregated.tokens.cached += usage.tokens?.cached || 0;
        
        // Sum costs
        aggregated.cost.input += usage.cost?.input || 0;
        aggregated.cost.output += usage.cost?.output || 0;
        aggregated.cost.total += usage.cost?.total || 0;
        
        // Sum latency
        aggregated.latency.total_ms += usage.latency?.total_ms || 0;
        
        // ✨ Mark as estimated if ANY usage was estimated
        if (usage.estimated) {
            aggregated.estimated = true;
        }
    }
    
    // Average tokens per second
    const avgLatency = aggregated.latency.total_ms / usageArray.length;
    if (avgLatency > 0 && aggregated.tokens.output > 0) {
        aggregated.latency.tokensPerSecond = parseFloat(
            (aggregated.tokens.output / (aggregated.latency.total_ms / 1000)).toFixed(2)
        );
    }
    
    // Round costs to 6 decimals
    aggregated.cost.input = parseFloat(aggregated.cost.input.toFixed(6));
    aggregated.cost.output = parseFloat(aggregated.cost.output.toFixed(6));
    aggregated.cost.total = parseFloat(aggregated.cost.total.toFixed(6));
    
    return aggregated;
}

/**
 * Format usage for display (human-readable)
 * @param {Object} usage - Usage object
 * @returns {string} Formatted string
 */
export function formatUsageDisplay(usage) {
    if (!usage) return 'N/A';
    
    const { tokens, cost, latency } = usage;
    
    const parts = [];
    
    if (tokens?.total) {
        parts.push(`${tokens.total.toLocaleString()} tokens`);
    }
    
    if (cost?.total) {
        parts.push(`$${cost.total.toFixed(4)}`);
    }
    
    if (latency?.tokensPerSecond) {
        parts.push(`${latency.tokensPerSecond} tok/s`);
    }
    
    return parts.join(' • ') || 'N/A';
}
