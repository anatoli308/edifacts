/**
 * Agent System Prompts
 * ====================
 * Purpose: Central export point for all agent system prompts.
 *
 * Exports:
 * - System prompts for each agent (Router, Planner, Executor, Critic)
 * - Prompt utilities and customization helpers
 *
 * Usage:
 * import { getPrompt } from 'lib/ai/prompts';
 * 
 * // Get base prompt
 * const prompt = getPrompt('planner');
 * 
 * // Or build complete system message
 * import { buildSystemMessage } from 'lib/ai/prompts';
 * const systemMsg = buildSystemMessage('planner', { fileInfo: 'invoice.txt' });
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load prompts from markdown files
const loadPrompt = (filename) => {
  try {
    return readFileSync(join(__dirname, filename), 'utf-8');
  } catch (error) {
    console.error(`Failed to load prompt: ${filename}`, error);
    return '';
  }
};

export const ROUTER_PROMPT = loadPrompt('router.md');
export const PLANNER_PROMPT = loadPrompt('planner.md');
export const EXECUTOR_PROMPT = loadPrompt('executor.md');
export const CRITIC_PROMPT = loadPrompt('critic.md');
export const ASSISTANT_PROMPT = loadPrompt('assistant.md');

/**
 * Get prompt for specific agent
 * @param {string} agent - Agent name (router, planner, executor, critic, assistant)
 * @returns {string} System prompt content
 */
export const getPrompt = (agent) => {
  const prompts = {
    router: ROUTER_PROMPT,
    planner: PLANNER_PROMPT,
    executor: EXECUTOR_PROMPT,
    critic: CRITIC_PROMPT,
    assistant: ASSISTANT_PROMPT,
  };

  const prompt = prompts[agent];
  if (!prompt) {
    throw new Error(`Unknown agent: ${agent}. Available: router, planner, executor, critic, assistant`);
  }
  return prompt;
};

/**
 * Build complete system message for LLM
 * @param {string} agent - Agent name
 * @param {object} context - Optional context to customize prompt
 * @returns {object} System message with role and content
 */
export const buildSystemMessage = (agent, context = {}) => {
  let customizedPrompt = getPrompt(agent);
  
  if (context.fileInfo) {
    customizedPrompt += `\n\nFile: ${context.fileInfo}`;
  }
  
  if (context.availableTools && Array.isArray(context.availableTools) && context.availableTools.length > 0) {
    customizedPrompt += `\n\n## Available Tools\n${context.availableTools.map(t => `- ${t}`).join('\n')}`;
  }
  
  return {
    role: 'system',
    content: customizedPrompt,
  };
};

export default {
  ROUTER_PROMPT,
  PLANNER_PROMPT,
  EXECUTOR_PROMPT,
  CRITIC_PROMPT,
  ASSISTANT_PROMPT,
  getPrompt,
  buildSystemMessage,
};
