# Copilot Coding Agent Instructions for EDIFACTS

## Project Overview
EDIFACTS is a Next.js/React web app for analyzing, explaining, and managing EDIFACT data with an AI chat assistant. It combines an open-source EDIFACT core (parsing, validation, normalization) with an optional LLM-based explanation layer, supporting both "bring your own key" and managed vLLM backends. The platform is SaaS-ready, modular, and designed for extensibility and enterprise use.

## Important Developer Rules
1. **Export only public APIs**: When creating new classes, only export the main class or function used by other modules. Helper functions should remain internal.
2. **Private method naming**: Internal private methods should be prefixed with an underscore `_` to indicate they are not part of the public API.
3. **Code consistency**: Follow existing code style and conventions for consistency across the project.
4. **Event-driven architecture**: Prefer EventEmitter-based communication over direct coupling where appropriate.
5. **Dependency Injection**: Use constructor injection for agent dependencies (see SessionContext pattern).
6. **State Machine readiness**: Agents maintain simple state flags (`idle`, `executing`, `completed`) to prepare for future State Machine implementation where needed.

## Clean Code Standards

Follow these fundamental principles for maintainable, scalable code:

### SOLID Principles
- **Single Responsibility Principle (SRP)**: Each class/function should have one, and only one, reason to change. One responsibility per module.
- **Open/Closed Principle (OCP)**: Software entities should be open for extension, but closed for modification. Use composition and dependency injection.
- **Liskov Substitution Principle (LSP)**: Subtypes must be substitutable for their base types without altering program correctness.
- **Interface Segregation Principle (ISP)**: No client should be forced to depend on methods it does not use. Create focused, specific interfaces.
- **Dependency Inversion Principle (DIP)**: Depend on abstractions, not concretions. High-level modules should not depend on low-level modules.

