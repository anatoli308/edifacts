/**
 * Recovery Agent (Failure Handling & Fallback)
 * ============================================
 * Status: 🚧 Planned (v1.x Late - Q2 2026)
 * Human Analog: Amygdala (Fight-or-Flight, Emergency Response)
 * 
 * Purpose: Handle failures, timeouts, and provider issues with graceful degradation.
 *
 * Responsibilities:
 * - Detect and categorize failures:
 *   - API errors (timeout, rate limit, server error)
 *   - Tool execution errors
 *   - LLM errors (invalid output, hallucination detected)
 *   - Network issues
 * - Implement retry strategies:
 *   - Exponential backoff with jitter
 *   - Configurable max retries per failure type
 * - Provider fallback:
 *   - If OpenAI fails → try vLLM
 *   - If vLLM fails → try local model (if available)
 *   - Graceful degradation: use Explanation Engine (no agents) if all fail
 * - Partial recovery:
 *   - Skip failed tool, continue with others
 *   - Request user clarification if critical task fails
 *
 * Inputs:
 * - Error or failure event
 * - Current execution state (task, attempt count, providers tried)
 * - Fallback options (configured per deployment)
 *
 * Outputs:
 * - Recovery decision:
 *   {
 *     action: "RETRY" | "SWITCH_PROVIDER" | "GRACEFUL_DEGRADE" | "ESCALATE",
 *     details: { next_provider, retry_after_ms, user_message }
 *   }
 * - Updated execution state
 * - Audit log entry
 *
 * Retry Strategies:
 * 1. Transient errors (timeout): Retry with exponential backoff
 * 2. Rate limit: Wait and retry
 * 3. Provider failure: Switch to next available provider
 * 4. Persistent error: Escalate to user with fallback UI
 *
 * Implementation Notes:
 * - Stateless decision logic; state managed by Coordinator.
 * - Provider fallback order: OpenAI → vLLM → Local → Explanation Engine
 * - Max total retries to prevent infinite loops.
 * - All recovery attempts logged for audit/debugging.
 * - User-facing error messages generated here.
 *
 * Security:
 * - No sensitive data leaked in error messages.
 * - Prevent attackers from triggering expensive fallbacks.
 * - Rate limiting respected (don't spam retries).
 *
 * Provider-Agnostic: Recovery works across all provider adapters.
 */

/**
 * Recovery Agent Configuration
 * - Retry strategies
 * - Provider fallback order
 * - Error classification
 */
const RECOVERY_CONFIG = {
    retryStrategies: {
        transientError: {
            maxRetries: 3,
            initialDelayMs: 1000,
            backoffMultiplier: 2,
            maxDelayMs: 10000,
        },
        rateLimit: {
            maxRetries: 2,
            initialDelayMs: 5000,
            backoffMultiplier: 1.5,
        },
        providerError: {
            maxRetries: 0, // Switch provider instead
            fallbackOrder: ['openai', 'vllm', 'local'],
        },
    },
    timeoutEscalationMs: 30000,
    circuitBreakerEnabled: true,

    //
    temperature: 0,
    maxRetries: 3,
    timeoutMs: 2000,
    exponentialBackoff: true,
};

export class Recovery {
    constructor(config = {}) {
        this.config = {
            // Retry configuration
            maxRetries: 3,
            maxTotalRetries: 10,
            initialBackoffMs: 1000,
            maxBackoffMs: 60000,
            backoffMultiplier: 2,
            jitterFactor: 0.1,

            // Provider fallback chain (in priority order)
            providerChain: ['openai', 'vllm', 'local', 'explanation-engine'],

            // Timeout configuration
            requestTimeoutMs: 60000,
            totalTimeoutMs: 300000, // 5 minutes total

            // Rate limit handling
            rateLimitBackoffMs: 60000, // 1 minute wait on rate limit

            // Logging
            enableLogging: true,

            ...RECOVERY_CONFIG,
            ...config
        };

        this.recoveryAttempts = new Map(); // Track attempts per task
    }

