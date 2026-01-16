/**
 * Agent API Utilities & Helpers
 * =============================
 * Purpose: Shared utilities for agent API routes.
 *
 * Responsibilities:
 * - Request validation
 * - Response formatting
 * - Error handling
 * - Agent loading/initialization
 * - Logging and audit trails
 */

/**
 * Validate agent API request
 */
export const validateAgentRequest = (body) => {
  const { agent, context, messages, parameters } = body;

  const errors = [];

  // Validate agent name
  const validAgents = ['router', 'planner', 'executor', 'critic', 'memory', 'recovery'];
  if (!validAgents.includes(agent)) {
    errors.push(`Invalid agent: ${agent}. Must be one of: ${validAgents.join(', ')}`);
  }

  // Validate messages
  if (!Array.isArray(messages) || messages.length === 0) {
    errors.push('Messages must be non-empty array');
  }

  messages.forEach((msg, idx) => {
    if (!msg.role || !msg.content) {
      errors.push(`Message ${idx} missing 'role' or 'content'`);
    }
    if (!['user', 'assistant', 'system'].includes(msg.role)) {
      errors.push(`Message ${idx} invalid role: ${msg.role}`);
    }
  });

  // Validate context
  if (context) {
    const validModules = ['edifact', 'twitter', 'erp'];
    if (context.module && !validModules.includes(context.module)) {
      errors.push(`Invalid module: ${context.module}`);
    }
  }

  // Validate parameters
  if (parameters) {
    if (parameters.temperature && (parameters.temperature < 0 || parameters.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }
    if (parameters.maxTokens && parameters.maxTokens < 1) {
      errors.push('maxTokens must be positive');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Format successful agent response
 */
export const formatSuccessResponse = (agentName, result, metadata = {}) => {
  return {
    success: true,
    agentName,
    result,
    agentPlan: metadata.agentPlan,
    toolCalls: metadata.toolCalls,
    toolResults: metadata.toolResults,
    duration_ms: metadata.duration_ms || 0,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Format error response
 */
export const formatErrorResponse = (error, code = 'AGENT_ERROR') => {
  return {
    success: false,
    error: error.message || 'Unknown error',
    code,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Load user's LLM provider configuration
 */
export const loadUserProviderConfig = async (userId) => {
  // TODO: Load from User model
  // const user = await User.findById(userId);
  // return {
  //   provider: user.llmProvider, // 'openai' | 'anthropic' | 'vllm'
  //   model: user.llmModel,
  //   apiKey: user.apiKey,
  //   temperature: user.llmTemperature,
  // };
  return {};
};

/**
 * Log agent invocation for audit trail
 */
export const logAgentInvocation = async (userId, agentName, context, result, duration_ms) => {
  // TODO: Persist to audit log
  // console.log({
  //   timestamp: new Date(),
  //   userId,
  //   agentName,
  //   context,
  //   resultSummary: { ... },
  //   duration_ms,
  // });
};

/**
 * Get agent instance
 */
export const getAgent = async (agentName, provider) => {
  // TODO: Import agents
  // const { Router, Planner, Executor, Critic, Memory, Recovery } = await import('lib/ai/agents');
  // const agents = {
  //   router: new Router(provider),
  //   planner: new Planner(provider),
  //   executor: new Executor(provider),
  //   critic: new Critic(provider),
  //   memory: new Memory(provider),
  //   recovery: new Recovery(provider),
  // };
  // return agents[agentName];
};

export default {
  validateAgentRequest,
  formatSuccessResponse,
  formatErrorResponse,
  loadUserProviderConfig,
  logAgentInvocation,
  getAgent,
};
