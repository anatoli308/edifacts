# Copilot Coding Agent Instructions for EDIFACTS

## Project Overview
EDIFACTS is a Next.js/React web app for analyzing, explaining, and managing EDIFACT data with an AI chat assistant. It combines an open-source EDIFACT core (parsing, validation, normalization) with an optional LLM-based explanation layer, supporting both "bring your own key" and managed vLLM backends. The platform is SaaS-ready, modular, and designed for extensibility and enterprise use.

## Architecture & Key Patterns

### Layered Design
- **Core (Deterministic):** EDIFACT parser/validator (no LLM dependency). Normalizes to JSON, detects subsets, enforces rules. See `_workers/` and backend logic. **Single source of truth for domain semantics.**
- **Explanation Engine:** Adapter pattern for LLM providers (OpenAI, Anthropic, Azure, local vLLM, etc). Interface: `explainSegment`, `explainMessage`, `answerQuestion`. User selects provider and supplies own API key.
- **Agentic AI Layer:** Provider-agnostic agent orchestration:
  - **Router Agent:** Intent classification (analysis, debugging, planning, coding, compliance).
  - **Planner Agent:** Hierarchical task decomposition (HTN style).
  - **Executor Agent:** ReAct loops with tool calling.
  - **Critic Agent:** Validation, consistency checks, hallucination detection.
  - **Memory Agent:** Conversational context + long-term knowledge retrieval.
  - **Recovery Agent:** Fallbacks, retries, provider switching.
  - **Coordinator:** DAG scheduling for parallel subtasks.
- **Service Layer:** Managed vLLM (hosted or on-prem) is optional and monetized via support/enterprise features. Core remains open source; commercial features (audit logs, SAP helpers, etc) are kept separate.

### Agent Execution Loop
```
User Goal
  ↓
Router (Intent Classification)
  ↓
Planner → Hierarchical Task Tree (HTN)
  ↓
Coordinator (DAG Scheduler)
  ↓
Executor → Tool Calls (ReAct)
  ↓
Observation (Tool Results)
  ↓
Critic (Validation & Tests)
  ↓
Replan (if inconsistencies detected)
  ↓
Synthesizer → Final Answer
```

**Key Pattern:** Plan → Act → Observe → Replan (interleaved).

- **App Structure:**
  - `app/` (Next.js App Router): Feature-based pages, API routes, UI components.
  - `models/`, `lib/`, `theme/`, `public/`, `uploads/`, `server.js`: See README for details.
- **State Management:**
  - React Contexts in `_contexts/` for user, theme, socket. Custom hooks in `_hooks/` for auth/session.
- **Authentication:**
  - JWT in HTTP-only cookies (SameSite=Strict). Middleware (`proxy.js`, `socketproxy.js`) for HTTP and WebSocket auth. Max 2 device tokens per user.
- **Theming:**
  - MUI v7, custom themes in `theme/`, user preferences in MongoDB or localStorage.
- **EDIFACT Processing:**
  - File upload, custom text input, backend parsing in `_workers/`, real-time status via Socket.IO.

### Universal Tool Calling Contract

All tools are provider-neutral:

```js
interface UniversalTool {
  name: string
  description: string
  inputSchema: JSONSchema
  execute(args: any, ctx: AgentContext): Promise<any>
}

interface UniversalToolCall {
  tool: string
  arguments: Record<string, any>
}
```

Provider adapters (`lib/ai/providers/`) translate to native formats:
- **OpenAI/Azure/vLLM:** `tools[]`, `tool_calls[]`, `role=tool`
- **Anthropic:** `tools[]`, `content.type=tool_use`, `tool_result` blocks

Adapters handle: JSON schema mapping, streaming deltas, partial JSON recovery, parallel vs. sequential execution.

## Extensibility & Product Logic

### LLM & Agent Design
- **Provider Agnostic:** Add new LLM providers by implementing the provider adapter interface in `lib/ai/providers/`. No agent logic inside adapters.
- **Agent Framework:** Agents are pluggable; implement the `Agent` interface to extend with new capabilities (Router, Planner, Executor, Critic, Memory, Recovery, custom agents).
- **Tool Registry:** New tools are registered in `lib/ai/tools/registry.js`; no hardcoding of tool calls in agents.