    /**
     * Main recovery invocation
     *
     * @param {object} params
     * @param {Error} params.error - The error that occurred
     * @param {string} params.currentProvider - Current provider name
     * @param {number} params.retryCount - Retry count for this error
     * @param {array} params.fallbackProviders - Available fallback providers
     * @param {object} params.executionState - Current execution state (task, timestamp, etc)
     * @returns {promise<object>} Recovery decision
     */
    async invoke({ error, currentProvider, retryCount = 0, fallbackProviders = [], executionState = {} }) {
        const startTime = Date.now();

        try {
            // Step 1: Categorize error
            const errorCategory = this._categorizeError(error);
            this._log(`[Recovery] Error: ${error.message} (category: ${errorCategory})`);

            // Step 2: Determine if retry is viable
            const shouldRetry = this._shouldRetry(
                errorCategory,
                retryCount,
                executionState
            );

            if (shouldRetry) {
                // Calculate backoff
                const backoffMs = this._calculateBackoff(retryCount);

                return {
                    success: true,
                    action: 'RETRY',
                    provider: currentProvider,
                    retryAfterMs: backoffMs,
                    nextRetryCount: retryCount + 1,
                    reasoning: `Retrying ${errorCategory} error with ${backoffMs}ms backoff`,
                    userMessage: 'Retrying request...',
                    recoveryType: 'RETRY',
                    timestamp: new Date().toISOString(),
                    duration_ms: Date.now() - startTime
                };
            }

            // Step 3: Try provider fallback
            const nextProvider = this._selectNextProvider(
                currentProvider,
                fallbackProviders,
                errorCategory
            );

            if (nextProvider && nextProvider !== currentProvider) {
                this._log(`[Recovery] Switching from ${currentProvider} to ${nextProvider}`);

                return {
                    success: true,
                    action: 'SWITCH_PROVIDER',
                    provider: nextProvider,
                    previousProvider: currentProvider,
                    reasoning: `Provider ${currentProvider} failed (${errorCategory}). Switching to ${nextProvider}`,
                    userMessage: `Switching to backup service (${nextProvider})...`,
                    recoveryType: 'PROVIDER_FALLBACK',
                    timestamp: new Date().toISOString(),
                    duration_ms: Date.now() - startTime
                };
            }

            // Step 4: Graceful degradation
            this._log(`[Recovery] No providers available. Using graceful degradation.`);

            return {
                success: true,
                action: 'GRACEFUL_DEGRADE',
                provider: 'explanation-engine',
                reasoning: 'All providers exhausted. Falling back to simpler explanation engine.',
                userMessage: 'Simplifying analysis (agent features unavailable)...',
                recoveryType: 'GRACEFUL_DEGRADE',
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime
            };

        } catch (recoveryError) {
            this._log(`[Recovery] Recovery logic failed: ${recoveryError.message}`);

            return {
                success: false,
                action: 'ESCALATE',
                error: recoveryError.message,
                originalError: error.message,
                userMessage: 'An unexpected error occurred. Please try again or contact support.',
                recoveryType: 'ESCALATE',
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime
            };
        }
    }

    /**
     * Categorize error type for appropriate recovery
     * @private
     */
    _categorizeError(error) {
        const message = (error.message || '').toLowerCase();
        const code = error.code || '';

        // Network/Timeout errors
        if (message.includes('timeout') || code === 'ETIMEDOUT') {
            return 'TIMEOUT';
        }
        if (message.includes('econnrefused') || message.includes('connection refused')) {
            return 'CONNECTION_ERROR';
        }
        if (message.includes('enotfound') || message.includes('getaddrinfo')) {
            return 'DNS_ERROR';
        }
        if (message.includes('network')) {
            return 'NETWORK_ERROR';
        }

        // Rate limiting
        if (code === 429 || message.includes('rate limit') || message.includes('too many requests')) {
            return 'RATE_LIMIT';
        }

        // API/Server errors
        if (code === 500 || message.includes('internal server error')) {
            return 'SERVER_ERROR';
        }
        if (code === 503 || message.includes('service unavailable')) {
            return 'SERVICE_UNAVAILABLE';
        }
        if (code === 401 || code === 403 || message.includes('unauthorized') || message.includes('forbidden')) {
            return 'AUTH_ERROR';
        }
        if (code === 400 || message.includes('bad request')) {
            return 'BAD_REQUEST';
        }

        // Tool execution errors
        if (message.includes('tool') && message.includes('failed')) {
            return 'TOOL_ERROR';
        }
        if (message.includes('validation')) {
            return 'VALIDATION_ERROR';
        }

        // LLM-specific errors
        if (message.includes('invalid json') || message.includes('json')) {
            return 'JSON_PARSE_ERROR';
        }
        if (message.includes('hallucination')) {
            return 'HALLUCINATION_DETECTED';
        }

        // Default
        return 'UNKNOWN_ERROR';
    }

