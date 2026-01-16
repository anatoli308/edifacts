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
 * import { ROUTER_PROMPT, PLANNER_PROMPT } from 'lib/ai/prompts';
 * 
 * const systemMessage = {
 *   role: 'system',
 *   content: ROUTER_PROMPT
 * };
 *
 * // Or customize for specific domain:
 * import { getPromptForDomain } from 'lib/ai/prompts';
 * const prompt = getPromptForDomain('router', 'edifact');
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

/**
 * Get prompt for specific agent
 */
export const getPrompt = (agent) => {
  const prompts = {
    router: ROUTER_PROMPT,
    planner: PLANNER_PROMPT,
    executor: EXECUTOR_PROMPT,
    critic: CRITIC_PROMPT,
  };

  const prompt = prompts[agent];
  if (!prompt) {
    throw new Error(`Unknown agent: ${agent}`);
  }
  return prompt;
};

/**
 * Customize prompt for specific domain (optional)
 * Can be extended for domain-specific variations
 */
export const getPromptForDomain = (agent, domain) => {
  // Default: return base prompt
  // Future: load domain-specific variations if they exist
  return getPrompt(agent);
};

/**
 * Build complete system message for LLM
 */
export const buildSystemMessage = (agent, context = {}) => {
  const basePrompt = getPrompt(agent);
  
  // Optionally customize based on context
  let customizedPrompt = basePrompt;
  
  if (context.domain) {
    customizedPrompt += `\n\n## Current Domain\nYou are working with the **${context.domain}** domain module.`;
  }
  
  if (context.availableTools && context.availableTools.length > 0) {
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
  getPrompt,
  getPromptForDomain,
  buildSystemMessage,
};
