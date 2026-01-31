/**
 * Agent Configuration
 * ===================
 * Purpose: Centralized configuration for agent behavior.
 *
 * Responsibilities:
 * - Define default parameters for each agent
 * - Temperature, max_tokens, timeout settings
 * - Retry strategies, error handling
 * - Logging levels, tracing
 *
 * Usage:
 * import { AGENT_CONFIG } from 'lib/ai/config';
 * 
 * const plannerConfig = AGENT_CONFIG.planner;
 * const response = await provider.callLLM({
 *   ...plannerConfig,
 *   messages
 * });
 */

/**
 * Planner Agent Configuration
 * - Moderate temperature (creative task decomposition)
 * - Structured output
 * - Medium response length
 */
export const PLANNER_CONFIG = {
  temperature: 0.3, // Low temperature for consistent planning
  maxTokens: 1500, // Detailed task tree
  topP: 0.95,
  timeoutMs: 15000,
  maxRetries: 2,
  retryBackoff: 'exponential',
};

/**
 * Executor Agent Configuration
 * - Low temperature (precise tool calling)
 * - ReAct loops with iteration limit
 * - Long response allowed
 */
export const EXECUTOR_CONFIG = {
  temperature: 0.3, // Low: precise tool selection
  maxTokens: 4000, // Detailed reasoning + multiple tool calls
  topP: 0.9,
  timeoutMs: 30000, // Longer: may call multiple tools
  maxRetries: 3,
  retryBackoff: 'exponential',
  maxIterations: 10, // Prevent infinite loops
  iterationTimeoutMs: 5000, // Per iteration
};

/**
 * Critic Agent Configuration
 * - Very low temperature (deterministic validation)
 * - Structured validation output
 * - Fast validation
 */
export const CRITIC_CONFIG = {
  temperature: 0.1, // Very low: validation should be deterministic
  maxTokens: 1500, // Validation report
  topP: 0.9,
  timeoutMs: 15000,
  maxRetries: 1,
  retryBackoff: 'linear',
};

/**
 * Memory Agent Configuration
 * - No LLM calls needed (pure retrieval)
 * - Fast memory access
 * - Configurable retention
 */
export const MEMORY_CONFIG = {
  maxHistoryTokens: 8000, // Context window budget
  summaryThreshold: 3000, // Summarize when exceeds this
  retentionDays: 30, // Keep conversations for 30 days
  embeddingsEnabled: false, // Start without vector DB
  cacheEnabled: true, // Cache frequently accessed contexts
};

/**
 * Recovery Agent Configuration
 * - Retry strategies
 * - Provider fallback order
 * - Error classification
 */
export const RECOVERY_CONFIG = {
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
};

/**
 * Global Agent Configuration
 */
export const AGENT_CONFIG = {
  planner: PLANNER_CONFIG,
  executor: EXECUTOR_CONFIG,
  critic: CRITIC_CONFIG,
  memory: MEMORY_CONFIG,
  recovery: RECOVERY_CONFIG,

  // Global defaults
  defaultModel: 'gpt-4', // Can be overridden per agent
  maxParallelTools: 3, // Max concurrent tool calls
  enableLogging: true,
  logLevel: 'info', // info, debug, warn, error
  enableTracing: false, // For production debugging
};

export default AGENT_CONFIG;