    /**
     * Determine if retry is viable for this error
     * @private
     */
    _shouldRetry(errorCategory, retryCount, executionState) {
        // Check retry limits
        if (retryCount >= this.config.maxRetries) {
            this._log(`[Recovery] Max retries (${this.config.maxRetries}) reached`);
            return false;
        }

        // Check total timeout
        if (executionState.startTime) {
            const elapsed = Date.now() - executionState.startTime;
            if (elapsed > this.config.totalTimeoutMs) {
                this._log(`[Recovery] Total timeout (${this.config.totalTimeoutMs}ms) exceeded`);
                return false;
            }
        }

        // Determine if error is retryable
        const retryableErrors = [
            'TIMEOUT',
            'CONNECTION_ERROR',
            'DNS_ERROR',
            'NETWORK_ERROR',
            'RATE_LIMIT',
            'SERVER_ERROR',
            'SERVICE_UNAVAILABLE',
            'TOOL_ERROR' // Some tool errors are transient
        ];

        const isRetryable = retryableErrors.includes(errorCategory);
        this._log(`[Recovery] Error ${errorCategory} is ${isRetryable ? 'retryable' : 'not retryable'}`);

        return isRetryable;
    }

    /**
     * Calculate exponential backoff with jitter
     * @private
     */
    _calculateBackoff(retryCount) {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        let backoff = this.config.initialBackoffMs *
            Math.pow(this.config.backoffMultiplier, retryCount);

        // Cap at max backoff
        backoff = Math.min(backoff, this.config.maxBackoffMs);

        // Add jitter (±10%)
        const jitter = backoff * this.config.jitterFactor * (Math.random() - 0.5) * 2;
        const finalBackoff = Math.max(0, backoff + jitter);

        return Math.floor(finalBackoff);
    }

    /**
     * Select next provider from fallback chain
     * @private
     */
    _selectNextProvider(currentProvider, fallbackProviders, errorCategory) {
        // Build available provider chain
        const availableProviders = [
            ...fallbackProviders.filter(p => p && p !== currentProvider),
            ...this.config.providerChain.filter(p => p !== currentProvider)
        ];

        // Remove duplicates
        const uniqueProviders = [...new Set(availableProviders)];

        if (uniqueProviders.length === 0) {
            return null;
        }

        // Special handling for rate limits: always skip current provider
        if (errorCategory === 'RATE_LIMIT') {
            // Find a different provider that's not rate-limited
            return uniqueProviders[0];
        }

        // For other errors, try next in chain
        return uniqueProviders[0];
    }

    /**
     * Generate user-friendly error message
     * @private
     */
    _getUserMessage(action, errorCategory, provider) {
        const messages = {
            'RETRY': 'Retrying request...',
            'SWITCH_PROVIDER': `Switching to backup service (${provider})...`,
            'GRACEFUL_DEGRADE': 'Simplifying analysis (agent features unavailable)...',
            'ESCALATE': 'An unexpected error occurred. Please try again or contact support.'
        };

        return messages[action] || 'Processing...';
    }

    /**
     * Internal logging
     * @private
     */
    _log(message) {
        if (this.config.enableLogging) {
            console.log(message);
        }
    }
}