### Core Coding Standards
- **Small Functions**: Keep functions short (ideally < 20 lines). One level of abstraction per function.
- **No Side Effects**: Functions should be pure where possible. If side effects are necessary, make them explicit and documented.
- **DRY (Don't Repeat Yourself)**: Eliminate code duplication through abstraction and reuse.
- **Clear Abstractions**: Use meaningful names. Code should read like prose. Avoid clever tricks.
- **Separation of Concerns**: Different concerns should be in different modules. UI ≠ Business Logic ≠ Data Access.

### Practical Application in EDIFACTS
```js
// ❌ BAD: Multiple responsibilities, side effects, unclear
class Agent {
  async execute(msg, socket) {
    const result = await llm.call(msg);
    socket.emit('result', result);
    db.save(result);
    return result;
  }
}

// ✅ GOOD: Single responsibility, dependency injection, no side effects
class Planner extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
  }
  
  async invoke({ userMessage, provider }) {
    this.emit('agent_planner:started', { goal: userMessage });
    const plan = await this._decompose(userMessage, provider);
    this.emit('agent_planner:completed', plan);
    return plan;
  }
  
  reset() {
    // Clear state
  }
}
```

**Key Takeaways:**
- ✅ Each agent has ONE job (SRP)
- ✅ Events instead of direct coupling (OCP)
- ✅ Dependency Injection via constructor (DIP)
- ✅ Pure functions where possible (no side effects)
- ✅ SessionContext separates lifecycle from logic (Separation of Concerns)

## Architecture & Key Patterns

### Layered Design
- **Core (Deterministic):** EDIFACT parser/validator (no LLM dependency). Normalizes to JSON, detects subsets, enforces rules. See `_workers/` and backend logic. **Single source of truth for domain semantics.**
- **Explanation Engine:** Adapter pattern for LLM providers (OpenAI, Anthropic, Azure, local vLLM, etc). Interface: `explainSegment`, `explainMessage`, `answerQuestion`. User selects provider and supplies own API key.
- **Agentic AI Layer:** Provider-agnostic agent orchestration using **EventEmitter pattern**:
  - **Planner Agent:** Hierarchical task decomposition (HTN style) - EventEmitter
  - **Scheduler:** DAG scheduling for task execution - EventEmitter (future State Machine candidate)
  - **Executor Agent:** ReAct loops with tool calling - EventEmitter
  - **Critic Agent:** Validation, consistency checks, hallucination detection - EventEmitter
  - **Memory Agent:** Conversational context + long-term knowledge retrieval - EventEmitter (planned)
  - **Recovery Agent:** Fallbacks, retries, provider switching - EventEmitter (planned)
  - **AgentOrchestrator:** Coordinates Planner → Scheduler flow - EventEmitter
- **Service Layer:** Managed vLLM (hosted or on-prem) is optional and monetized via support/enterprise features. Core remains open source; commercial features (audit logs, SAP helpers, etc) are kept separate.

### EventEmitter Architecture Pattern

All agents extend Node.js EventEmitter for decoupled, event-driven communication:

```js
// Agent as EventEmitter
class Planner extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
  }
  
  async invoke({ userMessage, messages, context, provider }) {
    this.emit('agent_planner:started', { goal: userMessage, timestamp: Date.now() });
    
    // ... task decomposition logic
    
    this.emit('agent_planner:completed', finalResult);
    return finalResult;
  }
  
  reset() {
    // Reset state for next execution
    console.log('[Planner] State reset');
  }
}
```

**Key benefits:**
- Decouples agents from Socket.IO layer
- Prevents memory leaks (listeners registered once in constructor)
- Enables event relaying through SessionContext wrapper
- Makes agents testable in isolation
- Supports future observability/monitoring

### SessionContext Pattern (Dependency Injection)

`SessionContext` manages all agent instances per socket connection:

```js
class SessionContext {
  constructor(socket) {
    this.socket = socket;
    
    // Instantiate all agents (session-scoped, one per socket)
    this.planner = loadAgent('planner');
    this.scheduler = new Scheduler();
    this.executor = loadAgent('executor');
    this.critic = loadAgent('critic');
    
    // Orchestrator receives all agents via DI
    this.orchestrator = new AgentOrchestrator({
      planner: this.planner,
      scheduler: this.scheduler,
      executor: this.executor,
      critic: this.critic,
    });
    
    // Setup event relays (once, in constructor)
    this._setupEventRelays();
  }
  
  _setupEventRelays() {
    // Relay agent events to socket
    this.planner.on('agent_planner:started', (data) => this.socket.emit('agent:plan', data));
    this.planner.on('agent_planner:completed', (data) => this.socket.emit('agent:plan', data));
    // ... more event mappings
  }
  
  resetAgents() {
    // Reset all agents before new execution
    this.planner?.reset?.();
    this.scheduler?.reset?.();
    this.executor?.reset?.();
    this.critic?.reset?.();
  }
  
  cleanup() {
    // Remove all event listeners on disconnect
    this.orchestrator?.removeAllListeners();
    this.planner?.removeAllListeners();
    this.scheduler?.removeAllListeners();
    this.executor?.removeAllListeners();
    this.critic?.removeAllListeners();
  }
}
```

**Why SessionContext:**
- **Single Source of Truth** for agent instances per socket
- **Memory Leak Prevention**: Event listeners registered once, cleaned up on disconnect
- **Dependency Injection**: Orchestrator doesn't instantiate agents, receives them via config
- **Testability**: Mock agents can be injected for testing
- **Lifecycle Management**: Reset, cleanup, and event relay centralized

### Agent Execution Flow

```
User Message
  ↓
AgentHandlers.js: socket.sessionContext.resetAgents()  ← Reset state
  ↓
AgentOrchestrator.execute()
  ↓
Planner.invoke() → emit('agent_planner:started', 'agent_planner:completed')
  ↓            ↓
  └────→ SessionContext relays → socket.emit('agent:plan')
  ↓
Scheduler.execute() → emit('agent_scheduler:step')
  ↓
For each task:
  Executor.invoke() → emit('agent_executor:tool_call', 'agent_executor:tool_result', 'agent_executor:reasoning')
    ↓            ↓
    └────→ SessionContext relays → socket.emit('agent:tool_call', 'agent:tool_result', 'agent:reasoning')
  ↓
  Critic.validate()
  ↓
Orchestrator._aggregateResults()
  ↓
Return final result
```

**Event Naming Convention:**
- Internal agent events: `agent_{agentName}:{eventType}` (e.g., `agent_planner:started`)
- Socket.IO events: `agent:{eventType}` (e.g., `agent:plan`, `agent:tool_call`)
- SessionContext maps internal → socket events declaratively

### State Machine Strategy (Future)

**Current Approach:** Simple state tracking with reset()
```js
class Scheduler extends EventEmitter {
  constructor() {
    super();
    this.state = 'idle'; // idle | executing | completed
  }
  
  reset() {
    this.state = 'idle';
    this.currentExecution = null;
  }
}
```

**Future State Machine (when needed):**
- **Scheduler**: Will become full FSM when implementing:
  - Conditional replanning (Critic → Planner loop)
  - Parallel task execution
  - Retry/Recovery strategies
  - Human-in-the-loop approval
  - Checkpointing for long-running workflows
- **Library**: Build a own FSM else XState recommended for visualization, parallelism, guards
- **Agents that stay EventEmitter**: Orchestrator, Planner, Executor, Critic (linear flows)

**State Machine Candidates:**
```
Scheduler FSM (Future):
IDLE → PLANNING → EXECUTING → VALIDATING → COMPLETED
         ↓            ↓            ↓
       FAILED ← ─────┴────────────┴→ RECOVERING
                                      ↓
                                  RETRY / ESCALATE / AWAITING_HUMAN
```

## Complete Project Structure

```
edifacts/
├── app/                              # Next.js App Router
│   ├── api/                          # API Routes
│   │   ├── auth/                     # Authentication routes
│   │   ├── generate/session/         # EDIFACT session generation
│   │   └── user/                     # User management
│   ├── a/[sessionId]/                # EDIFACT analysis chat pages
│   ├── auth/                         # Auth pages (login, register)
│   ├── _components/                  # Reusable UI components
│   ├── _containers/                  # Page-level containers
│   ├── _contexts/                    # React Contexts
│   │   ├── UserContext.js
│   │   ├── SocketContext.js
│   │   └── ThemeContext.js
│   └── _hooks/                       # Custom React hooks
├── lib/                              # Core libraries
│   ├── ai/                           # Agent Core (domain-agnostic, reusable)
│   │   ├── agents/                   # Agent implementations (ALL EventEmitters)
│   │   │   ├── planner.js            # HTN task decomposition (EventEmitter)
│   │   │   ├── executor.js           # ReAct loops with tool calling (EventEmitter)
│   │   │   ├── critic.js             # Validation & hallucination detection (EventEmitter)
│   │   │   ├── memory.js             # Context management (EventEmitter, planned)
│   │   │   ├── recovery.js           # Failure handling & fallback (EventEmitter, planned)
│   │   │   └── index.js              # Agent registry (loadAgent factory)
│   │   ├── providers/                # LLM provider adapters (NO agent logic)
│   │   │   ├── openai.js             # OpenAI adapter
│   │   │   ├── anthropic.js          # Anthropic adapter
│   │   │   └── index.js              # Provider factory
│   │   ├── orchestration/            # Task coordination
│   │   │   ├── agentOrchestrator.js  # Planner → Scheduler coordinator (EventEmitter)
│   │   │   ├── scheduler.js          # DAG task execution (EventEmitter, future FSM)
│   │   │   ├── taskGraph.js          # Dependency resolution
│   │   │   └── index.js
│   │   ├── tools/                    # Tool management
│   │   │   ├── registry.js           # Central tool registry
│   │   │   └── index.js
│   │   ├── prompts/                  # Agent system prompts
│   │   │   ├── planner.md
│   │   │   ├── executor.md
│   │   │   ├── critic.md
│   │   │   └── index.js
│   │   └── config/                   # Configuration
│   │       └── providers.config.js
│   ├── socket/                       # Socket.IO layer
│   │   ├── handlers/
│   │   │   └── agentHandlers.js      # Agent invocation handlers
│   │   ├── sessionContext.js         # SessionContext wrapper (DI + event relay)
│   │   └── utils/
│   │       └── messageUtils.js       # Message preparation utilities
│   ├── auth.js                       # Authentication utilities
│   └── dbConnect.js                  # MongoDB connection
├── models/                           # Mongoose models
│   ├── shared/                       # Shared models (recommended structure)
│   │   ├── User.js
│   │   ├── ApiKey.js
│   │   └── File.js
│   └── edifact/                      # EDIFACT-specific models
│       ├── AnalysisChat.js           # Chat sessions (with agentPlan)
│       ├── AnalysisMessage.js        # Messages (with toolCalls[], toolResults[])
│       └── AnalysisMessageChunk.js   # Streaming chunks
├── _modules/                         # Domain-specific modules
│   └── edifact/                      # EDIFACT domain
│       ├── index.js
│       ├── context.js                # LLM context builder
│       ├── tools/                    # EDIFACT tools
│       └── validators/               # EDIFACT validators
├── _workers/                         # Backend workers
│   └── edifactParser.worker.js       # EDIFACT parsing (deterministic)
├── __tests__/                        # Test suite
├── theme/                            # MUI theme
├── public/                           # Static assets
├── uploads/                          # User uploads
├── server.js                         # Custom Express + Socket.IO server
├── proxy.js                          # HTTP auth middleware
├── socketproxy.js                    # WebSocket auth middleware
├── package.json
└── jsconfig.json                     # Path aliases (@/app/*)
```

## Socket.IO Events & Streaming

### Event Types
- **Agent inbound:** `agent:invoke`, `agent:status` (requires authenticated socket)
- **Agent outbound:**
  - `agent:started` - Execution begins
  - `agent:plan` - Task tree from Planner (2 events: started, completed)
  - `agent:scheduler` - Scheduler status
  - `agent:step` - Task progress (task_started, task_completed)
  - `agent:reasoning` - Executor internal thoughts (streaming)
  - `agent:tool_call` - Tool invocation
  - `agent:tool_result` - Tool execution result
  - `response:chunk` - Final answer streaming
  - `agent:completed` - Execution complete
  - `agent:failed` - Execution failed

### Event Flow Architecture

```
Agent (EventEmitter)
  │
  ├─ emit('agent_planner:started')
  ├─ emit('agent_planner:completed')
  ├─ emit('agent_executor:tool_call')
  ├─ emit('agent_executor:tool_result')
  └─ emit('agent_executor:reasoning')
        ↓
SessionContext._setupEventRelays()
  │
  ├─ agent_planner:started → socket.emit('agent:plan')
  ├─ agent_planner:completed → socket.emit('agent:plan')
  ├─ agent_executor:tool_call → socket.emit('agent:tool_call')
  └─ agent_executor:reasoning → socket.emit('agent:reasoning')
        ↓
Socket.IO → Frontend
```

**Benefits:**
- Clean separation: Agent logic vs Socket.IO transport
- Event listeners registered once (memory leak prevention)
- Easy to add new events without modifying agent code
- Testable: Agents emit events, tests assert on events

## Coding Rules for Agentic Development

### 1. Event-Driven Architecture
- **ALL agents extend EventEmitter** (Planner, Scheduler, Executor, Critic, Memory, Recovery)
- **Emit events for state changes**, not direct socket calls
- **Register listeners in constructor**, never in execute/invoke methods
- **Use SessionContext for event relay**, not direct socket access

```js
// ❌ BAD: Direct socket coupling, memory leak
async execute() {
  socket.on('event', handler);  // Listener registered per execution!
  socket.emit('result', data);
}

// ✅ GOOD: EventEmitter pattern
constructor() {
  super();  // EventEmitter
}

async execute() {
  this.emit('agent_scheduler:started', data);
  // ... logic
  this.emit('agent_scheduler:completed', result);
}
```

### 2. Dependency Injection
- **Agents receive dependencies via constructor config**
- **Never instantiate agents inside other agents**
- **Use SessionContext as DI container**

```js
// ❌ BAD: Direct instantiation
class Orchestrator {
  async execute() {
    const planner = loadAgent('planner');  // Tight coupling
    const scheduler = new Scheduler();
  }
}

// ✅ GOOD: Dependency Injection
class Orchestrator extends EventEmitter {
  constructor(config) {
    super();
    this.planner = config.planner;    // Injected
    this.scheduler = config.scheduler; // Injected
    this.executor = config.executor;   // Injected
    this.critic = config.critic;       // Injected
  }
}
```

### 3. State Management
- **Simple state tracking** with `reset()` method
- **Prepare for State Machine** (Scheduler will become FSM)
- **No complex state in agents** (keep functional)

```js
class Executor extends EventEmitter {
  constructor() {
    super();
    this.state = 'idle';  // Simple state tracking
    this.currentTask = null;
  }
  
  reset() {
    this.state = 'idle';
    this.currentTask = null;
  }
}
```

### 4. Never Mix Layers
- **No EDIFACT business rules in agents** (agents explain, never decide)
- **No agent logic inside provider adapters** (adapters are transport only)
- **No LLM calls inside deterministic core** (`_workers/`, models/)
- **No direct DB access from agents** (use deterministic tool interfaces)

### 5. Tool Design
- **Pure functions**: same input → same output
- **Explicit JSON Schemas** (no inference)
- **No hidden side effects**, log all mutations
- **Validate tool arguments** before execution

### 6. Security
- **No API keys in logs**, redact in audit logs
- **Tool sandboxing**: each tool runs in isolated context
- **Critic validation mandatory** for system-modifying tools
- **Role-based tool access** (Bronze/Silver/Gold tiers)

### 7. Testing & Validation
- **Unit tests for agents** (mock LLMs, deterministic prompts)
- **Integration tests** for tool execution and provider adapters
- **E2E tests** for multi-turn workflows
- **Adversarial tests**: prompt injection, tool manipulation, provider failures

## Best Practices Summary

### Architecture Patterns
✅ **EventEmitter for all agents** (decoupling)  
✅ **SessionContext for DI** (agent lifecycle management)  
✅ **Event relay pattern** (Agent → SessionContext → Socket)  
✅ **Constructor-based listener registration** (memory leak prevention)  
✅ **Simple state tracking** (preparing for FSM)  
✅ **Provider adapters are thin** (no agent logic)  

### Code Quality
✅ **Private methods prefixed with _**  
✅ **Export only public APIs**  
✅ **Dependency Injection over instantiation**  
✅ **Pure functions for tools**  
✅ **YAGNI**: Don't over-engineer (State Machine only when needed)  

### Future-Proofing
✅ **Scheduler is FSM candidate** (conditional replanning, recovery)  
✅ **All agents have reset()** (State Machine migration ready)  
✅ **Event-driven architecture** (observability, monitoring ready)  

## Strategic Principle: Domain-First Agent Design

EDIFACTS follows **Domain-First Agent Design**:

- The EDIFACT engine is the **single source of truth** for domain semantics
- LLMs are **explainers, planners, and orchestrators** – never authorities on business rules
- The agentic layer must remain:
  - **Provider-agnostic** (swap OpenAI ↔ Anthropic ↔ vLLM)
  - **Deterministic in control flow** (reproducible execution)
  - **Auditable** (every agent step, tool call persistable and replayable)
  - **Enterprise-grade** (GDPR-compliant, role-based access, audit logs)
  - **Event-driven** (decoupled, observable, testable)

**Architecture Hierarchy:**
```
EDIFACTS Platform
 ├─ Core (Deterministic EDIFACT Engine)
 ├─ Agent OS (EventEmitter-based)
 │   ├─ Planner (EventEmitter)
 │   ├─ Scheduler (EventEmitter → Future FSM)
 │   ├─ Executor (EventEmitter)
 │   ├─ Critic (EventEmitter)
 │   ├─ Memory (EventEmitter, planned)
 │   ├─ Recovery (EventEmitter, planned)
 │   ├─ SessionContext (DI + Event Relay)
 │   ├─ Tool Registry (Universal Schema)
 │   └─ Provider Adapters (Thin, no logic)
 ├─ UI (Next.js Agent Inspector)
 └─ Enterprise Layer (SSO, DSGVO, On-Prem)
```

---

**See also:**
- `lib/socket/sessionContext.js` - SessionContext pattern implementation
- `lib/socket/handlers/agentHandlers.js` - WebSocket agent orchestration
- `lib/ai/orchestration/agentOrchestrator.js` - Orchestrator with DI
- `lib/ai/agents/` - All agent implementations (EventEmitters)
- `server.js` - Socket.IO integration with SessionContext

**For questions about patterns or missing documentation, check README.md or ask for clarification.**
