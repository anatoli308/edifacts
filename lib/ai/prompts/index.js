/**
 * Agent System Prompts
 * ====================
 * Purpose: Central export point for all agent system prompts.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VALID_AGENTS = ['planner', 'executor', 'critic'];
const _promptCache = {};

// Load prompts from markdown files
const _loadPrompt = (filename) => {
  try {
    return readFileSync(join(__dirname, filename), 'utf-8');
  } catch (error) {
    console.error(`Failed to load prompt: ${filename}`, error);
    return '';
  }
};

/**
 * Get prompt for specific agent
 * Loads and caches on first request, subsequent calls return from cache
 * @param {string} agent - Agent name (planner, executor, critic)
 * @returns {string} System prompt content
 */
export const getPrompt = (agent) => {
  if (!VALID_AGENTS.includes(agent)) {
    throw new Error(`Unknown agent: ${agent}. Available: ${VALID_AGENTS.join(', ')}`);
  }

  if (!_promptCache[agent]) {
    _promptCache[agent] = _loadPrompt(`${agent}.md`);
  }

  return _promptCache[agent];
};

export default {
  getPrompt,
};
