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
 * const routerConfig = AGENT_CONFIG.router;
 * const response = await provider.callLLM({
 *   ...routerConfig,
 *   messages
 * });
 */

/**
 * Router Agent Configuration
 * - Fast classification
 * - Low temperature (deterministic)
 * - Short response
 */
export const ROUTER_CONFIG = {
  temperature: 0.3, // Low: classification should be deterministic
  max_tokens: 500, // Short response
  top_p: 0.9,
  timeout_ms: 5000, // Must be fast
  max_retries: 2,
  retry_backoff: 'exponential',
};

/**
 * Planner Agent Configuration
 * - Moderate temperature (creative task decomposition)
 * - Structured output
 * - Medium response length
 */
export const PLANNER_CONFIG = {
  temperature: 0.5, // Medium: balance between creativity and structure
  max_tokens: 2000, // Detailed task tree
  top_p: 0.95,
  timeout_ms: 10000,
  max_retries: 2,
  retry_backoff: 'exponential',
};

/**
 * Executor Agent Configuration
 * - Low temperature (precise tool calling)
 * - ReAct loops with iteration limit
 * - Long response allowed
 */
export const EXECUTOR_CONFIG = {
  temperature: 0.3, // Low: precise tool selection
  max_tokens: 4000, // Detailed reasoning + multiple tool calls
  top_p: 0.9,
  timeout_ms: 30000, // Longer: may call multiple tools
  max_retries: 3,
  retry_backoff: 'exponential',
  max_iterations: 10, // Prevent infinite loops
  iteration_timeout_ms: 5000, // Per iteration
};

/**
 * Critic Agent Configuration
 * - Very low temperature (deterministic validation)
 * - Structured validation output
 * - Fast validation
 */
export const CRITIC_CONFIG = {
  temperature: 0.1, // Very low: validation should be deterministic
  max_tokens: 1500, // Validation report
  top_p: 0.9,
  timeout_ms: 15000,
  max_retries: 1,
  retry_backoff: 'linear',
};

/**
 * Memory Agent Configuration
 * - No LLM calls needed (pure retrieval)
 * - Fast memory access
 * - Configurable retention
 */
export const MEMORY_CONFIG = {
  max_history_tokens: 8000, // Context window budget
  summary_threshold: 3000, // Summarize when exceeds this
  retention_days: 30, // Keep conversations for 30 days
  embeddings_enabled: false, // Start without vector DB
  cache_enabled: true, // Cache frequently accessed contexts
};

/**
 * Recovery Agent Configuration
 * - Retry strategies
 * - Provider fallback order
 * - Error classification
 */
export const RECOVERY_CONFIG = {
  retry_strategies: {
    transient_error: {
      max_retries: 3,
      initial_delay_ms: 1000,
      backoff_multiplier: 2,
      max_delay_ms: 10000,
    },
    rate_limit: {
      max_retries: 2,
      initial_delay_ms: 5000,
      backoff_multiplier: 1.5,
    },
    provider_error: {
      max_retries: 0, // Switch provider instead
      fallback_order: ['openai', 'vllm', 'local'],
    },
  },
  timeout_escalation_ms: 30000,
  circuit_breaker_enabled: true,
};

/**
 * Global Agent Configuration
 */
export const AGENT_CONFIG = {
  router: ROUTER_CONFIG,
  planner: PLANNER_CONFIG,
  executor: EXECUTOR_CONFIG,
  critic: CRITIC_CONFIG,
  memory: MEMORY_CONFIG,
  recovery: RECOVERY_CONFIG,

  // Global defaults
  default_model: 'gpt-4', // Can be overridden per agent
  max_parallel_tools: 3, // Max concurrent tool calls
  enable_logging: true,
  log_level: 'info', // info, debug, warn, error
  enable_tracing: false, // For production debugging
};

export default AGENT_CONFIG;
