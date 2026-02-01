/**
 * Agent Registry & Index
 * ======================
 * Purpose: Central registry and export point for all agent implementations.
 *
 * Exports:
 * - Agent classes: Planner, Executor, Critic, Memory, Recovery
 * - Factory functions: loadAgent(agentType, config)
 * - Agent registry: for inspection and debugging
 * - Default agent configurations per type
 *
 * Agent Registry:
 * - Universal interface: all agents implement invoke(params) method
 * - Stateless: state managed by Coordinator/Memory layers
 * - Provider-agnostic: works with any LLM provider (OpenAI, Anthropic, vLLM, etc)
 * - Configurable: temperature, timeouts, max retries per agent type
 *
 * Notes:
 * - All agents receive provider instance; no provider logic in agents
 * - All agent decisions logged for audit/replay
 * - Agent outputs must be JSON-serializable for persistence
 */

import { Planner } from './planner.js';
import { Executor } from './executor.js';
import { Critic } from './critic.js';
import { Memory } from './memory.js';
import { Recovery } from './recovery.js';

/**
 * Agent Registry Metadata
 * Maps agent types to their class, and descriptions
 */
const AGENT_REGISTRY = {
    planner: {
        class: Planner,
        description: 'Hierarchical task decomposition (HTN)',
        responsibilities: [
            'Decompose goals into executable subtasks',
            'Estimate effort and dependencies',
            'Generate structured JSON task plan',
            'Support dynamic replanning',
        ],
    },
    executor: {
        class: Executor,
        description: 'ReAct loop with tool calling',
        responsibilities: [
            'Execute tasks with Thought → Action → Observation cycles',
            'Call tools from registry',
            'Collect and format tool results',
            'Persist tool calls and results for audit',
        ],
    },
    critic: {
        class: Critic,
        description: 'Validation and hallucination detection',
        responsibilities: [
            'Validate outputs against schemas and rules',
            'Detect hallucinations (fact-check vs deterministic core)',
            'Identify consistency issues',
            'Recommend fixes, replanning, or escalation',
        ],
    },
    memory: {
        class: Memory,
        description: 'Context management and retrieval',
        responsibilities: [
            'Manage conversation history (short-term memory)',
            'Retrieve relevant context from past conversations',
            'Manage context window limits',
            'Support vector DB integration (optional)',
        ],
    },
    recovery: {
        class: Recovery,
        description: 'Failure handling and provider fallback',
        responsibilities: [
            'Detect and categorize failures',
            'Implement retry strategies with backoff',
            'Switch providers on failure',
            'Escalate to human if needed',
        ],
    },
};

/**
 * Load agent by type with optional config override
 * @param {string} agentType - Agent type (planner, executor, critic, memory, recovery)
 * @param {object} config - Optional config override
 * @returns {object} Agent instance
 * @throws {Error} If agent type unknown
 */
export function loadAgent(agentType, config = {}) {
    const agentType_lower = agentType.toLowerCase();
    const registry = AGENT_REGISTRY[agentType_lower];
    
    if (!registry) {
        throw new Error(
            `Unknown agent type: ${agentType}. ` +
            `Available: ${Object.keys(AGENT_REGISTRY).join(', ')}`
        );
    }
    
    // Merge defaults with provided config
    const finalConfig = {
        ...config,
    };
    
    return new registry.class(finalConfig);
}

/**
 * Get all available agent types
 * @returns {string[]} List of agent types
 */
export function getAgentTypes() {
    return Object.keys(AGENT_REGISTRY);
}

/**
 * Get registry metadata for an agent
 * @param {string} agentType - Agent type
 * @returns {object} Registry entry with description, defaults, responsibilities
 */
export function getAgentMetadata(agentType) {
    return AGENT_REGISTRY[agentType.toLowerCase()] || null;
}