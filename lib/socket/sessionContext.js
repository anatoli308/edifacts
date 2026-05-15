/**
 * Socket SessionContext manages AI agents and event relays for a socket session.
 * =============================================================
 *
 * Responsibilities:
 * - Instantiate and manage Agent instances (Planner, Orchestrator, etc)
 * - Store session-scoped data (user, provider, analysisChat)
 * - Relay agent events to the connected socket
 * - Cleanup on disconnect
 *
 * Agents managed:
 * - Planner: task decomposition
 * - Orchestrator: manages Planner, Executor, Critic, etc
 *
 * Session data (set after authentication):
 * - authenticatedUser: User object from DB
 * - provider: LLM provider instance
 * - analysisChat: Current chat session
 *
 * Event relays:
 * - Orchestrator events → socket events
 * - Planner events → socket events
 */
import { loadAgent } from '../ai/agents/index.js';
import { AgentOrchestrator } from '../ai/orchestration/agentOrchestrator.js';
import { Scheduler } from '../ai/orchestration/scheduler.js';
import { getAuthenticatedUser } from "../auth.js";
import { userRepo } from "../db/repositories/index.js";

export class SessionContext {
    constructor(socket) {
        this.socket = socket;

        this.isProcessing = false;

        // Session-scoped data (set after authentication per request)
        this.authenticatedUser = null;
        this.provider = null;
        this.analysisChat = null;

        // Instantiate all agents (immutable per session)
        this.planner = loadAgent('planner');
        this.executor = loadAgent('executor');
        this.critic = loadAgent('critic');
        this.decision = loadAgent('decision');
        this.scheduler = new Scheduler({ decision: this.decision });

        // Orchestrator gets all agents via config
        this.orchestrator = new AgentOrchestrator({
            planner: this.planner,
            scheduler: this.scheduler,
            executor: this.executor,
            critic: this.critic,
            decision: this.decision,
        });

        this._eventMappings = {
            orchestrator: {
                'agent_orchestrator:scheduler': 'agent:scheduler',
                'agent_orchestrator:replanning': 'agent:replanning',
                'agent_orchestrator:max_replans_exceeded': 'agent:replanning',
            },
            planner: {
                'agent_planner:started': 'agent:plan',
                'agent_planner:completed': 'agent:plan',
                'agent_planner:replanning': 'agent:plan',
            },
            scheduler: {
                'agent_scheduler:step': 'agent:step',
            },
            executor: {
                'agent_executor:reasoning': 'agent:reasoning',
                'agent_executor:chunk': 'response:chunk',
                'agent_executor:tool_call': 'agent:tool_call',
                'agent_executor:tool_result': 'agent:tool_result',
            },
            critic: {
                'agent_critic:started': 'agent:critic',
                'agent_critic:completed': 'agent:critic',
            },
            decision: {
                'agent_decision:started': 'agent:decision',
                'agent_decision:completed': 'agent:decision',
            }
        };
        this._updateUserOnlineStatus(socket, true)
            .catch(err => console.error(`[SessionContext] Failed to update online status:`, err.message));
        this._setupEventRelays();
    }

    async _updateUserOnlineStatus(socket, isOnline) {
        const authenticatedUser = await getAuthenticatedUser(socket.userId, socket.token);
        if (authenticatedUser) {
            await userRepo.setOnline(authenticatedUser.id, isOnline);
        }
        const status = isOnline ? "connected" : "disconnected";
        console.log(`Socket ${status}: ${socket.id} => (${authenticatedUser?.name || "guest"})`);
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
     * Initialize session data (called on each chat message after authentication)
     * @param {object} authenticatedUser - User from DB
     * @param {object} provider - LLM provider instance
     * @param {object} analysisChat - Chat session from DB
     */
    initializeSession(authenticatedUser, provider, analysisChat) {
        // Reset all agents before new execution
        this.authenticatedUser = authenticatedUser;
        this.provider = provider;
        this.analysisChat = analysisChat;
        this._resetAgents();
        console.log(`[SessionContext ${this.socket.id}] Session initialized for user ${this.authenticatedUser.id} and chat session ${this.analysisChat.id}`);
    }

    /**
     * Reset all agents before new execution
     */
    _resetAgents() {
        this.planner?.reset?.();
        this.scheduler?.reset?.();
        this.executor?.reset?.();
        this.critic?.reset?.();
        this.decision?.reset?.();
        console.log(`[SessionContext ${this.socket.id}] All agents reset`);
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
        this.decision?.removeAllListeners();

        this._updateUserOnlineStatus(this.socket, false)
        console.log(`[SessionContext ${this.socket.id}] Cleanup complete`);
    }
}