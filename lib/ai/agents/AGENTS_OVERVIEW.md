# EDIFACTS Agent Architecture - Complete Overview

## 🧠 Human Brain → AI Agent Mapping

This document provides a complete overview of all EDIFACTS agents, mapping them to human cognitive functions to create a complete "AI Brain" for EDIFACT analysis.

```
┌─────────────────────────────────────────────────────────┐
│         EDIFACTS: Complete AI Brain Architecture        │
└─────────────────────────────────────────────────────────┘

Executive Function           Meta-Cognitive Agent      [v2.x] 📋
  └─ Self-Optimization       └─ Strategy Selection
  └─ Performance Monitoring  └─ A/B Testing

Planning & Execution         Planner Agent             [v1.x] ✅ + 🚧
  ├─ Task Decomposition      Scheduler                 [v1.x] ✅ + 🚧
  ├─ DAG Execution           Executor Agent            [v1.x] ✅ + 🚧
  └─ Tool Calling            Critic Agent              [v1.x] ✅ + 🚧

Memory Systems               Memory Agent              [v1.x] 🚧
  ├─ Short-term             └─ Conversation Context
  ├─ Long-term              Learning Agent            [v2.x] 📋
  └─ Experience (RAG)       └─ Solution Database

Predictive Processing        Anticipation Agent        [v2.x] 📋
  ├─ Intent Prediction      └─ Next Question
  └─ Context Pre-loading    └─ Incomplete Detection

Communication & Teaching     Explanation Agent         [v2.x] 📋
  ├─ Adaptive Explanations  └─ Beginner/Expert
  ├─ Analogies              └─ Visualizations
  └─ Theory of Mind         └─ User Level Detection

Emotional Intelligence       Emotional Agent           [v2.x] 📋
  ├─ Sentiment Analysis     └─ Frustration Detection
  └─ Tone Adaptation        └─ De-escalation

Safety & Ethics              Ethics Agent              [v1.x] 🚧
  ├─ GDPR Compliance        └─ PII Detection
  ├─ Rate Limiting          └─ Content Moderation
  └─ Moral Guardrails       └─ Abuse Prevention

Exploration & Curiosity      Curiosity Agent           [v2.x] 📋
  ├─ Topic Suggestions      └─ Related Concepts
  └─ Knowledge Gaps         └─ Learning Paths

Emergency Response           Recovery Agent            [v1.x] 🚧
  ├─ Error Handling         └─ Retry Logic
  ├─ Provider Fallback      └─ Graceful Degradation
  └─ Fight-or-Flight        └─ Escalation
```

**Legend:**
- ✅ Implemented (v1.x Early)
- 🚧 In Progress (v1.x Late - Q2-Q3 2026)
- 📋 Planned (v2.x - 2027)

---

## 📂 Agent Directory Structure

```
lib/ai/agents/
├── planner.js              ✅ Hierarchical task decomposition
├── executor.js             ✅ ReAct loops with tool calling
├── critic.js               ✅ Validation & hallucination detection
├── memory.js               🚧 Conversation context management
├── recovery.js             🚧 Error handling & provider fallback
├── index.js                ✅ Agent registry & loader
│
└── future_agents/          📋 Future agent specifications
    ├── README.md               → Implementation roadmap
    ├── meta_cognitive_agent.md → Self-optimization (Priority 1)
    ├── learning_agent.md       → Experience & RAG (Priority 1)
    ├── anticipation_agent.md   → Predictive processing
    ├── explanation_agent.md    → Adaptive teaching
    ├── emotional_agent.md      → Sentiment & empathy
    └── curiosity_ethics_agents.md → Exploration & safety
```

---

## 🎯 Agent Comparison Matrix