### BYO-Key & Monetization
- **User Keys (Default):** Users supply their own OpenAI, Anthropic, etc. API keys at no cost. Agents work identically across providers.
- **Managed vLLM (Enterprise):** Hosted or on-prem vLLM is a paid add-on for users who prefer not to supply their own keys.
  - Service Tiers: Bronze (BYOK only), Silver (vLLM + audit logs), Gold (on-prem, advanced compliance, SLA).
- **Open Core, Commercial Add-ons:**
  - Core parser, subset detection, rule engine are always open source.
  - Agentic orchestration is open source; enterprise features (audit trails, role-based tool access, custom agents) are not.

## Complete Project Structure

```
edifacts/
├── app/                              # Next.js App Router
│   ├── api/                          # API Routes
│   │   ├── agents/                   # Agent orchestration (multi-domain)
│   │   │   ├── route.js              # POST /api/agents (main endpoint)
│   │   │   ├── index.js              # Utilities & helpers
│   │   │   ├── validateRequest.js    # Request validation
│   │   │   └── logging.js            # GDPR-compliant audit logging
│   │   ├── auth/                     # Authentication routes
│   │   ├── generate/session/         # EDIFACT session generation
│   │   └── user/                     # User management
│   ├── a/[sessionId]/                # EDIFACT analysis chat pages
│   ├── auth/                         # Auth pages (login, register)
│   ├── _components/                  # Reusable UI components
│   │   ├── chat/                     # Chat UI (messages, tool calls, reasoning)
│   │   ├── dialogs/                  # Settings, data control dialogs
│   │   ├── layout/                   # AppBar, Drawer, Navigation
│   │   ├── start/                    # File upload, custom input
│   │   └── utils/                    # Icons, constants
│   ├── _containers/                  # Page-level containers
│   │   ├── AnalysisChatPage.js       # EDIFACT chat container
│   │   ├── StartContainer.js         # EDIFACT file upload
│   │   ├── LoginContainer.js         # Login page
│   │   ├── RegisterContainer.js      # Register page
│   │   └── AccountContainer.js       # Account settings
│   ├── _contexts/                    # React Contexts
│   │   ├── UserContext.js            # User state
│   │   ├── SocketContext.js          # Socket.IO connection
│   │   ├── ThemeContext.js           # Theme preferences
│   │   └── SnackbarContext.js        # Notifications
│   └── _hooks/                       # Custom React hooks
│       ├── useProtectedRoute.js      # Auth guard
│       └── useAlreadyAuthenticatedRoute.js
├── lib/                              # Core libraries
│   ├── ai/                           # Agent Core (domain-agnostic, reusable)
│   │   ├── agents/                   # Agent implementations
│   │   │   ├── router.js             # Intent classification
│   │   │   ├── planner.js            # HTN task decomposition
│   │   │   ├── executor.js           # ReAct loops with tool calling
│   │   │   ├── critic.js             # Validation & hallucination detection
│   │   │   ├── memory.js             # Context management
│   │   │   ├── recovery.js           # Failure handling & fallback
│   │   │   └── index.js              # Agent registry
│   │   ├── providers/                # LLM provider adapters
│   │   │   ├── openai.js             # OpenAI adapter (parallel tools)
│   │   │   ├── anthropic.js          # Anthropic adapter (sequential tools)
│   │   │   └── index.js              # Provider factory
│   │   ├── orchestration/            # Task coordination
│   │   │   ├── scheduler.js          # DAG task scheduler
│   │   │   ├── taskGraph.js          # Dependency resolution
│   │   │   ├── replay.js             # Execution replay & audit
│   │   │   └── index.js
│   │   ├── tools/                    # Tool management
│   │   │   ├── registry.js           # Central tool registry
│   │   │   └── index.js
│   │   ├── prompts/                  # Agent system prompts
│   │   │   ├── router.md             # Router agent prompt
│   │   │   ├── planner.md            # Planner agent prompt
│   │   │   ├── executor.md           # Executor agent prompt
│   │   │   ├── critic.md             # Critic agent prompt
│   │   │   └── index.js              # Prompt loader
│   │   └── config/                   # Configuration
│   │       ├── agents.config.js      # Agent parameters (temp, timeouts)
│   │       ├── providers.config.js   # Provider capabilities & tiers
│   │       └── index.js
│   ├── auth.js                       # Authentication utilities
│   └── dbConnect.js                  # MongoDB connection
├── models/                           # Mongoose models
│   ├── User.js                       # User accounts
│   ├── ApiKey.js                     # User API keys (BYOK)
│   ├── File.js                       # Uploaded files
│   ├── PromptPreset.js               # Prompt templates
│   ├── AnalysisChat.js               # EDIFACT chat sessions
│   ├── AnalysisMessage.js            # Chat messages (with agentPlan, toolCalls)
│   └── AnalysisMessageChunk.js       # Streaming chunks
├── _modules/                         # Domain-specific modules
│   └── edifact/                      # EDIFACT domain
│       ├── index.js                  # Module entry point
│       ├── context.js                # LLM context builder
│       ├── tools/                    # EDIFACT tools
│       │   ├── segmentTools.js       # Segment analysis
│       │   ├── validationTools.js    # Rule validation
│       │   └── index.js
│       └── validators/               # EDIFACT validators
│           ├── edifactValidator.js   # Validation pipeline
│           ├── rules.js              # Rule engine
│           └── index.js
├── _workers/                         # Backend workers
│   └── edifactParser.worker.js       # EDIFACT parsing (deterministic)
├── __tests__/                        # Test suite
│   ├── setup.js                      # Test configuration
│   ├── lib/ai/agents/                # Agent tests
│   ├── lib/ai/tools/                 # Tool tests
│   └── _modules/edifact/             # EDIFACT tests
├── theme/                            # MUI theme
│   ├── index.js                      # Theme provider
│   ├── palette.js                    # Color palettes
│   ├── typography.js                 # Typography styles
│   └── overrides/                    # Component overrides
├── public/                           # Static assets
├── uploads/                          # User uploads
├── server.js                         # Custom Express + Socket.IO server
├── proxy.js                          # HTTP auth middleware
├── socketproxy.js                    # WebSocket auth middleware
├── package.json                      # Dependencies
└── jsconfig.json                     # Path aliases (@/app/*)
```

