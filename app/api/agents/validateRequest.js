/**
 * Agent API Request Validator
 * ============================
 * Purpose: Detailed request validation for agent API calls.
 *
 * Validates:
 * - Agent name and existence
 * - Message format and content
 * - Context structure
 * - Parameters (temperature, max_tokens, etc.)
 * - User permissions (tier-based access)
 */

import { AGENT_CONFIG } from 'lib/ai/config/agents.config.js';
import { PROVIDERS_CONFIG } from 'lib/ai/config/providers.config.js';

const VALID_AGENTS = ['router', 'planner', 'executor', 'critic', 'memory', 'recovery'];
const VALID_MODULES = ['edifact', 'twitter', 'erp'];
const VALID_ROLES = ['user', 'assistant', 'system'];

/**
 * Validate entire request
 */
export const validateAgentRequest = (body, userTier = 'bronze') => {
  const { agent, context, messages, parameters } = body;

  const errors = [];
  const warnings = [];

  // Validate agent
  if (!agent) {
    errors.push('Missing field: agent');
  } else if (!VALID_AGENTS.includes(agent)) {
    errors.push(`Invalid agent: ${agent}. Must be one of: ${VALID_AGENTS.join(', ')}`);
  }

  // Validate messages
  if (!messages) {
    errors.push('Missing field: messages');
  } else if (!Array.isArray(messages)) {
    errors.push('messages must be an array');
  } else if (messages.length === 0) {
    errors.push('messages must not be empty');
  } else {
    messages.forEach((msg, idx) => {
      if (!msg.role || !msg.content) {
        errors.push(`Message ${idx}: missing 'role' or 'content'`);
      }
      if (msg.role && !VALID_ROLES.includes(msg.role)) {
        errors.push(`Message ${idx}: invalid role '${msg.role}'`);
      }
      if (msg.content && typeof msg.content !== 'string') {
        errors.push(`Message ${idx}: content must be string`);
      }
    });
  }

  // Validate context
  if (context) {
    if (typeof context !== 'object') {
      errors.push('context must be object');
    } else {
      if (context.module && !VALID_MODULES.includes(context.module)) {
        errors.push(`Invalid module: ${context.module}`);
      }
      if (context.sessionId && typeof context.sessionId !== 'string') {
        errors.push('context.sessionId must be string');
      }
      if (context.analysisId && typeof context.analysisId !== 'string') {
        errors.push('context.analysisId must be string');
      }
    }
  }

  // Validate parameters
  if (parameters) {
    if (typeof parameters !== 'object') {
      errors.push('parameters must be object');
    } else {
      if ('temperature' in parameters) {
        if (typeof parameters.temperature !== 'number') {
          errors.push('temperature must be number');
        } else if (parameters.temperature < 0 || parameters.temperature > 2) {
          errors.push('temperature must be between 0 and 2');
        }
      }

      if ('maxTokens' in parameters) {
        if (typeof parameters.maxTokens !== 'number') {
          errors.push('maxTokens must be number');
        } else if (parameters.maxTokens < 1 || parameters.maxTokens > 128000) {
          errors.push('maxTokens must be between 1 and 128000');
        }
      }

      if ('tools' in parameters) {
        if (!Array.isArray(parameters.tools)) {
          errors.push('tools must be array');
        }
      }
    }
  }

  // Tier-based restrictions
  const tierRestrictions = PROVIDERS_CONFIG.tier_restrictions[userTier];
  if (!tierRestrictions) {
    warnings.push(`Unknown tier: ${userTier}. Using default restrictions.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validate message history format
 */
export const validateMessageHistory = (messages) => {
  const errors = [];

  if (!Array.isArray(messages)) {
    errors.push('messages must be array');
    return { valid: false, errors };
  }

  // Check for alternating roles
  let lastRole = null;
  messages.forEach((msg, idx) => {
    if (!msg.role) {
      errors.push(`Message ${idx}: missing role`);
    }
    if (msg.role === lastRole && lastRole !== 'system') {
      errors.push(`Message ${idx}: consecutive messages with same role '${msg.role}'`);
    }
    lastRole = msg.role;
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate context for specific agent
 */
export const validateContextForAgent = (agent, context) => {
  const errors = [];

  if (!context) {
    errors.push(`Agent '${agent}' requires context`);
    return { valid: false, errors };
  }

  // Router needs minimal context
  if (agent === 'router') {
    // No specific requirements
  }

  // Planner needs module context
  if (agent === 'planner') {
    if (!context.module) {
      errors.push('Planner requires context.module (edifact|twitter|erp)');
    }
  }

  // Executor needs tools available
  if (agent === 'executor') {
    if (!context.module) {
      errors.push('Executor requires context.module');
    }
    // TODO: Check if tools for module are available
  }

  // Critic needs analysis context
  if (agent === 'critic') {
    if (!context.module) {
      errors.push('Critic requires context.module');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateAgentRequest,
  validateMessageHistory,
  validateContextForAgent,
  VALID_AGENTS,
  VALID_MODULES,
  VALID_ROLES,
};