| Agent | Status | Human Analog | Purpose | Priority | Timeline |
|-------|--------|--------------|---------|----------|----------|
| **Planner** | ✅ | Prefrontal Cortex | Task decomposition | Core | v1.x Early |
| **Executor** | ✅ | Motor Cortex | Action execution | Core | v1.x Early |
| **Critic** | ✅ + 🚧 | Ant. Cingulate | Error detection | Core | v1.x Early + Late |
| **Scheduler** | ✅ | - | DAG execution | Core | v1.x Early |
| **Memory** | 🚧 | Hippocampus | Conversation context | High | v1.x Late (Q2) |
| **Recovery** | 🚧 | Amygdala | Error handling | High | v1.x Late (Q2) |
| **Ethics** | 🚧 | Superego | Safety & GDPR | High | v1.x Late (Q2) |
| **Meta-Cognitive** | 📋 | Executive Function | Self-optimization | ⭐⭐⭐ | v2.x Early (Q4) |
| **Learning** | 📋 | Synaptic Plasticity | Experience (RAG) | ⭐⭐ | v2.x Early (Q4) |
| **Anticipation** | 📋 | Predictive Coding | Intent prediction | ⭐ | v2.x Mid (Q1 '27) |
| **Explanation** | 📋 | Theory of Mind | Adaptive teaching | ⭐⭐ | v2.x Mid (Q1 '27) |
| **Emotional** | 📋 | Limbic System | Sentiment analysis | ⭐ | v2.x Late (Q2 '27) |
| **Curiosity** | 📋 | Exploration Drive | Topic suggestions | ⭐ | v2.x Late (Q2 '27) |

---

## 🔄 Key Distinction: Memory vs Learning

**Memory Agent (Conversational Context)**
- **What:** Short-term chat history, user preferences
- **Scope:** Single session/user
- **Question:** "What did user say 5 minutes ago?"
- **Example:** "User asked about INVOIC segment BGM"
- **Storage:** MongoDB (session-scoped)

**Learning Agent (Experience & RAG)**
- **What:** Solved problems, tool performance, best practices
- **Scope:** Global, all sessions/users
- **Question:** "How did we solve this 100 times before?"
- **Example:** "Tool `parseSegment` has 95% success rate for DTM"
- **Storage:** Vector DB (persistent, cross-session)

**Think of it as:**
- Memory = "Remembering what you told me today"
- Learning = "Remembering what worked best in the past"

---

## 🚀 Implementation Roadmap

### v1.x Early (Implemented) ✅
**Q4 2025 - Q1 2026**
- Planner: HTN task decomposition
- Executor: ReAct loops with tools
- Critic: Basic validation
- Scheduler: Sequential DAG execution
- **Result:** Functional agentic workflow

### v1.x Late (In Progress) 🚧
**Q2-Q3 2026**

**Q2 2026:**
- Memory Agent (conversation context)
- Recovery Agent (error handling, fallback)
- Enhanced Critic (hallucination detection, confidence scoring)
- Cancel Logic (graceful termination)

**Q3 2026:**
- Ethics Agent (PII detection, GDPR compliance)
- User Interaction (human-in-the-loop)
- Scheduler FSM (state machine for conditional workflows)
- Azure OpenAI adapter

**Result:** Robust, enterprise-ready sequential pipeline

### v2.x Early (Multi-Agent Phase 1) 📋
**Q4 2026**

- **Meta-Cognitive Agent** (self-optimization)
- **Learning Agent** (experience database, RAG)
- **Executor Pool** (specialized agents)
- **Parallel DAG Execution**

**Result:** Hybrid multi-agent with parallel execution (3-5x speed improvement)

### v2.x Mid (Multi-Agent Phase 2) 📋
**Q1 2027**

- **Anticipation Agent** (predictive processing)
- **Explanation Agent** (adaptive teaching)
- **Competitive Execution** (best-of-N reasoning)

**Result:** Intelligent, intuitive system with higher accuracy

### v2.x Late (Multi-Agent Phase 3) 📋
**Q2-Q3 2027**

- **Emotional Agent** (sentiment analysis)
- **Curiosity Agent** (proactive suggestions)
- **Agent Bus** (peer-to-peer communication)
- **Router Agent** (intelligent task routing)

**Result:** Complete AI brain with human-like interactions

---

## 🏗️ Architecture Principles

All agents follow these design patterns:

### 1. EventEmitter Pattern
```js
class Agent extends EventEmitter {
  async invoke({ input, context }) {
    this.emit('agent_X:started', { input });
    const result = await this._process(input, context);
    this.emit('agent_X:completed', result);
    return result;
  }
  
  reset() {
    // Clear session state
  }
}
```

### 2. Dependency Injection
- Agents instantiated once per socket (SessionContext)
- Passed to Orchestrator via constructor
- No direct instantiation inside agents

### 3. Observable & Testable
- Emit events for all state changes
- Pure functions where possible
- Unit testable in isolation

### 4. Human-Centered Design
- Every agent maps to human cognitive function
- Transparent reasoning (audit trail)
- Graceful degradation (fallbacks)

---

## 📚 Documentation

### For Current Agents (v1.x):
- **Code:** `lib/ai/agents/[agent_name].js`
- **Prompts:** `lib/ai/prompts/[agent_name].md`
- **Tests:** `__tests__/lib/ai/agents/[agent_name].test.js`

### For Future Agents (v2.x):
- **Specs:** `lib/ai/agents/future_agents/[agent_name].md`
- **Roadmap:** `lib/ai/agents/future_agents/README.md`

### Architecture:
- **Instructions:** `.github/copilot-instructions.md`
- **Overview:** `README.md`

---

## 🎯 Next Steps

**To implement next agent:**

1. **For v1.x Late (Memory/Recovery):**
   - Agents already stubbed in `lib/ai/agents/`
   - Complete implementation following existing pattern
   - Add to SessionContext
   - Write tests

2. **For v2.x (Meta-Cognitive/Learning):**
   - Read spec in `future_agents/[agent_name].md`
   - Create new file in `lib/ai/agents/`
   - Follow EventEmitter pattern
   - Implement behind feature flag

3. **Testing:**
   - Unit tests (mock dependencies)
   - Integration tests (with SessionContext)
   - E2E tests (full workflow)

4. **Deployment:**
   - Feature flag (gradual rollout)
   - Monitor performance
   - Iterate based on feedback

---

**Last Updated:** February 1, 2026  
**Maintainer:** EDIFACTS Core Team

**Questions?** See `future_agents/README.md` or `.github/copilot-instructions.md`