## Project-Specific Conventions
- **Path Aliases:** Use `@/app/*` (see `jsconfig.json`).
- **Component Structure:**
  - UI: `app/_components/`
  - Layouts: `app/_containers/`, `app/layout.js`
  - Contexts: `app/_contexts/`

## Multi-Domain Architecture

EDIFACTS is designed to scale from EDIFACT to any domain (Twitter, ERP, DevOps, Finance, Legal, etc.) without rewriting the Agent Core. Here's the architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EDIFACTS Multi-Domain Platform                   │
│                   (Today: EDIFACT, Tomorrow: X)                     │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      SHARED AGENT CORE (100% Reusable)           │
│  (Never changes, works with any domain module)                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  lib/ai/agents/           │  lib/ai/providers/      │ lib/ai/   │
│  ├── router.js            │  ├── openai.js          │ orchest-  │
│  ├── planner.js           │  ├── anthropic.js       │ ration/   │
│  ├── executor.js          │  ├── vllm.js            │ ├── sch-  │
│  ├── critic.js            │  └── index.js           │ │  eduler │
│  ├── memory.js            │  (Pluggable adapters,   │ ├── task- │
│  ├── recovery.js          │   no agent logic)       │ │  graph  │
│  └── index.js             │                         │ └── rep-  │
│                           │                         │    lay    │
│ Router → Planner → Executor → Critic → Recovery    │           │
│ (Dialog flow, 100% independent of domain)          │           │
│                                                     │           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    DOMAIN-SPECIFIC MODULES                       │
│           (Plug-and-Play, no changes to Agent Core)             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  _modules/edifact/           _modules/twitter/      _modules/   │
│  ├── index.js                ├── index.js            erp/        │
│  ├── context.js              ├── context.js          ├── tools/  │
│  ├── tools/                  ├── tools/              ├── valid-  │
│  │  ├── segmentTools.js      │  ├── tweetAnalysis   │  ators/   │
│  │  ├── validationTools.js   │  ├── sentimentTools   │  └── ...  │
│  │  └── index.js             │  └── index.js                     │
│  └── validators/             └── validators/         (Future)   │
│     ├── edifactValidator.js     ├── twitterValid.js             │
│     ├── rules.js                └── rules.js                    │
│     └── index.js                └── index.js                    │
│                                                                  │
│ ✓ Each module is self-contained                                 │
│ ✓ All modules use the same Agent Core                          │
│ ✓ Router automatically selects correct module                   │
│ ✓ New modules don't affect existing ones                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    SHARED MODELS & UI                            │
│            (Reusable across all domain modules)                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  models/                          app/_components/              │
│  ├── shared/                      ├── chat/                     │
│  │   ├── User.js                  │   ├── ChatMessage.js        │
│  │   ├── ApiKey.js                │   ├── ChatMessageContent    │
│  │   └── ...                      │   └── ...                   │
│  ├── edifact/                     └── layout/                   │
│  │   ├── AnalysisChat.js             (Reusable UI components)   │
│  │   ├── AnalysisMessage.js                                     │
│  │   └── ...                                                    │
│  └── (twitter/, erp/, ... in future)                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### How It Works

