# Copilot Coding Agent Instructions for EDIFACTS

## Project Overview
EDIFACTS is a Next.js/React web app for analyzing, explaining, and managing EDIFACT data with an AI chat assistant. It combines an open-source EDIFACT core (parsing, validation, normalization) with an optional LLM-based explanation layer, supporting both "bring your own key" and managed vLLM backends. The platform is SaaS-ready, modular, and designed for extensibility and enterprise use.

## Architecture & Key Patterns
- **Layered Design:**
  - **Core:** Deterministic, testable EDIFACT parser/validator (no LLM dependency). Normalizes to JSON, detects subsets, enforces rules. See `_workers/` and backend logic.
  - **Explanation Engine:** Adapter pattern for LLM providers (OpenAI, Anthropic, Azure, local vLLM, etc). Interface: `explainSegment`, `explainMessage`, `answerQuestion`. User can select provider and supply own API key; 
  - **Service Layer:** Managed vLLM (hosted or on-prem) is optional and monetized via support/enterprise features. Core remains open source; commercial features (audit logs, SAP helpers, etc) are kept separate.
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

## Extensibility & Product Logic
- **LLM-Agnostic:** Add new LLM providers by implementing the Explanation Engine interface. No LLM logic in the core parser.
- **BYO-Key & Monetization:**
  - Users can use their own API key (OpenAI, Anthropic, etc) for explanations at no extra cost.
  - Managed vLLM (hosted or on-prem) is a paid add-on (see for service tiers: Bronze/Silver/Gold).
- **Open Core, Commercial Add-ons:**
  - Core parser, subset detection, and rule engine are always open source.
  - Commercial/enterprise features (audit logs, SAP mapping, advanced roles) are not open source.

## Project-Specific Conventions
- **Path Aliases:** Use `@/app/*` (see `jsconfig.json`).
- **Component Structure:**
  - UI: `app/_components/`
  - Layouts: `app/_containers/`, `app/layout.js`
  - Contexts: `app/_contexts/`
- **API:**
  - Next.js API routes in `app/api/`.
  - Auth/session logic in `app/api/auth/` and `app/api/generate/session/`.
- **Socket.IO:**
  - Auth via `authToken` cookie. Connection state in context, shown in AppBar.
- **Theme:**
  - All theme logic in `theme/`, MUI overrides in `theme/overrides/`.

## Integration Points
- **MongoDB:** via Mongoose (`models/`, `lib/dbConnect.js`).
- **Socket.IO:** via `server.js` and `socketproxy.js`.
- **EDIFACT Parsing:** via backend workers in `_workers/`.

## Workflow: AnalysisChat (End-to-End)
This workflow powers the core chat and analysis experience:
Requirements: User is authenticated; EDIFACT file is uploaded/selected. A API key is provided (BYO-Key) or managed vLLM is enabled.

1. **Chat Creation:**
  - User creates a chat with domain context (EDIFACT file, subset, version, prompt preferences, LLM provider/model).
  - User is redirected to analysis chat page (`/a/[sessionId]`).
2. **EDIFACT Parsing:**
  - File is parsed/validated. Results (segments, errors, summary, etc.) are stored in `analysis` and a compact `llmContext` for prompt efficiency.
  - User sees real-time status updates for parsing/validation via Socket.IO.
  - User get a summary of the analysis once complete.
3. **User Message:**
  - User submits a message (e.g., "Bitte analysiere diese Invoice und gib mir alle Fehler.").
4. **LLM Response:**
  - Assistant message is created. LLM response is streamed in chunks (AnalysisMessageChunk), shown live via WebSocket, or as a complete message.
5. **Prompt Assembly:**
  - LLM receives: (1) System prompt (system-preset + user-personalized), (2) Domain context (EDIFACT/llmContext), (3) Message history(llm friendly preparation).
6. **Chat Continuation:**
  - New user/assistant messages extend the chat. Domain context can be updated if file/analysis changes.
7. **Model Switching:**
  - Model is fixed per chat. Switching models = new chat (recommended for reproducibility).

**Key Patterns:**
- Strict separation of domain context, prompt, and messages for reproducibility.
- Streaming/chunked LLM responses for real-time UX.
- All state (analysis, context, messages, chunks) is persisted for auditability and replay.

---
See also:
- `app/_contexts/UserContext.js` for user state logic
- `app/api/auth/login/route.js` for login flow
- `theme/index.js` for theme provider setup
- `server.js` for custom server and Socket.IO integration

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

---
For questions about unclear patterns or missing documentation, ask for clarification or check `README.md` for more details.
