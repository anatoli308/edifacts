<div align="center">

# 🤖 EDIFACTS

### Event-Driven Agentic Workflow Platform for Intelligent EDIFACT Analysis

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-blue)](https://socket.io/)

**Transform complex EDI data into actionable insights with AI-powered sequential agent orchestration**

[Features](#key-features) • [Quick Start](#docker-setup-development) • [Architecture](#development-features) • [Roadmap](#️-roadmap) • [Documentation](#project-structure)

---

</div>

## 🚀 What is EDIFACTS?

EDIFACTS is an **intelligent AgentOS platform** that revolutionizes EDIFACT analysis through **event-driven agentic workflow orchestration**. Built on Next.js and powered by real-time WebSocket streaming, it combines:

- 🧠 **Sequential Agent Pipeline**: Planner → Scheduler → Executor → Critic agents working in coordinated workflow
- ⚡ **Event-Driven Architecture**: EventEmitter-based communication for decoupled, observable agent coordination
- 🔄 **Real-Time Streaming**: Live reasoning, tool calls, and progress tracking with WebSocket integration
- 🔒 **BYOK (Bring Your Own Key)**: Use your own OpenAI or Anthropic API key—full control, zero vendor lock-in
- 🎯 **Deterministic Core**: Open-source EDIFACT parser/validator as single source of truth
- 🏢 **Enterprise-Ready**: JWT auth, multi-user support, audit trails, GDPR compliance

> **🚀 Future Vision:** Evolving toward true multi-agent architecture with parallel execution, autonomous recovery, and competitive reasoning (see [Roadmap](#roadmap)).

**For developers, analysts, and enterprises who demand both transparency and automation.**

## ✨ Key Features

🤖 **Agentic Workflow System (EventEmitter-Based)**
- **Current:** Sequential agent pipeline (Planner → Scheduler → Executor → Critic)
- **Future:** Hybrid multi-agent with parallel execution, specialized agent pools, autonomous recovery
- Hierarchical task planning with dependency injection
- DAG-based task scheduling (with future State Machine support. preparing for parallel execution)
- ReAct loops with tool calling (11+ domain tools)
- Validation & hallucination detection

⚡ **Real-Time Streaming**
- Live reasoning and progress updates (`agent:reasoning`, `agent:plan`, `agent:tool_call`)
- SessionContext pattern for memory-leak-free event relay
- Automatic agent state reset before execution

🔐 **Bring Your Own Key (BYOK)**
- OpenAI & Anthropic support (Azure, vLLM coming soon)
- Universal tool contract (provider-agnostic)
- Your API keys, your data, your control

🎨 **Developer Experience**
- Clean Code Standards (SOLID, DRY, SRP)
- Dependency Injection pattern throughout
- EventEmitter architecture for testability
- Comprehensive TypeScript support

📊 **EDIFACT Processing**
- Deterministic parsing & validation
- Subset detection (EANCOM, ODETTE, HIPAA, etc.)
- File upload with drag-and-drop
- Custom text input support

## Requirements
- Node.js (version 18 or higher) ideally latest stable version
- npm (version 8 or higher) ideally latest stable version
- MongoDB instance (local or cloud-based) ideally latest stable version.
- For now: ollama (local LLM hosting) if you want to use vLLM provider https://ollama.com/

## Docker Setup (Development)
1. Make sure Docker and Docker Compose are installed on your machine.
2. Clone the repository:
   ```bash
      git clone https://github.com/anatoli308/edifacts
      cd edifacts
    ```
3. Create a `.env.docker` file in the root directory (look at `.env.example` for reference)
4. Start the services using Docker Compose:
   ```bash
      docker-compose up --build -d
   ```
5. Sign in to ollama:
   ```bash
      docker exec -it edifacts-ollama-1 ollama signin
   ```
6. You will get a link to authenticate your ollama account. Follow the link and complete the sign-in process.
    - ollama running on `gpt-oss:120b-cloud` model by default!
    - you can change to a local model in `ollama_entrypoint.sh` without signin but this require alot of disk space and setup.
7. Open your browser and navigate to `http://localhost:3010` to access the application.


## Technology Stack
- Next / React 
- Material-UI (MUI) 
- MongoDB / Mongoose
- Node.js / Express.js
- WebSocket / Socket.IO

## Installation
1. Clone the repository:
   ```bash
      git clone https://github.com/anatoli308/edifacts
      cd edifacts
      npm install
   ```

4. Set up environment variables:
   Create a `.env` file in the root directory (look at `.env.example` for reference)

5. Run the development server:
   ```bash
     npm run dev
   ```

6. Build and run for production:
  - Make sure `NODE_ENV=production` is set in your `.env` file.
   ```bash
     npm run build
     npm start
   ```

7. Open your browser and navigate to `http://localhost:3010` to access the application.

8. Use inside pm2: (easy optional way for production deployments)
   ```bash
      npm install -g pm2
      pm2 start npm --name edifacts -- run start
   ```

## Project Structure
```
app/                       # Next.js App Router structure
├── _components/           # Reusable UI components
│   ├── chat/              # Chat components (messages, typing indicator, etc)
│   ├── dialogs/           # Settings and data control dialogs
│   ├── layout/            # AppBar, Drawer, Navigation
│   └── utils/             # Icons, constants
├── _contexts/             # React Context providers
│   ├── UserContext.js     # User authentication & profile
│   ├── SocketContext.js   # WebSocket connection management
│   ├── ThemeContext.js    # MUI theme preferences
│   └── SnackbarContext.js # Global notifications
├── _containers/           # Page containers/layouts
│   ├── AnalysisChatPage.js # EDIFACT analysis chat
│   ├── StartContainer.js  # File upload & input
│   └── AccountContainer.js # User settings
├── _hooks/                # Custom client hooks
│   ├── useAgentStreaming.js # Agent event streaming
│   ├── useProtectedRoute.js # Auth guards
│   └── useAlreadyAuthenticatedRoute.js
├── api/                   # Next.js API routes
│   ├── auth/              # Login, register, logout
│   ├── generate/session/  # EDIFACT session creation
│   └── user/              # User management
├── auth/                  # Auth pages (login, register, account)
├── a/[sessionId]/         # EDIFACT analysis chat pages
├── layout.js              # Root layout with Providers wrapper
└── page.js                # Root Home page

lib/                       # Library utilities & helpers
├── dbConnect.js           # MongoDB connection utility
├── auth.js                # JWT authentication utilities
├── ai/                    # Agentic AI Core (domain-agnostic, EventEmitter-based)
│   ├── agents/            # Agent implementations (ALL EventEmitters)
│   │   ├── planner.js     # HTN task decomposition (EventEmitter)
│   │   ├── executor.js    # ReAct loop with tool calling (EventEmitter)
│   │   ├── critic.js      # Validation & consistency checks (EventEmitter)
│   │   ├── memory.js      # Context management (EventEmitter, planned)
│   │   ├── recovery.js    # Failure handling (EventEmitter, planned)
│   │   └── index.js       # Agent registry (loadAgent factory)
│   ├── providers/         # LLM provider adapters (NO agent logic)
│   │   ├── openai.js      # OpenAI adapter
│   │   ├── anthropic.js   # Anthropic adapter
│   │   └── index.js       # Provider factory
│   ├── orchestration/     # Task coordination
│   │   ├── agentOrchestrator.js # Planner → Scheduler coordinator (EventEmitter)
│   │   ├── scheduler.js   # DAG task execution (EventEmitter, future FSM)
│   │   └── index.js
│   ├── tools/             # Tool management
│   │   ├── registry.js    # Central tool registry
│   │   ├── validateToolContract.js # Tool validation
│   │   └── index.js
│   ├── prompts/           # Agent system prompts
│   │   ├── planner.md     # Planner decomposition prompt
│   │   ├── executor.md    # Executor ReAct prompt
│   │   ├── critic.md      # Critic validation prompt
│   │   └── index.js       # Prompt loader
│   └── config/            # Agent configuration
│       ├── providers.config.js # Provider capabilities
│       └── index.js
├── socket/                # WebSocket layer (EventEmitter integration)
│   ├── handlers/
│   │   └── agentHandlers.js # Agent invocation handlers
│   ├── sessionContext.js  # SessionContext (DI + event relay)
│   └── utils/
│       └── messageUtils.js # Message preparation utilities

_modules/                  # Domain-specific modules
├── edifact/               # EDIFACT domain module
│   ├── index.js           # Module entry point
│   ├── context.js         # LLM context builder
│   ├── tools/             # EDIFACT-specific tools
│   │   ├── segmentTools.js     # Segment analysis
│   │   ├── validationTools.js  # Rule validation
│   │   └── index.js
│   └── validators/        # EDIFACT validators
│       ├── edifactValidator.js # Validation pipeline
│       ├── rules.js       # Rule engine
│       └── index.js
└── utility/               # Utility tools (weather, etc)
    └── tools/
        ├── webTools.js    # Web-based tools
        └── index.js

_workers/                  # Backend workers
└── edifactParser.worker.js # EDIFACT parsing (deterministic)

models/                    # Mongoose ODM models
├── shared/                # Shared models (recommended structure)
│   ├── User.js            # User authentication & profile
│   ├── ApiKey.js          # BYOK API keys (encrypted)
│   └── File.js            # File uploads
└── edifact/               # EDIFACT-specific models
    ├── AnalysisChat.js    # Chat sessions (with agentPlan)
    ├── AnalysisMessage.js # Messages (with toolCalls[], toolResults[])
    └── AnalysisMessageChunk.js # Streaming chunks

theme/                     # MUI theme configurations
├── colors.js              # Font color definitions
├── backgroundModes.js     # Theme background mode definitions
├── palette.js             # MUI palette theme
├── shadows.js             # MUI shadow definitions
├── typography.js          # Typography definitions
├── index.js               # Theme provider wrapper
└── overrides/             # MUI component overrides

public/                    # Static assets
uploads/                   # Directory for runtime uploads

server.js                  # Express server with Socket.IO & Next.js integration
.env.example               # Example environment variables
docker-compose.yml         # Docker compose for development
jsconfig.json              # Module path aliases
package.json               # Project dependencies & scripts
proxy.js                   # Next.js Route middleware for authentication
socketproxy.js             # Socket.IO middleware for authentication
```

## Development Features
- **Authentication & Authorization**
   - User registration and login with JWT-based authentication
   - Secure password hashing with bcryptjs
   - HTTP-only cookies for secure token storage (SameSite=Strict)
   - Server-side route protection with Next.js middleware (proxy.js)
   - Client-side navigation guards with custom hooks
   - Token verification in middleware (jose) and API routes
   - Multi-device token management (max 2 devices configured)
  
- **User Management**
  - User profiles with customizable settings
  - Theme preferences (font color, background mode, font size)
  - Persistent theme storage (localStorage for guests, MongoDB for users)
  - Account ban capability
  - Email validation with validator.js
  - Terms of Service acceptance tracking

- **State Management**
  - React Context API for global state (UserContext, ThemeContext, SocketContext)
  - Custom hooks for reusable logic
  - Session persistence across page reloads
  - Automatic theme synchronization with user settings

- **Theming & UI**
  - Light, Dim, and Dark theme support
  - Customizable font colors and font sizes
  - MUI component overrides with theme customization
  - Material-UI v7 with responsive design
  - Splash screen with minimum loading time for improved UX
  - Dynamic theme synchronization with user preferences

- **Routing & Navigation**
  - Next.js App Router for modern file-based routing
  - Client-side Link navigation with next/link for faster transitions
  - Module path aliases for cleaner imports (configured in jsconfig.json)
  - Protected routes with automatic redirection (clientside hooks and serverside middleware)

- **API & Backend**
  - Next.js API routes with App Router
  - JWT token validation in middleware(proxy.js) and secured routes
  - User session management
  - RESTful API design
  - Error handling and validation
  - Settings update endpoints (background mode, etc.)
  - EDIFACT file parsing and analyze API endpoint
  - WebSocket support with Socket.IO for real-time status updates

- **EDIFACT Processing & analyze**
  - File upload with drag-and-drop support (Upload Tab)
  - Custom text input with a character limit (Custom Tab)
  - Optional standard EDIFACT subset selection (EANCOM, ODETTE, HIPAA, etc.)
  - File metadata detection (message type, line count, file size)
  - Preview generation from parsed EDIFACT data
  - Backend worker support for heavy parsing operations

- **Agentic AI Layer (EventEmitter Architecture)**
  - **Multi-Agent System:** All agents extend EventEmitter for decoupled communication
  - **Planner Agent:** Hierarchical task decomposition (HTN) - emits `agent_planner:started/completed`
  - **Scheduler:** DAG-based task orchestration with dependency resolution (future State Machine)
  - **Executor Agent:** ReAct loop (Thought → Action → Observation) - emits `agent_executor:tool_call/tool_result/reasoning`
  - **Critic Agent:** Validates task results, checks consistency, detects hallucinations
  - **AgentOrchestrator:** Coordinates Planner → Scheduler flow with dependency injection
  - **SessionContext Pattern:** 
    - Manages all agent instances per socket connection (DI container)
    - Event relay: Agent → SessionContext → Socket.IO
    - Memory leak prevention (listeners registered once in constructor)
    - Lifecycle management (reset before execution, cleanup on disconnect)
  - **Tool System:** Universal tool registry with 11+ tools (getWeather, EDIFACT segment analysis, validation, etc)
  - **Provider Adapters:** OpenAI, Anthropic support with streaming (BYOK - Bring Your Own Key)
  - **Event-Driven Architecture:**
    - Internal events: `agent_{agentName}:{eventType}` (e.g., `agent_planner:started`)
    - Socket events: `agent:{eventType}` (e.g., `agent:plan`, `agent:tool_call`)
    - Declarative event map (EventEmitter Integration)**
  - WebSocket (Socket.IO) integration for live status updates
  - Automatic socket connection on app startup
  - Token-based WebSocket authentication via `authToken` cookie
  - Socket context provider for global access
  - Real-time worker status indication (Connected/Connecting/Disconnected)
  - Status badge in AppBar showing WebSocket connection state
  - Auto-reconnection with exponential backoff
  - **SessionContext Pattern:**
    - One SessionContext instance per socket connection
    - All agents (planner, scheduler, executor, critic) instantiated per session
    - Event relay from agents to socket (declarative mappings)
    - Memory leak prevention (listeners registered once, cleaned up on disconnect)
  - **Agent Event Streaming:**
    - `agent:started` - Agent execution begins
    - `agent:plan` - Task tree emitted after planning (2 events: started/completed)
    - `agent:reasoning` - Internal thoughts streamed during execution
    - `agent:step` - Task progress (
  - Token-based WebSocket authentication via `authToken` cookie
  - Socket context provider for global access
  - Real-time worker status indication (Connected/Connecting/Disconnected)
  - Status badge in AppBar showing WebSocket connection state
  - Auto-reconnection with exponential backoff
  - **Agent Event Streaming:**
    - `agent:started` - Agent execution begins
    - `agent:plan` - Task tree emitted after planning
    - `agent:reasoning` - Internal thoughts streamed during execution
    - `agent:step` - Pipeline progress (planner_started, scheduler_started, task_started, task_completed)
    - `agent:tool_call` - Tool invocation with arguments
    - `agent:tool_result` - Tool execution result with success flag
    - `response:chunk` - Final answer streamed chunk-by-chunk
    - `agent:completed` - Execution finished successfully
    - `agent:failed` - Execution failed with error details
  - **Custom Hooks:**
    - `useAgentStreaming` - Handles all agent events, accumulates reasoning and response chunks
    - `useSocket` - Manages WebSocket connection state
  - **UI Components:**
    - `ChatMessageAssistantTyping` - Shows live reasoning during "thinking"
    - `ChatMessage` - Displays final streamed responses

- **Database**
  - MongoDB with Mongoose ODM
  - User schema with authentication and theme preferences
  - API key storage (encrypted) for BYOK (Bring Your Own Key)
  - Token management with device tracking
  - Chat sessions with agent plans, tool calls, and results persistence
  - Timestamp tracking

- **Provider System & BYOK**
  - **Bring Your Own Key (BYOK):** Users supply their own OpenAI/Anthropic API keys
  - **Universal Tool Contract:** Provider-agnostic tool format `{name, description, inputSchema}`
  - **Provider Adapters:**
    - OpenAI adapter: Parallel tool execution, streaming with `tool_calls[]`
    - Anthropic adapter: Sequential tool execution, `tool_use` blocks
  - **Streaming-Only Architecture:** All agents use `provider.streamComplete()` for real-time responses
  - **Error Handling:** Automatic retries with exponential backoff (3 attempts)
  - **Tool Injection:** Tools passed as structured API parameters (not text in prompts)
  - **Future Support:** Azure OpenAI, vLLM (hosted/on-prem), Gemini

- **Performance & Security**
  - Edge Runtime compatible middleware for fast authentication checks
  - Secure HTTP-only cookies (SameSite=Strict)
  - Password hashing and validation (8 salt rounds)
  - Server-side JWT verification
  - Environment-based configuration
  - Token expiration (7 days)
  - CSRF protection with SameSite cookies

- **Developer Experience**
  - Next.js 16 with Turbopack (dev) / SWC (production)
  - ESLint for code quality
  - Responsive design patterns
  - Module path aliases (@/app/*)
  - Hot Module Replacement (HMR) for faster development
  - Clean component structure with containers and components
  - Modular and reusable code organization

## 🗺️ Roadmap

### v1.x (Early - Implemented) ✅
**Core Sequential Pipeline:**
- EventEmitter-based agent architecture
- Sequential orchestration (Planner → Scheduler → Executor → Critic)
- Real-time streaming with SessionContext pattern
- Dependency Injection for testability
- BYOK (Bring Your Own Key) for OpenAI/Anthropic

### v1.x (Late - In Progress) 🚧

**Foundational Agent Features**

🧠 **Enhanced Memory Agent** ✅ Documented
- Importance Weighting (semantic relevance scoring)
- Semantic Compression (cluster + summarize similar messages)
- Adaptive Context Window (simple/medium/complex → 2K/8K/16K tokens)
- Memory Pruning (importance-based retention)
- Long-term Knowledge Base (entity tracking)

🛡️ **Enhanced Recovery Agent** ✅ Documented
- Error Classification (transient, permanent, rate-limited, unknown)
- Adaptive Backoff Learning (learns best strategy per error type)
- Circuit Breaker Pattern (prevents cascade failures)
- Fallback Chain Execution (primary → secondary → cache → degradation)
- Error Pattern Detection (identifies systemic issues)

⚖️ **Ethics Agent** ✅ Documented
- PII Detection & Auto-Redaction (email, phone, SSN, credit card)
- Rate Limiting (configurable requests per hour)
- Content Moderation (permissive/standard/strict modes)
- GDPR Compliance (retention, right to be forgotten, consent)
- Audit Trail (comprehensive logging for compliance)

📊 **Enhanced Critic** (Documented)
- Improved validation rules
- Hallucination detection
- Confidence scoring
- Cross-check with deterministic core

🔄 **Enhanced Executor** (Documented)
- Working Memory (goal tracking, discoveries, progress)
- Smart Loop Detection (prevents infinite tool call patterns)
- Periodic Reflection (metacognitive self-assessment every N iterations)
- Early Stop (goal achievement detection)
- Iteration State Tracking (completed/pending tasks)

🧩 **Enhanced Planner** (Documented)
- Dynamic Replanning (Critic-triggered plan updates)
- Complexity-Based Planning (adaptive task decomposition)
- Context-Aware Planning (leverage previous results, user expertise)
- Plan Optimization (merge redundant tasks, improve parallelization)
- Plan Validation (check dependencies, tool availability)
- Adaptive Temperature (complexity-based LLM creativity)

⏱️ **Enhanced Scheduler** (Documented)
- State Machine (IDLE→PLANNING→EXECUTING→VALIDATING→COMPLETED)
- Checkpoint/Resume Support (for Cancel & Resume workflows)
- Dynamic Priority Adjustment (error tasks prioritized)
- Resource Management (token budget, rate limits)
- Parallel Execution Preparation (v2.x ready)

🎮 **User Interaction** (Planned)
- Human-in-the-loop for ambiguous queries
- Clarification requests
- Approval workflows for system changes
- Interactive debugging

🛑 **Cancel Logic** (Planned)
- Graceful execution termination
- Rollback support
- State cleanup on abort
- Real-time cancellation feedback

🎯 **Enhanced Orchestrator** (Planned)
- Adaptive Replanning Loop (Executor/Critic → Planner)
- Max Replan Attempts with graceful degradation
- Replanning History tracking
- Closed-loop intelligence (mid-execution plan adjustments)

**Polish & Optimization**
- State Machine for Scheduler (conditional replanning)
- Provider adapter for Azure OpenAI
- Enhanced audit logging
- Performance profiling & optimization

### v2.x: Hybrid Multi-Agent Architecture 🚀

**Phase 1: Parallel Execution** ⚡
- ExecutorPool with specialized agents (Syntax, Semantic, Compliance)
- DAG-based parallel task execution
- 3-5x speed improvement for complex analyses
- Backward compatible with sequential mode

**Phase 2: Competitive Execution** 🏆
- Best-of-N reasoning (multiple executors, Critic selects best)
- Cross-validation for hallucination detection
- Consensus-based confidence scoring
- Higher accuracy on complex queries

**Phase 3: Agent Bus** 🔄
- Peer-to-peer agent communication
- Dynamic replanning (Critic → Planner loops)
- Full multi-agent coordination
- Event-driven agent discovery

**Phase 4: Meta-Learning** 🧠
- Router Agent for intelligent task routing
- Adaptive complexity detection
- Performance optimization via learning
- Enterprise-grade observability

**Migration Strategy:**
- ✅ Feature flags (gradual rollout)
- ✅ Backward compatible (sequential as fallback)
- ✅ A/B testing for performance validation
- ✅ No breaking changes for existing integrations

## Usage
1. start chat session
2. chat with the agent about your EDIFACT file
3. get real-time analysis and explanations

## Known Issues
- [Windows]: Start vscode with admin rights to avoid issues with turbopack on Windows.
- [Development]: Ollama local LLM hosting requires signin for cloud models. Local models need to be setup separately.
- [Docker]: serverside/node code changes require container restart at the moment.

### License
MIT