1. **User Message** → Router Agent classifies intent
2. **Router decides** → "This is EDIFACT" or "This is Twitter" or "This is ERP"
3. **Planner Agent** → Decomposes goal (domain-agnostic)
4. **Executor calls** → Module-specific tools (e.g., `edifactTools.segmentAnalyze()`)
5. **Critic validates** → Module-specific validators (e.g., `edifactValidator.validateRules()`)
6. **Synthesis** → LLM generates answer using module context

### Key Benefits

| Aspect | Benefit |
|--------|---------|
| **No duplication** | Agent Core written once, used by all modules |
| **Isolation** | New domain = new folder, zero risk to existing code |
| **Scalability** | Add 10 more domains without touching Agent Core |
| **Testing** | Each module tested independently |
| **Deployment** | Deploy EDIFACT separately from Twitter module |
| **Team scaling** | One team on EDIFACT, another on Twitter, no conflicts |

### Deployment Strategy

**Current App (EDIFACTS):**
- This app is **EDIFACT-only** - all UI, routes, and models are EDIFACT-specific
- The Agent Core (`lib/ai/`) is **domain-agnostic** and reusable
- Future domains (Twitter, ERP) will be **separate Next.js apps**

**Future Apps (Twitter, ERP, etc.):**
- New apps connect via `/api/agents` endpoint (multi-domain ready)
- OR: Extract `lib/ai/` as NPM package (`@edifacts/agent-core`) and import directly
- Each app has its own database, models, and domain modules
- All apps share the same Agent Core logic (Router, Planner, Executor, Critic)
- **Agentic AI:**
  - Agents: `lib/ai/agents/` (router.js, planner.js, executor.js, critic.js, memory.js, recovery.js, index.js)
  - Providers: `lib/ai/providers/` (openai.js, anthropic.js, index.js) - vLLM future
  - Orchestration: `lib/ai/orchestration/` (scheduler.js, taskGraph.js, replay.js, index.js)
  - Tools: `lib/ai/tools/` (registry.js, index.js) - Central tool registry for all domain modules
  - Prompts: `lib/ai/prompts/` (router.md, planner.md, executor.md, critic.md, index.js)
  - Config: `lib/ai/config/` (agents.config.js, providers.config.js, index.js)
- **API:**
  - Next.js API routes in `app/api/`.
  - Auth/session logic in `app/api/auth/` and `app/api/generate/session/`.
  - Agent orchestration: `app/api/agents/` (route.js, index.js, validateRequest.js, logging.js)
    - POST `/api/agents` - Main agent invocation endpoint (multi-domain ready)
    - Utilities for validation, error handling, GDPR-compliant logging
    - Support for all agents (router, planner, executor, critic, memory, recovery)
