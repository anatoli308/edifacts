/**
 * Agent Registry & Index
 * ======================
 * Purpose: Central export point for all agent implementations and utilities.
 *
 * Exports:
 * - Agent implementations: Router, Planner, Executor, Critic, Memory, Recovery
 * - Agent types and interfaces
 * - Agent utilities: logging, state serialization, debugging
 * - Default configurations for each agent
 *
 * Usage:
 * import { Router, Planner, Executor, Critic } from 'lib/ai/agents';
 * 
 * const agents = {
 *   router: new Router(config),
 *   planner: new Planner(config),
 *   executor: new Executor(config),
 *   critic: new Critic(config)
 * };
 *
 * Notes:
 * - All agents are instantiated with shared config (LLM provider, model, parameters).
 * - Agents are stateless; state is managed by Coordinator.
 * - Logging: all agent decisions are logged for audit/debugging.
 */

// TODO: Export all agents and utilities
