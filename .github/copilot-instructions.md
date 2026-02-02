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

### Current Architecture Status (v1.x)

**Architecture Type:** Sequential Agent Pipeline (Agentic Workflow)  
**NOT Multi-Agent (yet):** Agents execute sequentially under central orchestration, no peer-to-peer communication or parallel execution.

**Current Flow:**
```
User Message → Planner → Scheduler → Executor → Critic → Result
                ↑ Central Orchestration (AgentOrchestrator)
```

**Why Not Multi-Agent Yet:**
- ❌ No agent autonomy (agents don't decide when to act)
- ❌ No peer-to-peer communication (all via Orchestrator)
- ❌ No parallel execution (sequential task processing)
- ❌ No competitive reasoning (single execution path)

**Future Migration Path:** See "Multi-Agent Evolution Strategy" section below.

### Layered Design
- **Core (Deterministic):** EDIFACT parser/validator (no LLM dependency). Normalizes to JSON, detects subsets, enforces rules. See `_workers/` and backend logic. **Single source of truth for domain semantics.**
- **Explanation Engine:** Adapter pattern for LLM providers (OpenAI, Anthropic, Azure, local vLLM, etc). Interface: `explainSegment`, `explainMessage`, `answerQuestion`. User selects provider and supplies own API key.
- **Agentic AI Layer:** Provider-agnostic agent orchestration using **EventEmitter pattern**:
  - **Planner Agent:** Hierarchical task decomposition (HTN style) - EventEmitter ✅
  - **Scheduler:** DAG scheduling for task execution - EventEmitter (future State Machine candidate) ✅
  - **Executor Agent:** ReAct loops with tool calling - EventEmitter ✅
  - **Critic Agent:** Validation, consistency checks, hallucination detection - EventEmitter ✅ (enhancements in progress)
  - **Memory Agent:** Conversational context + long-term knowledge retrieval - EventEmitter 🚧 (v1.x Late)
  - **Recovery Agent:** Fallbacks, retries, provider switching - EventEmitter 🚧 (v1.x Late)
  - **AgentOrchestrator:** Coordinates Planner → Scheduler flow - EventEmitter ✅
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

### v1.x Late Features

**Goal:** Complete foundational agent capabilities before multi-agent architecture.

#### Memory Agent
**Purpose:** Context management and conversational continuity

```js
class MemoryAgent extends EventEmitter {
  constructor() {
    super();
    this.shortTermMemory = [];  // Current session
    this.longTermMemory = new Map();  // Persistent knowledge
  }
  
  async invoke({ messages, context }) {
    this.emit('agent_memory:started');
    
    // Extract relevant context from history
    const relevantContext = this._retrieveRelevant(messages);
    
    // Optimize context window (token management)
    const optimizedContext = this._optimizeWindow(relevantContext);
    
    this.emit('agent_memory:completed', { context: optimizedContext });
    return optimizedContext;
  }
  
  _retrieveRelevant(messages) {
    // Semantic search in conversation history
    // Priority: recent messages, mentioned entities, active topics
  }
  
  _optimizeWindow(context) {
    // Keep within token limits
    // Summarize older messages, keep recent full
  }
}
```

#### Recovery Agent
**Purpose:** Error handling and provider fallback

```js
class RecoveryAgent extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.retryAttempts = 0;
    this.maxRetries = 3;
  }
  
  async invoke({ error, task, provider }) {
    this.emit('agent_recovery:started', { error });
    
    // 1. Retry with exponential backoff
    if (this._isRetryable(error) && this.retryAttempts < this.maxRetries) {
      await this._retry(task, provider);
      return;
    }
    
    // 2. Provider fallback
    if (this._hasAlternativeProvider(provider)) {
      const nextProvider = this._getNextProvider(provider);
      this.emit('agent_recovery:switch_provider', { from: provider, to: nextProvider });
      return await this._executeWithProvider(task, nextProvider);
    }
    
    // 3. Escalate to user
    this.emit('agent_recovery:escalate', {
      error,
      reason: 'No recovery strategy available',
      userAction: 'required'
    });
  }
  
  reset() {
    this.retryAttempts = 0;
  }
}
```

#### Enhanced Critic
**Improvements:**
- Hallucination detection via cross-check with deterministic core
- Confidence scoring (0.0-1.0)
- Detailed validation reports
- Automatic retry triggers

```js
class Critic extends EventEmitter {
  async validate({ result, context, deterministicData }) {
    this.emit('agent_critic:started');
    
    // Cross-check with deterministic core
    const consistencyScore = this._checkConsistency(result, deterministicData);
    
    // Hallucination detection
    const hallucinationScore = this._detectHallucination(result, context);
    
    // Confidence score
    const confidence = (consistencyScore + (1 - hallucinationScore)) / 2;
    
    const validation = {
      valid: confidence > 0.7,
      confidence,
      issues: this._identifyIssues(result, deterministicData),
      recommendation: confidence < 0.7 ? 'RETRY' : 'ACCEPT'
    };
    
    this.emit('agent_critic:completed', validation);
    return validation;
  }
}
```

#### Enhanced Executor
**Purpose:** Self-aware execution with metacognitive capabilities

**Improvements:**
- Working Memory for goal and progress tracking
- Smart Loop Detection (prevents repetitive tool call patterns)
- Periodic Reflection (metacognitive assessment every N iterations)
- Early Stop when goal is achieved
- Structured iteration state (completed/pending)

```js
class Executor extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...EXECUTOR_CONFIG, ...config };
    
    // Working Memory
    this.workingMemory = {
      goal: null,
      discoveries: [],
      toolHistory: [],
      lastReflection: null
    };
  }
  
  reset() {
    this.currentTask = null;
    this.workingMemory = {
      goal: null,
      discoveries: [],
      toolHistory: [],
      lastReflection: null
    };
  }
  
  async invoke({ messages, context, provider, toolNames }) {
    // Initialize goal
    this.workingMemory.goal = context.currentTask?.description;
    
    while (iteration < this.config.maxIterations) {
      // Track tools in working memory
      this.workingMemory.toolHistory.push({
        iteration,
        tools: llmResponse.toolCalls.map(tc => tc.tool),
        results: iterationToolResults
      });
      
      // Smart Loop Detection
      if (this._isStuckInLoop(this.workingMemory.toolHistory)) {
        console.warn('[Executor] Loop detected, stopping early');
        break;
      }
      
      // Periodic Reflection (every 3 iterations)
      if (iteration % 3 === 0 && iteration > 0) {
        const shouldContinue = await this._reflectOnProgress(
          currentMessages,
          this.workingMemory,
          provider
        );
        
        if (!shouldContinue) {
          console.log('[Executor] Goal achieved via reflection, stopping');
          break;
        }
      }
    }
    
    return {
      success: true,
      toolCalls,
      toolResults,
      workingMemory: this.workingMemory, // Expose memory state
      // ...
    };
  }
  
  _isStuckInLoop(history) {
    if (history.length < 4) return false;
    
    const last2 = history.slice(-2).map(h => h.tools.join(','));
    const prev2 = history.slice(-4, -2).map(h => h.tools.join(','));
    
    // Detect if last 2 iterations match previous 2
    return JSON.stringify(last2) === JSON.stringify(prev2);
  }
  
  async _reflectOnProgress(messages, workingMemory, provider) {
    const reflectionPrompt = `
Goal: ${workingMemory.goal}
Tool History: ${workingMemory.toolHistory.map(h => 
  `Iteration ${h.iteration}: ${h.tools.join(', ')}`
).join('\n')}

Has the goal been achieved? Respond JSON: {goalAchieved: bool, nextAction: "stop"|"continue"}
`;
    
    const response = await provider.complete({
      messages: [
        { role: 'system', content: 'You are a metacognitive reflection agent.' },
        { role: 'user', content: reflectionPrompt }
      ],
      options: { temperature: 0.2, maxTokens: 300 }
    });
    
    const reflection = JSON.parse(response.content);
    this.workingMemory.lastReflection = reflection;
    
    this.emit('agent_executor:reflection', {
      iteration: workingMemory.toolHistory.length,
      reflection,
      timestamp: Date.now()
    });
    
    return reflection.nextAction === 'continue';
  }
}
```

**Additional Improvements (Adaptive Replanning):**
- Mid-Execution Replanning Detection (loop, tool unavailable, goal shift)
- Replanning Request to Orchestrator
- Suggestion Generation for Planner

```js
class Executor extends EventEmitter {
  async invoke({ messages, context, provider, toolNames }) {
    // ... existing Working Memory + Reflection code ...
    
    while (iteration < this.config.maxIterations) {
      // ... existing iteration logic ...
      
      // NEW: Adaptive Replanning Detection
      const replanCheck = this._checkForReplanning({
        toolHistory: this.workingMemory.toolHistory,
        llmResponse,
        context
      });
      
      if (replanCheck.needsReplan) {
        this.emit('agent_executor:replanning_request', {
          reason: replanCheck.reason,
          suggestion: replanCheck.suggestion,
          iteration
        });
        
        return {
          success: false,
          needsReplanning: true,
          replanFeedback: {
            reason: replanCheck.reason,
            failedTaskId: context.currentTask?.id,
            suggestion: replanCheck.suggestion
          }
        };
      }
    }
  }
  
  _checkForReplanning({ toolHistory, llmResponse, context }) {
    // 1. Loop Detection → Replan
    if (this._isStuckInLoop(toolHistory)) {
      return {
        needsReplan: true,
        reason: 'Executor stuck in tool call loop',
        suggestion: 'Simplify task or provide alternative tools'
      };
    }
    
    // 2. Tool Unavailable → Replan
    if (llmResponse.error?.includes('Tool not found')) {
      return {
        needsReplan: true,
        reason: 'Required tool not available',
        suggestion: 'Find alternative approach without this tool'
      };
    }
    
    // 3. Goal Shift → Replan
    if (this._goalShifted(context)) {
      return {
        needsReplan: true,
        reason: 'Task goal shifted during execution',
        suggestion: 'Re-decompose with updated goal'
      };
    }
    
    return { needsReplan: false };
  }
}
```

**Benefits:**
- Prevents infinite loops (detects patterns, not just warnings)
- Stops early when task is done (saves LLM costs)
- Self-aware execution (knows what it's doing and why)
- Better debugging (working memory exposed in results)
- **Mid-execution replanning** (closed-loop intelligence)
- **Proactive error prevention** (detects issues before failure)
- Foundation for Meta-Cognitive Agent (v2.x)

#### Enhanced Planner
**Purpose:** Adaptive, intelligent task planning with dynamic replanning

**Improvements:**
- Dynamic Replanning (Critic-triggered plan updates)
- Complexity-Based Planning (adaptive task decomposition based on query complexity)
- Context-Aware Planning (leverage conversation history, previous results, user expertise)
- Plan Optimization (merge redundant tasks, improve parallelization)
- Plan Validation (check circular dependencies, tool availability, feasibility)
- Adaptive Temperature (adjust LLM creativity based on task complexity)

```js
class Planner extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...PLANNER_CONFIG, ...config };
    this.planHistory = []; // Track replanning
  }
  
  reset() {
    this.planHistory = [];
    console.log('[Planner] State + History reset');
  }
  
  async invoke({ userMessage, messages, context, provider }) {
    // Assess query complexity
    const complexity = this._assessComplexity(userMessage, context);
    
    // Adaptive temperature based on complexity
    const temperature = this._getAdaptiveTemperature(complexity);
    
    // Decompose with complexity-aware planning
    const llmResult = await this._decomposeWithLLM(
      userMessage, 
      messages, 
      context, 
      provider,
      { temperature, complexity }
    );
    
    // Optimize task plan
    const optimizedPlan = this._optimizePlan(llmResult.subtasks);
    
    // Validate before execution
    const validation = this._validatePlan(optimizedPlan);
    if (!validation.valid) {
      console.warn('[Planner] Plan validation failed:', validation.issues);
      // Fallback or retry
    }
    
    // Build task graph
    const taskPlan = this._buildTaskGraph(optimizedPlan, userMessage, llmResult.rationale);
    
    // Store in history for replanning
    this.planHistory.push({
      timestamp: Date.now(),
      plan: taskPlan,
      complexity
    });
    
    return taskPlan;
  }
  
  /**
   * Dynamic Replanning (triggered by Critic)
   */
  async replan({ originalPlan, criticFeedback, context, provider }) {
    this.emit('agent_planner:replanning', {
      reason: criticFeedback.reason,
      failedTasks: criticFeedback.failedTasks
    });
    
    // Identify which tasks need replanning
    const tasksToReplan = originalPlan.subtasks.filter(t => 
      criticFeedback.failedTasks.includes(t.id)
    );
    
    // Generate new plan for failed tasks
    const replanPrompt = `
Original Goal: ${originalPlan.goal}
Failed Tasks: ${tasksToReplan.map(t => t.name).join(', ')}
Critic Feedback: ${criticFeedback.reason}

Generate alternative approach for these tasks.
`;
    
    const newPlan = await this._decomposeWithLLM(
      replanPrompt,
      [], // No message history for replanning
      { ...context, isReplanning: true },
      provider
    );
    
    // Merge with original plan
    const mergedPlan = this._mergePlans(originalPlan, newPlan, tasksToReplan);
    
    // Update metadata
    mergedPlan.metadata.replanning_count = (originalPlan.metadata.replanning_count || 0) + 1;
    mergedPlan.metadata.replanningHistory = [
      ...(originalPlan.metadata.replanningHistory || []),
      {
        timestamp: Date.now(),
        reason: criticFeedback.reason,
        affectedTasks: tasksToReplan.map(t => t.id)
      }
    ];
    
    this.emit('agent_planner:replanning_completed', mergedPlan);
    return mergedPlan;
  }
  
  /**
   * Assess query complexity (simple/medium/complex)
   */
  _assessComplexity(userMessage, context) {
    const factors = {
      length: userMessage.length,
      hasMultipleQuestions: (userMessage.match(/\?/g) || []).length > 1,
      hasErrors: context.analysis?.errors?.length > 0,
      segmentCount: context.analysis?.totalSegments || 0,
      conversationDepth: (context.messages || []).length
    };
    
    // Simple: Short query, no errors, < 10 segments
    if (factors.length < 100 && !factors.hasErrors && factors.segmentCount < 10) {
      return 'simple';
    }
    
    // Complex: Long query, errors, many segments
    if (factors.length > 300 || factors.hasErrors || factors.segmentCount > 50) {
      return 'complex';
    }
    
    return 'medium';
  }
  
  /**
   * Adaptive temperature based on complexity
   */
  _getAdaptiveTemperature(complexity) {
    const temperatures = {
      simple: 0.1,   // Deterministic for simple queries
      medium: 0.3,   // Default balanced
      complex: 0.5   // Creative for complex reasoning
    };
    return temperatures[complexity] || 0.3;
  }
  
  /**
   * Optimize task plan (merge redundant, reorder)
   */
  _optimizePlan(subtasks) {
    // 1. Merge duplicate tool calls
    const merged = this._mergeDuplicateTasks(subtasks);
    
    // 2. Eliminate unnecessary steps
    const pruned = this._pruneUnnecessaryTasks(merged);
    
    // 3. Reorder for better parallelization
    const reordered = this._reorderForParallelization(pruned);
    
    return reordered;
  }
  
  _mergeDuplicateTasks(tasks) {
    const seen = new Map();
    const merged = [];
    
    for (const task of tasks) {
      const key = `${task.name}_${task.tools.join(',')}`;
      if (seen.has(key)) {
        // Merge dependencies
        const existing = seen.get(key);
        existing.dependencies = [...new Set([...existing.dependencies, ...task.dependencies])];
      } else {
        seen.set(key, task);
        merged.push(task);
      }
    }
    
    return merged;
  }
  
  _pruneUnnecessaryTasks(tasks) {
    // Remove tasks with no tools and no dependencies (probably redundant)
    return tasks.filter(t => t.tools.length > 0 || t.dependencies.length > 0);
  }
  
  _reorderForParallelization(tasks) {
    // Sort by dependency depth (tasks with fewer deps first)
    return tasks.sort((a, b) => a.dependencies.length - b.dependencies.length);
  }
  
  /**
   * Validate plan before execution
   */
  _validatePlan(subtasks) {
    const issues = [];
    
    // Check circular dependencies
    if (this._hasCircularDependencies(subtasks)) {
      issues.push('Circular dependencies detected');
    }
    
    // Check tool availability
    for (const task of subtasks) {
      for (const tool of task.tools) {
        if (!registry.has(tool)) {
          issues.push(`Tool not available: ${tool}`);
        }
      }
    }
    
    // Check feasibility (no task should have > 5 tools)
    for (const task of subtasks) {
      if (task.tools.length > 5) {
        issues.push(`Task "${task.name}" has too many tools (${task.tools.length})`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  _hasCircularDependencies(tasks) {
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycle = (taskId) => {
      visited.add(taskId);
      recursionStack.add(taskId);
      
      const task = tasks.find(t => t.id === taskId);
      if (!task) return false;
      
      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          if (hasCycle(depId)) return true;
        } else if (recursionStack.has(depId)) {
          return true; // Cycle detected
        }
      }
      
      recursionStack.delete(taskId);
      return false;
    };
    
    for (const task of tasks) {
      if (!visited.has(task.id) && hasCycle(task.id)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Merge original plan with replanned tasks
   */
  _mergePlans(originalPlan, newPlan, tasksToReplace) {
    const idsToReplace = new Set(tasksToReplace.map(t => t.id));
    
    const mergedSubtasks = [
      ...originalPlan.subtasks.filter(t => !idsToReplace.has(t.id)),
      ...newPlan.subtasks
    ];
    
    return this._buildTaskGraph(
      mergedSubtasks,
      originalPlan.goal,
      `Replanned: ${newPlan.rationale}`
    );
  }
}
```

**Benefits:**
- Adaptive planning based on query complexity (saves tokens on simple queries)
- Self-healing via dynamic replanning (Critic can trigger plan updates)
- Optimized execution (merged redundant tasks, better parallelization)
- Robust validation (catches circular deps, missing tools before execution)
- Full audit trail (replanning history tracked)
- Foundation for Competitive Planning (v2.x - multiple Planners vote on best plan)

#### Enhanced Orchestrator
**Purpose:** Adaptive orchestration with closed-loop replanning

**Improvements:**
- Adaptive Replanning Loop (Executor/Critic → Planner feedback)
- Max Replan Attempts (3) with graceful degradation
- Replanning History tracking
- Closed-loop intelligence (mid-execution plan adjustments)
- Multi-source replanning triggers (Executor, Critic, Scheduler)

```js
class AgentOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      maxReplans: 3,
      ...config
    };
    this.planner = config.planner;
    this.scheduler = config.scheduler;
    this.executor = config.executor;
    this.critic = config.critic;
  }
  
  async execute(userMessage, messages, context, provider) {
    let planResult = await this._executePlanner(
      userMessage,
      messages,
      context,
      provider
    );
    
    let replanAttempts = 0;
    const replanHistory = [];
    
    // Adaptive Replanning Loop
    while (replanAttempts < this.config.maxReplans) {
      const schedulerResult = await this._executeScheduler(
        planResult,
        messages,
        context,
        provider
      );
      
      // Check for replanning requests (from Executor, Critic, or Scheduler)
      if (schedulerResult.needsReplanning) {
        console.log(`[Orchestrator] Replanning attempt ${replanAttempts + 1}`);
        
        // Track replanning history
        replanHistory.push({
          attempt: replanAttempts + 1,
          trigger: schedulerResult.replanFeedback.source, // 'executor'|'critic'|'scheduler'
          reason: schedulerResult.replanFeedback.reason,
          timestamp: Date.now()
        });
        
        // Call Planner.replan() with feedback
        planResult = await this.planner.replan({
          originalPlan: planResult,
          criticFeedback: schedulerResult.replanFeedback,
          context,
          provider
        });
        
        this.emit('agent_orchestrator:replanned', {
          attempt: replanAttempts + 1,
          reason: schedulerResult.replanFeedback.reason,
          newPlanTaskCount: planResult.subtasks.length
        });
        
        replanAttempts++;
        continue; // Retry with new plan
      }
      
      // Success - no replanning needed
      return this._aggregateResults(
        schedulerResult,
        planResult,
        { replanHistory }
      );
    }
    
    // Max replans exceeded - graceful degradation
    console.warn('[Orchestrator] Max replanning attempts exceeded');
    this.emit('agent_orchestrator:max_replans_exceeded', {
      attempts: replanAttempts,
      history: replanHistory
    });
    
    // Return partial results with warning
    return this._aggregateResults(
      schedulerResult,
      planResult,
      {
        replanHistory,
        warning: 'Max replanning attempts exceeded',
        partialResults: true
      }
    );
  }
  
  _aggregateResults(schedulerResult, planResult, metadata = {}) {
    // ... existing aggregation logic ...
    
    return {
      allToolCalls,
      allToolResults,
      finalAssistantMessage,
      schedulerResult,
      planResult,
      metadata: {
        ...metadata,
        replanCount: metadata.replanHistory?.length || 0
      }
    };
  }
}
```

**Benefits:**
- **Closed-loop intelligence**: System self-corrects mid-execution
- **Multiple replanning triggers**: Executor, Critic, Scheduler can all request replans
- **Graceful degradation**: Max replans prevents infinite loops, returns partial results
- **Full audit trail**: Replanning history tracked (who triggered, why, when)
- **Proactive adaptation**: Detects issues before task failure
- **Foundation for autonomous agents** (v2.x - full self-healing)

**Replanning Triggers:**
1. **Executor → Planner**: "I'm stuck in a loop / tool unavailable"
2. **Critic → Planner**: "Result validation failed / hallucination detected"
3. **Scheduler → Planner**: "Dependency resolution failed / circular deps"

**Three Types of Replanning:**
- **Pre-Execution**: Planner validates own plan (Plan Validation)
- **Mid-Execution**: Executor detects issues during execution (Adaptive Replanning)
- **Post-Execution**: Critic rejects result after validation (Dynamic Replanning)

#### Enhanced Scheduler
**Purpose:** State Machine-based execution with checkpoint support

**Improvements:**
- State Machine (FSM) for complex workflow management
- Checkpoint/Resume support (for Cancel & Resume)
- Dynamic Priority Adjustment (error tasks prioritized)
- Resource Management (token budget, rate limits)
- Parallel Execution Preparation (v2.x ready)

```js
class Scheduler extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...SCHEDULER_CONFIG, ...config };
    
    // State Machine
    this.state = 'idle'; // idle | planning | executing | validating | completed | failed | recovering
    this.currentExecution = null;
    
    // Resource Management
    this.resourceLimits = {
      maxConcurrentTasks: 1, // v1.x: sequential, v2.x: parallel
      tokenBudget: 100000,
      currentTokenUsage: 0,
      rateLimits: new Map() // provider → request count
    };
    
    // Checkpoint Support
    this.checkpoints = [];
    this.completedTasks = [];
  }
  
  reset() {
    this.state = 'idle';
    this.currentExecution = null;
    this.checkpoints = [];
    this.completedTasks = [];
    this.resourceLimits.currentTokenUsage = 0;
  }
  
  async execute({ taskTree, agents, context, messages, provider }) {
    // State Machine: IDLE → PLANNING
    this._transitionTo('planning');
    
    // Dynamic Priority Adjustment
    const prioritizedTasks = this._adjustPriorities(taskTree.subtasks, context);
    
    // State Machine: PLANNING → EXECUTING
    this._transitionTo('executing');
    
    const results = {};
    const metrics = {
      tasksRun: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      tokensUsed: 0
    };
    
    for (const task of prioritizedTasks) {
      // Check resource availability
      if (!this._checkResourceAvailability(task)) {
        console.warn('[Scheduler] Token budget exceeded, pausing execution');
        await this._checkpoint({ results, metrics, remainingTasks: prioritizedTasks.slice(i) });
        break;
      }
      
      // Execute task
      this.emit('agent_scheduler:step', {
        status: 'task_started',
        taskId: task.id,
        taskName: task.name
      });
      
      const result = await this._executeTask(task, agents, context, messages, provider);
      results[task.id] = result;
      
      // Update metrics
      metrics.tasksRun++;
      metrics.tokensUsed += result.tokensUsed || 0;
      this.resourceLimits.currentTokenUsage += result.tokensUsed || 0;
      
      if (result.success) {
        metrics.tasksCompleted++;
        this.completedTasks.push(task.id);
      } else {
        metrics.tasksFailed++;
        
        // State Machine: EXECUTING → RECOVERING
        if (this._shouldRecover(result)) {
          this._transitionTo('recovering');
          const recovered = await this._attemptRecovery(task, result, agents);
          
          if (recovered) {
            this._transitionTo('executing');
            continue;
          }
        }
      }
      
      // Checkpoint every N tasks
      if (metrics.tasksRun % 5 === 0) {
        await this._checkpoint({ results, metrics, currentTaskIndex: i });
      }
    }
    
    // State Machine: EXECUTING → VALIDATING
    this._transitionTo('validating');
    
    // Validate all results
    const allValid = Object.values(results).every(r => r.success);
    
    // State Machine: VALIDATING → COMPLETED or FAILED
    this._transitionTo(allValid ? 'completed' : 'failed');
    
    return {
      goalCompleted: allValid,
      subtaskResults: results,
      metrics,
      state: this.state
    };
  }
  
  /**
   * State Machine Transition
   */
  _transitionTo(newState) {
    const validTransitions = {
      idle: ['planning'],
      planning: ['executing', 'failed'],
      executing: ['validating', 'recovering', 'failed'],
      recovering: ['executing', 'failed'],
      validating: ['completed', 'failed'],
      completed: ['idle'],
      failed: ['idle']
    };
    
    if (!validTransitions[this.state]?.includes(newState)) {
      throw new Error(`Invalid state transition: ${this.state} → ${newState}`);
    }
    
    const oldState = this.state;
    this.state = newState;
    
    this.emit('agent_scheduler:state_change', {
      from: oldState,
      to: newState,
      timestamp: Date.now()
    });
    
    console.log(`[Scheduler] State transition: ${oldState} → ${newState}`);
  }
  
  /**
   * Dynamic Priority Adjustment
   */
  _adjustPriorities(tasks, context) {
    return tasks.sort((a, b) => {
      const priorityA = this._calculatePriority(a, context);
      const priorityB = this._calculatePriority(b, context);
      return priorityB - priorityA; // Higher priority first
    });
  }
  
  _calculatePriority(task, context) {
    let priority = 0;
    
    // Tasks with fewer dependencies → higher priority
    priority += (10 - task.dependencies.length) * 10;
    
    // Tasks related to errors → highest priority
    if (context.analysis?.errors?.length > 0) {
      if (task.tools.includes('validateRules') || task.tools.includes('identifyErrors')) {
        priority += 100;
      }
    }
    
    // Tasks with LOW effort → higher priority (quick wins)
    const effortScore = { LOW: 30, MEDIUM: 20, HIGH: 10 };
    priority += effortScore[task.effort] || 0;
    
    return priority;
  }
  
  /**
   * Checkpoint/Resume Support
   */
  async _checkpoint(state) {
    const checkpoint = {
      id: `checkpoint_${Date.now()}`,
      timestamp: Date.now(),
      state: { ...state },
      completedTasks: [...this.completedTasks],
      resourceUsage: this.resourceLimits.currentTokenUsage
    };
    
    this.checkpoints.push(checkpoint);
    
    this.emit('agent_scheduler:checkpoint', {
      checkpointId: checkpoint.id,
      tasksCompleted: this.completedTasks.length,
      tokensUsed: this.resourceLimits.currentTokenUsage
    });
    
    console.log('[Scheduler] Checkpoint created:', checkpoint.id);
    return checkpoint;
  }
  
  async resume(checkpointId) {
    const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
    
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }
    
    this.completedTasks = checkpoint.completedTasks;
    this.resourceLimits.currentTokenUsage = checkpoint.resourceUsage;
    this.state = 'executing';
    
    this.emit('agent_scheduler:resumed', {
      checkpointId,
      resumedFrom: checkpoint.timestamp
    });
    
    console.log('[Scheduler] Resumed from checkpoint:', checkpointId);
    return checkpoint.state;
  }
  
  /**
   * Resource Management
   */
  _checkResourceAvailability(task) {
    const estimatedTokens = this._estimateTokens(task);
    const wouldExceedBudget = 
      this.resourceLimits.currentTokenUsage + estimatedTokens > this.resourceLimits.tokenBudget;
    
    if (wouldExceedBudget) {
      console.warn('[Scheduler] Token budget would be exceeded:', {
        current: this.resourceLimits.currentTokenUsage,
        estimated: estimatedTokens,
        budget: this.resourceLimits.tokenBudget
      });
      return false;
    }
    
    return true;
  }
  
  _estimateTokens(task) {
    // Rough estimation based on task complexity
    const baseTokens = 500;
    const toolTokens = task.tools.length * 200;
    const effortMultiplier = { LOW: 1, MEDIUM: 2, HIGH: 3 };
    
    return baseTokens + toolTokens * (effortMultiplier[task.effort] || 1);
  }
  
  /**
   * Recovery Logic
   */
  _shouldRecover(result) {
    // Retry on transient errors
    return result.error?.includes('timeout') || result.error?.includes('rate limit');
  }
  
  async _attemptRecovery(task, result, agents) {
    console.log('[Scheduler] Attempting recovery for task:', task.id);
    
    if (agents.recovery) {
      const recovered = await agents.recovery.invoke({
        error: result.error,
        task,
        provider: result.provider
      });
      
      return recovered.success;
    }
    
    return false;
  }
}
```

**State Machine Flow:**
```
IDLE → PLANNING → EXECUTING → VALIDATING → COMPLETED
         ↓            ↓            ↓
       FAILED ← ─────┴────────────┴→ RECOVERING
                                      ↓
                                  Back to EXECUTING
```

**Benefits:**
- **State Machine**: Clear workflow states, predictable transitions
- **Checkpoint/Resume**: Cancel execution, resume later (critical for long-running tasks)
- **Dynamic Priority**: Important tasks (errors) executed first
- **Resource Management**: Token budget awareness prevents cost overruns
- **Parallel Ready**: maxConcurrentTasks prepares for v2.x parallel execution
- **Graceful Degradation**: Pauses on budget limits, not crashes
- **Full Observability**: State changes, checkpoints emitted as events

#### User Interaction / Human-in-the-Loop
**Purpose:** Request possible clarification or approval from users

```js
class UserInteractionAgent extends EventEmitter {
  async requestClarification({ question, options, context }) {
    this.emit('agent_interaction:request', {
      type: 'clarification',
      question,
      options,
      timeout: 300000  // 5 minutes
    });
    
    // Wait for user response (via Socket.IO)
    return new Promise((resolve) => {
      this.once('user:response', resolve);
    });
  }
  
  async requestApproval({ action, impact, risks }) {
    this.emit('agent_interaction:request', {
      type: 'approval',
      action,
      impact,
      risks
    });
    
    return new Promise((resolve) => {
      this.once('user:approval', resolve);
    });
  }
}
```

#### Cancel Logic
**Purpose:** Graceful termination of running executions

```js
// SessionContext
class SessionContext {
  async cancelExecution() {
    this.emit('execution:cancelling');
    
    // 1. Set cancellation flag
    this.isCancelled = true;
    
    // 2. Abort current LLM calls
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    
    // 3. Reset all agents
    this.resetAgents();
    
    // 4. Rollback partial state
    await this._rollbackState();
    
    this.emit('execution:cancelled');
  }
}

// Agents check cancellation flag
class Executor extends EventEmitter {
  async invoke({ task, context }) {
    for (const step of task.steps) {
      // Check cancellation before each step
      if (context.isCancelled) {
        this.emit('agent_executor:cancelled');
        return { status: 'cancelled', reason: 'User requested' };
      }
      
      await this._executeStep(step);
    }
  }
}
```

**Integration Timeline:**
- Memory Agent, Recovery Agent, Enhanced Critic, Cancel Logic
- Human-in-the-Loop, State Machine for Scheduler, Azure OpenAI adapter
- Ready for multi-agent migration (v2.x Phase 1)

### Multi-Agent Evolution Strategy (v2.x Roadmap)

**Vision:** Hybrid Multi-Agent Architecture combining sequential coordination with parallel execution and agent autonomy.

#### Phase 1: Parallel Execution (Backward Compatible)
**Goal:** Speed up analysis via parallel tool execution

```js
// Current (Sequential):
await executor.invoke(task1);
await executor.invoke(task2);

// Future (Parallel):
await Promise.all([
  syntaxExecutor.invoke(task1),    // Specialized agent
  semanticExecutor.invoke(task2),  // Specialized agent
  complianceExecutor.invoke(task3) // Specialized agent
]);
```

**Changes:**
- `Executor` → `ExecutorPool` (3+ specialized executors)
- `Scheduler` gains parallel DAG execution
- `Critic` aggregates multiple results (best-of-N selection)

#### Phase 2: Autonomous Recovery Agent
**Goal:** Self-healing on provider failures

```js
class RecoveryAgent extends EventEmitter {
  async autonomousLoop() {
    // Observes executor errors
    this.on('executor:error', async (error) => {
      // 1. Retry with exponential backoff
      if (error.retryable) await this.retry();
      // 2. Switch provider (OpenAI → Anthropic)
      else if (error.provider) await this.switchProvider();
      // 3. Escalate to user
      else this.emit('recovery:escalate', error);
    });
  }
}
```

**Benefits:**
- No user intervention on transient failures
- Provider-agnostic resilience
- Full audit trail of recovery attempts

#### Phase 3: Competitive Execution (Best-of-N)
**Goal:** Higher accuracy via multiple reasoning paths

```js
// Multiple executors solve same task
const solutions = await Promise.all([
  executorA.invoke(task), // Approach A
  executorB.invoke(task), // Approach B
  executorC.invoke(task)  // Approach C
]);

// Critic selects best solution
const bestSolution = await critic.selectBest(solutions);
```

**Use Cases:**
- Complex semantic questions (multiple valid interpretations)
- Hallucination detection (cross-validate answers)
- Confidence scoring (consensus = higher confidence)

#### Phase 4: Agent Bus (Peer-to-Peer)
**Goal:** Full multi-agent communication

```js
class AgentBus extends EventEmitter {
  broadcast(from, message) {
    this.emit('agent:broadcast', { from, ...message });
  }
}

// Agent A directly messages Agent B
memoryAgent.on('context:updated', (data) => {
  executorAgent.receiveContext(data); // Direct communication
});
```

**Enables:**
- Memory Agent → Executor (context injection)
- Executor → Recovery (error notifications)
- Critic → Planner (replanning requests)

#### Phase 5: Meta-Learning & Routing
**Goal:** Intelligent agent selection

```js
class RouterAgent extends EventEmitter {
  async route(task) {
    // Analyze task complexity
    if (task.complexity < 0.3) return this.fastExecutor;
    if (task.requiresValidation) return [this.executor, this.critic];
    return this.executorPool; // Full multi-agent
  }
}
```

**Migration Principles:**
- ✅ Backward compatible (existing flows still work)
- ✅ Feature flags (enable multi-agent per user tier)
- ✅ Gradual rollout (A/B testing)
- ✅ Deterministic fallback (if multi-agent fails, use sequential)

**Timeline:**
- Phase 1 (Parallel):(3-5x speed improvement)
- Phase 2 (Competitive):(accuracy)
- Phase 3 (Agent Bus):(full multi-agent)
- Phase 4 (Meta-Learning):(optimization)

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
EDIFACTS Platform (v1.x → v2.x Evolution)
 ├─ Core (Deterministic EDIFACT Engine)
 ├─ Agent OS (EventEmitter-based)
 │   ├─ Current (v1.x): Sequential Pipeline
 │   │   ├─ Planner (EventEmitter)
 │   │   ├─ Scheduler (EventEmitter → Future FSM)
 │   │   ├─ Executor (EventEmitter)
 │   │   ├─ Critic (EventEmitter)
 │   │   ├─ SessionContext (DI + Event Relay)
 │   │   ├─ Tool Registry (Universal Schema)
 │   │   └─ Provider Adapters (Thin, no logic)
 │   ├─ v1.x Late (In Progress, Q2-Q3 2026)
 │   │   ├─ Memory Agent (Context Management)
 │   │   ├─ Recovery Agent (Error Handling & Fallback)
 │   │   ├─ Enhanced Critic (Hallucination Detection)
 │   │   ├─ User Interaction (Human-in-the-Loop)
 │   │   ├─ Cancel Logic (Graceful Termination)
 │   │   └─ Scheduler FSM (State Machine)
 │   └─ v2.x Future (Q4 2026+): Hybrid Multi-Agent
 │       ├─ ExecutorPool (Specialized Agents)
 │       ├─ Competitive Execution (Best-of-N)
 │       ├─ Router Agent (Intelligent Task Routing)
 │       ├─ Agent Bus (Peer-to-Peer Communication)
 │       └─ Parallel DAG Execution
 ├─ UI (Next.js Agent Inspector)
 └─ Enterprise Layer (SSO, DSGVO, On-Prem)
```

**Migration Path (v1.x → v2.x):**
- **Current (v1.x Early):** Sequential Agent Pipeline (Planner → Scheduler → Executor → Critic)
- **v1.x Late (Q2-Q3 2026):** + Memory, Recovery, Enhanced Critic, Cancel, Human-in-the-Loop
- **v2.x (Q4 2026+):** Hybrid Multi-Agent with parallel execution, competitive reasoning
- **Strategy:** Backward compatible, feature flags, gradual rollout
- **Timeline:** See v1.x Late Features + Multi-Agent Evolution Strategy sections

---

**See also:**
- `lib/socket/sessionContext.js` - SessionContext pattern implementation
- `lib/socket/handlers/agentHandlers.js` - WebSocket agent orchestration
- `lib/ai/orchestration/agentOrchestrator.js` - Orchestrator with DI
- `lib/ai/agents/` - All agent implementations (EventEmitters)
- `server.js` - Socket.IO integration with SessionContext

**For questions about patterns or missing documentation, check README.md or ask for clarification.**