- **Models:**
  - Current structure: Flat (all models in `models/` root)
  - Core models: `User.js`, `ApiKey.js`, `File.js`, `PromptPreset.js` (shared)
  - EDIFACT models: `AnalysisChat.js`, `AnalysisMessage.js`, `AnalysisMessageChunk.js`
  - Agent fields in `AnalysisMessage.js`: 
    - `agentPlan` (Object) - HTN task tree from Planner
    - `toolCalls[]` (Array) - { tool, arguments, timestamp }
    - `toolResults[]` (Array) - { tool, result, success, duration_ms }
  - **Recommended structure** (for later refactoring or when extracting lib/ai/ as package):
    - `models/shared/` - User, ApiKey, File, PromptPreset, agentMessageFields.js (DRY helper)
    - `models/edifact/` - AnalysisChat, AnalysisMessage, AnalysisMessageChunk
    - Future domains (twitter, erp) get their own model folders
- **Socket.IO:**
  - Auth via `authToken` cookie. Connection state in context, shown in AppBar.
  - New event types: `agent:plan`, `agent:step`, `agent:tool_call`, `agent:observation`.
- **Theme:**
  - All theme logic in `theme/`, MUI overrides in `theme/overrides/`.

## Integration Points
- **MongoDB:** via Mongoose (`models/`, `lib/dbConnect.js`).
- **Socket.IO:** via `server.js` and `socketproxy.js`.
- **EDIFACT Parsing:** via backend workers in `_workers/`.

## Workflow: AnalysisChat (End-to-End)
This workflow powers the core chat and analysis experience:
Requirements: User is authenticated; EDIFACT file is uploaded/selected. An API key is provided (BYO-Key) or managed vLLM is enabled.

1. **Chat Creation:**
  - User creates a chat with domain context (EDIFACT file, subset, version, prompt preferences, LLM provider/model).
  - User is redirected to analysis chat page (`/a/[sessionId]`).
2. **EDIFACT Parsing:**
  - File is parsed/validated. Results (segments, errors, summary, etc.) are stored in `analysis` and a compact `llmContext` for prompt efficiency.
  - User sees real-time status updates for parsing/validation via Socket.IO.
  - User gets a summary of the analysis once complete.
3. **User Message:**
  - User submits a message (e.g., "Bitte analysiere diese Invoice und gib mir alle Fehler.").
4. **Agent Routing:**
  - Router Agent classifies intent and selects the appropriate agent pipeline.
  - For simple explanations: direct to Explanation Engine (fast path).
  - For complex analysis/planning: invoke Planner → Executor → Critic loop.
5. **LLM Response & Tool Calls:**
  - Assistant message is created. LLM response is streamed in chunks (AnalysisMessageChunk).
  - If agents are active: tool calls are recorded, executed, and results fed back to LLM (ReAct loop).
  - Streaming shown live via WebSocket.
6. **Prompt Assembly:**
  - LLM receives: (1) System prompt (system-preset + user-personalized), (2) Domain context (EDIFACT/llmContext), (3) Message history (LLM-friendly), (4) Agent plan (if applicable).
7. **Chat Continuation:**
  - New user/assistant messages extend the chat. Agent plan and tool results are persisted for replay.
  - Domain context can be updated if file/analysis changes.
8. **Model Switching:**
  - Model is fixed per chat. Switching models = new chat (recommended for reproducibility).

**Key Patterns:**
- Strict separation of domain context, prompt, messages, and agent state for reproducibility.
- Streaming/chunked LLM responses for real-time UX.
- **All state persisted:** analysis, context, messages, chunks, agent plans, tool calls, tool results.
- Fast path for simple explanations; agent pipeline for complex tasks.
- Agent state replayable for debugging and compliance export.

## Implementation Roadmap

Introduce agentic architecture **incrementally** to minimize risk and maintain stability:

### Phase 1 (MVP – Planner Only)
- [ ] Implement Provider Adapter abstraction in `lib/ai/providers/` (universal tool contract).
- [ ] Build Router Agent: intent classification (simple heuristics or few-shot prompting).
- [ ] Build Planner Agent: decompose user goal into task tree (HTN-inspired, JSON output).
- [ ] Persist agent plan in `AnalysisChat` model as `agentPlan` field.
- [ ] **Fast path for simple queries:** Skip agent pipeline; use direct Explanation Engine.
- [ ] Test: Unit tests for planner outputs; E2E tests for multi-turn conversations.

