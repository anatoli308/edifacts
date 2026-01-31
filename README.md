# EDIFACTS

An intelligent AgentOS platform for EDIFACT analysis powered by multi-agent AI orchestration. Built with Next.js, Node.js, and real-time WebSocket streaming, EDIFACTS transforms complex EDI data into actionable insights through hierarchical task planning, deterministic parsing, and LLM-driven explanations. Bring your own OpenAI or Anthropic API key, or leverage managed inference—designed for developers, analysts, and enterprises who demand both transparency and automation.

**Key Features:** Multi-agent reasoning (Router, Planner, Executor, Critic) • Real-time streaming with live progress tracking • Universal tool system with 11+ domain tools • BYOK (Bring Your Own Key) architecture • Fully configurable agents & LLM providers • EDIFACT parsing & validation • Multi-user support with JWT auth • Customizable theming

## Requirements
- Node.js (version 18 or higher) ideally latest stable version
- npm (version 8 or higher) ideally latest stable version
- MongoDB instance (local or cloud-based) ideally latest stable version.

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
├── ai/                    # Agentic AI Core (domain-agnostic)
│   ├── agents/            # Agent implementations
│   │   ├── router.js      # Intent classification & orchestration
│   │   ├── planner.js     # HTN task decomposition
│   │   ├── executor.js    # ReAct loop with tool calling
│   │   ├── critic.js      # Validation & consistency checks
│   │   └── index.js       # Agent registry
│   ├── providers/         # LLM provider adapters
│   │   ├── openai.js      # OpenAI adapter (parallel tools)
│   │   ├── anthropic.js   # Anthropic adapter (sequential tools)
│   │   └── index.js       # Provider factory
│   ├── orchestration/     # Task coordination
│   │   ├── scheduler.js   # DAG task scheduler with dependencies
│   │   └── index.js
│   ├── tools/             # Tool management
│   │   ├── registry.js    # Central tool registry
│   │   ├── validateToolContract.js # Tool validation
│   │   └── index.js
│   ├── prompts/           # Agent system prompts
│   │   ├── router.md      # Router classification prompt
│   │   ├── planner.md     # Planner decomposition prompt
│   │   ├── executor.md    # Executor ReAct prompt
│   │   ├── assistant.md   # General assistant prompt
│   │   └── index.js       # Prompt loader
│   └── config/            # Agent configuration
│       ├── agents.config.js    # Agent parameters (temp, timeouts)
│       ├── providers.config.js # Provider capabilities
│       └── index.js
├── socket/                # WebSocket handlers
│   └── handlers/
│       └── agentHandlers.js # Agent invocation via Socket.IO

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
├── User.js                # User schema and authentication methods

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

- **Agentic AI Layer**
  - **Multi-Agent System:** Router, Planner, Executor, Critic, Scheduler
  - **Router Agent:** Intent classification (SIMPLE_EXPLAIN, ANALYSIS, DEBUG, PLANNING, CODING, COMPLIANCE)
  - **Planner Agent:** Hierarchical task decomposition (HTN) into 1-6 subtasks with dependency tracking
  - **Scheduler:** DAG-based task orchestration with dependency resolution and sequential execution
  - **Executor Agent:** ReAct loop (Thought → Action → Observation) with tool calling (max 10 iterations)
  - **Critic Agent:** Validates task results, checks consistency, detects hallucinations
  - **Tool System:** Universal tool registry with 11+ tools (getWeather, EDIFACT segment analysis, validation, etc)
  - **Provider Adapters:** OpenAI, Anthropic support with streaming (BYOK - Bring Your Own Key)
  - **Streaming Architecture:**
    - `agent:reasoning` - Internal thoughts during task execution (visible in UI)
    - `agent:plan` - Task tree from Planner
    - `agent:tool_call` / `agent:tool_result` - Tool execution tracking
    - `response:chunk` - Final answer streaming to user
  - **Context Passing:** Previous task results automatically injected into next task (tool results + analysis)
  - **Real-time Progress:** Live updates for task execution (1/N, 2/N status)

- **Real-time Communication**
  - WebSocket (Socket.IO) integration for live status updates
  - Automatic socket connection on app startup
  - Token-based WebSocket authentication via `authToken` cookie
  - Socket context provider with safe defaults for client components
  - Real-time worker status indication (Connected/Connecting/Disconnected)
  - Status badge in AppBar showing WebSocket connection state
  - Auto-reconnection with exponential backoff
  - **Agent Event Streaming:**
    - `agent:started` - Agent execution begins
    - `agent:plan` - Task tree emitted after planning
    - `agent:reasoning` - Internal thoughts streamed during execution
    - `agent:step` - Pipeline progress (planner_started, scheduler_started, task_started, task_completed, synthesis_started)
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

## Usage
WIP

## Known Issues
- [Windows]: Start vscode with admin rights to avoid issues with turbopack on Windows.

### Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

### License
MIT