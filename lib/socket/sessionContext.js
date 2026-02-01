/**
 * SessionContext manages AI agents and event relays for a socket session.
 * =============================================================
 *
 * Responsibilities:
 * - Instantiate and manage Agent instances (Planner, Orchestrator, etc)
 * - Relay agent events to the connected socket
 * - Cleanup on disconnect
 *
 * Agents managed:
 * - Planner: task decomposition
 * - Orchestrator: manages Planner, Executor, Critic, etc
 *
 * Event relays:
 * - Orchestrator events → socket events
 * - Planner events → socket events
 */
import { loadAgent } from '../ai/agents/index.js';
import { AgentOrchestrator } from '../ai/orchestration/agentOrchestrator.js';
import { Scheduler } from '../ai/orchestration/scheduler.js';

export class SessionContext {
    constructor(socket) {
        this.socket = socket;
        
        // Instantiate all agents (session-scoped)
        this.planner = loadAgent('planner');
        this.scheduler = new Scheduler();
        this.executor = loadAgent('executor');
        this.critic = loadAgent('critic');
        
        // Orchestrator gets all agents via config
        this.orchestrator = new AgentOrchestrator({
            planner: this.planner,
            scheduler: this.scheduler,
            executor: this.executor,
            critic: this.critic,
        });

        this._eventMappings = {
            orchestrator: {
                'agent_orchestrator:scheduler': 'agent:scheduler',
                'agent_orchestrator:step': 'agent:step',
            },
            planner: {
                'agent_planner:started': 'agent:plan',
                'agent_planner:completed': 'agent:plan',
            },
            scheduler: {
                'agent_scheduler:step': 'agent:step',
            },
            executor: {
                'agent_executor:reasoning': 'agent:reasoning',
                'agent_executor:chunk': 'response:chunk',
                'agent_executor:tool_call': 'agent:tool_call',
                'agent_executor:tool_result': 'agent:tool_result',
            }
        };

        this._setupEventRelays();
    }

    _setupEventRelays() {
        // Relay events from all agents to socket
        for (const [agentName, mappings] of Object.entries(this._eventMappings)) {
            const agent = this[agentName];
            if (!agent) {
                console.warn(`[SessionContext] Agent '${agentName}' not found`);
                continue;
            }
            
            for (const [sourceEvent, targetEvent] of Object.entries(mappings)) {
                agent.on(sourceEvent, (data) => {
                    this.socket.emit(targetEvent, data);
                });
            }
        }
    }

    /**
     * Reset all agents before new execution
     */
    resetAgents() {
        this.planner?.reset?.();
        this.scheduler?.reset?.();
        this.executor?.reset?.();
        this.critic?.reset?.();
        console.log('[SessionContext] All agents reset');
    }

    /**
     * Cleanup on disconnect
     */
    cleanup() {
        this.orchestrator?.removeAllListeners();
        this.planner?.removeAllListeners();
        this.scheduler?.removeAllListeners();
        this.executor?.removeAllListeners();
        this.critic?.removeAllListeners();
        console.log('[SessionContext] Cleanup complete');
    }
}