### Phase 2 (Executor & Tools)
- [ ] Define Tool Registry in `lib/ai/tools/registry.js` with EDIFACT-specific tools (segment analysis, rule validation, etc).
- [ ] Build Executor Agent: ReAct loop (Thought → Tool Call → Observation).
- [ ] Implement tool sandboxing: tools execute in isolated context, no direct DB access.
- [ ] Persist `toolCalls[]` and `toolResults[]` in `AnalysisMessage.js`.
- [ ] Stream tool calls and results via Socket.IO.
- [ ] Test: Mock tools; validate tool call arguments; test streaming.

### Phase 3 (Critic & Recovery)
- [ ] Build Critic Agent: validate outputs against schemas, EDIFACT rules, test suites.
- [ ] Implement Recovery Agent: retry logic, provider fallback (vLLM → OpenAI → local).
- [ ] Detect hallucinations (fact-check LLM output against deterministic core).
- [ ] Add conditional replanning on critic feedback.
- [ ] Test: Adversarial prompt injection; failure injection; fallback scenarios.

### Phase 4 (Memory & Coordinator)
- [ ] Build Memory Agent: manage conversation history, retrieve long-term context.
- [ ] Implement Coordinator: DAG scheduler for parallel subtasks (optional for MVP).
- [ ] Add vector DB integration for semantic memory (optional).
- [ ] Test: Memory retrieval accuracy; parallel task execution.

### Phase 5 (Enterprise & Audit)
- [ ] Full replay capability: serialize/deserialize agent state.
- [ ] Audit logging: all agent decisions, tool calls, model outputs (GDPR-compliant).
- [ ] Export compliance reports (with customer data redaction).
- [ ] Role-based tool access (Silver tier: all tools; Bronze: subset).

## Testing & Quality Assurance

### Test Structure
```
__tests__/
├── setup.js                           ← Common test setup, mocks, fixtures
├── lib/
│   └── ai/
│       ├── agents/
│       │   ├── router.test.js         ← Intent classification tests
│       │   └── planner.test.js        ← Task decomposition tests
│       └── tools/
│           └── registry.test.js       ← Tool registration/validation tests
└── _modules/
    └── edifact/
        └── validators/
            └── edifactValidator.test.js ← EDIFACT validation tests
```

### Test Coverage Requirements
- **Agent Tests:** Mock LLM responses, validate intent classification, task trees, tool selection
- **Tool Tests:** Validate tool schemas, argument validation, execution sandboxing
- **Provider Tests:** Test adapter format conversion (OpenAI ↔ Anthropic), streaming, error handling
- **Integration Tests:** E2E agent pipeline (Router → Planner → Executor → Critic)
- **EDIFACT Tests:** Regression tests for parser, validation rules, subset detection

---

See also:
- `app/_contexts/UserContext.js` for user state logic
- `app/api/auth/login/route.js` for login flow
- `app/api/agents/route.js` for agent orchestration API
- `lib/ai/tools/registry.js` for tool registration
- `lib/ai/config/` for agent and provider configuration
- `lib/ai/prompts/` for agent system prompts
- `_modules/edifact/` for EDIFACT domain module
- `theme/index.js` for theme provider setup
- `server.js` for custom server and Socket.IO integration

## Coding Rules for Agentic Development

1. **Never Mix Layers**
   - No EDIFACT business rules in agents; agents may *explain* or *suggest*, never *decide*.
   - No agent logic inside provider adapters (adapters are transport only).
   - No LLM calls inside the deterministic core (`_workers/`, models/).
   - No direct DB access from agents; use deterministic tool interfaces.

2. **Interfaces Over Frameworks**
   - Do not hard-wire LangChain, Autogen, or similar frameworks.
   - Keep providers, tools, agents, and orchestrators pluggable via interfaces.
   - Provider adapters are thin; agent orchestration is custom.

3. **Deterministic Tools**
   - Pure functions: same input → same output.
   - Explicit JSON Schemas (no inference).
   - No hidden side effects; log all mutations.
   - Validate tool arguments before execution.

4. **Stateless Agents**
   - Agents are functions; state is managed by Coordinator and Memory layers.
   - Agent decisions must be reproducible given the same context and random seed.

5. **Security**
   - No API keys in logs or traces; redact in audit logs.
   - Tool sandboxing: each tool runs in an isolated context; no cross-tool state.
   - Policy checks: role-based tool access (Bronze/Silver/Gold tiers).
   - Validate LLM outputs before execution (Critic Agent is mandatory for system-modifying tools).

6. **Enterprise Readiness**
   - GDPR compliant: audit logs with data redaction, user consent for tracing.
   - No training on customer data (unless explicitly opted-in; defaults to no).
   - Configurable data retention: on-prem, managed, air-gapped.
   - Replaying agent state must not leak sensitive data (redact in UI, not DB).

7. **Testing & Validation**
   - Unit tests for agents (mock LLMs, deterministic prompts).
   - Integration tests for tool execution and provider adapters.
   - E2E tests for multi-turn workflows (AnalysisChat).
   - Regression tests for EDIFACT parsing (core must remain stable).
   - Adversarial tests: prompt injection, tool argument manipulation, provider failures.

## Strategic Notes
- **Product = Platform:** EDIFACT core is always open, LLM/AI is an explainability layer, not a black box. Monetization is via managed LLM, support, and enterprise features.
- **Adapter Pattern:** Explanation Engine is pluggable; new LLMs can be added without changing the core.
- **BYO-Key First:** Default is user-supplied API key; managed vLLM is a paid convenience/enterprise option.
- **Separation of Concerns:** Core parsing/validation is deterministic and testable; AI/LLM only explains, never decides business logic.
- **Service Tiers:**
  - Bronze: BYO-Key, basic features.
  - Silver: Managed vLLM with limits, audit logs.
  - Gold: On-prem vLLM, advanced compliance, SLA.
- **Legal/Compliance:** No customer data is used for LLM training if wished; BYO-Key means no data retention by default. Managed LLMs must be contractually clear on data handling.
- **Extensibility:** Designed for easy addition of new LLM providers, EDIFACT subsets, and custom rules without changing core logic.
- **DSGVO/GDPR:** User data is stored securely; cookies are HTTP-only and SameSite=Strict. Users can delete their data. Chat logs are stored for auditability but can be purged per user request.

## Strategic Principle: Domain-First Agent Design

EDIFACTS follows **Domain-First Agent Design**:

- The EDIFACT engine is the **single source of truth** for domain semantics.
- LLMs are **explainers, planners, and orchestrators** – never authorities on business rules.
- The agentic layer must remain:
  - **Provider-agnostic** (swap OpenAI ↔ Anthropic ↔ vLLM without changing agent logic)
  - **Deterministic in control flow** (reproducible execution, no hidden randomness)
  - **Auditable** (every agent step, tool call, and LLM prompt is persistable and replayable)
  - **Enterprise-grade** (GDPR-compliant, role-based access, audit logs with data redaction)
  - **Ready for on-prem, regulated, and air-gapped deployments**

This ensures EDIFACTS remains a trustworthy platform for regulated industries (DSGVO, compliance, financial audit) while leveraging AI for productivity and insight.

EDIFACTS
 ├─ Core (Deterministic EDIFACT Engine)
 ├─ Agent OS
 │   ├─ Planner (HTN, Divide & Conquer)
 │   ├─ Executor (ReAct, Tool Calling)
 │   ├─ Critic (Validation, Compliance)
 │   ├─ Memory (Vector + Episodic)
 │   ├─ Tool Registry (Universal Schema)
 │   ├─ Provider Adapters (OpenAI, Anthropic, vLLM, Azure)
 │   └─ Audit / Replay / Trace
 ├─ UI (Next.js Agent Inspector)
 └─ Enterprise Layer (SSO, DSGVO, On-Prem, Airgap)

---
For questions about unclear patterns or missing documentation, ask for clarification or check `README.md` for more details.


