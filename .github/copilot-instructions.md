# Copilot Coding Agent Instructions for EDIFACTS

## Project Overview
EDIFACTS is a Next.js/React web app for analyzing, explaining, and managing EDIFACT data with an AI chat assistant. It combines an open-source EDIFACT core (parsing, validation, normalization) with an optional LLM-based explanation layer, supporting both "bring your own key" and managed vLLM backends. The platform is SaaS-ready, modular, and designed for extensibility and enterprise use.

## Important Developer Rules
1. **Export only public APIs**: When creating new classes, only export the main class or function used by other modules. Helper functions should remain internal and private.
2. **Private method naming**: Internal private methods should be prefixed with an underscore `_` to indicate they are not part of the public API.
3. **Code consistency**: Follow existing code style and conventions for consistency across the project.
4. **Event-driven architecture**: Prefer EventEmitter-based communication over direct coupling where appropriate.
5. **Dependency Injection**: Use constructor injection for agent dependencies (see SessionContext pattern).
6. **State Machine readiness**: Agents maintain simple state flags (`idle`, `executing`, `completed`) to prepare for future State Machine implementation where needed.
7. **Single Responsibility**: Each agent should have one clear responsibility (Planner, Scheduler, Executor, Critic, etc). Avoid mixing concerns.
8. **MUI components**: For any new UI components, use Material-UI (MUI) and follow the existing design system for consistency.
9. **@/ alias**: Use the `@/` alias for imports from the `src/` directory to maintain clean and consistent import paths. In `jsconfig.json` you configure this alias. In the backend, use relative imports within the `src/` directory.
10. **setTimeout/setInterval**: Avoid using `setTimeout` or `setInterval` for timing or scheduling. Instead, use event-driven approaches or a proper way to handle asynchronous operations. NEVER USE THAT ideally.
11. **Latest MUI**: Always use the latest version of Material-UI (MUI) for all UI components to ensure consistency and access to the latest features and improvements. Never use deprecated attributes or components from older versions of MUI.

## Clean Code Standards

Follow these fundamental principles for maintainable, scalable code:

### Follow the SOLID Principles
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
- **YAGNI (You Aren't Gonna Need It)**: Don't implement features until they are necessary.
- **KISS (Keep It Simple, Stupid)**: Simplicity is key. Avoid over-engineering.
- **Meaningful Comments**: Comment why, not what. Code should be self-explanatory; use comments for rationale and context.
- **Consistent Formatting**: Follow established code style (indentation, spacing, naming conventions) for readability.
- **Error Handling**: Handle errors gracefully. Use try/catch where appropriate and provide meaningful error messages.
- **Service abstraction**: Separate external service calls (e.g., LLM providers) behind interfaces or adapters.
- **Control Flow Clarity**: Avoid deeply nested code if possible. Use early returns to reduce complexity.
- **Event-Driven Communication**: Use events for decoupled communication between modules, especially in agent interactions. Always prefer EventEmitter over direct method calls for inter-agent communication.

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
- **Core (Deterministic):** EDIFACT parser/validator (no LLM dependency). Normalizes to JSON, detects subsets, enforces rules. See `_workers/` and backend logic. Long running processes designed to run in separate threads or processes to avoid blocking the main event loop. **Single source of truth for domain semantics.**
- **LLM Agentic Layer:** Stateless agents for planning, scheduling, execution, and critique. Communicate via events. No direct coupling to Socket.IO or each other. See `src/agents/`. Designed for future multi-agent evolution.
- **Agentic AI Layer:** Provider-agnostic agent orchestration using **EventEmitter pattern**:
  - **Planner Agent:** Hierarchical task decomposition (HTN style) - EventEmitter ✅
  - **Scheduler:** DAG scheduling for task execution - EventEmitter (future State Machine candidate) ✅
  - **Executor Agent:** ReAct loops with tool calling - EventEmitter ✅
  - **Critic Agent:** Validation, consistency checks, hallucination detection - EventEmitter ✅ (enhancements in progress)
  - **Memory Agent:** Conversational context + long-term knowledge retrieval - EventEmitter 🚧 (v1.x Late)
  - **Recovery Agent:** Fallbacks, retries, provider switching - EventEmitter 🚧 (v1.x Late)
  - **AgentOrchestrator:** Coordinates Planner → Scheduler flow - EventEmitter ✅
- **Service Layer:** Managed vLLM (hosted or on-prem) is optional and monetized via support/enterprise features. Core remains open source; commercial features (audit logs, SAP helpers, etc) are kept separate.
- **_workers/**: This directory contains long running processes for independent execution (e.g., EDIFACT parsing, etc). These should be designed to run in separate threads or processes to avoid blocking the main event loop.
- **_modules/**: This directory contains reusable tools for agent execution (e.g., SAP tool, database tool, edifact tool, etc). These should be designed as stateless functions that can be called by the Executor agent with appropriate parameters and no side effects.

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

#### Enhanced Memory Agent

**Purpose:** Intelligent context management with importance weighting, semantic compression, and adaptive token optimization.

**Improvements:**
- Importance Weighting (semantic relevance scoring)
- Semantic Compression (cluster + summarize similar messages)
- Adaptive Context Window (simple/medium/complex → 2K/8K/16K tokens)
- Memory Pruning (importance-based retention, FIFO for low-importance items)

```js
class EnhancedMemory extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      maxShortTerm: 50,
      maxLongTerm: 10000,
      importanceThreshold: 0.3,
      compressionThreshold: 0.8,
      ...config
    };
    
    // Memory storage
    this.shortTermMemory = [];   // Current session (with importance scores)
    this.longTermMemory = new Map(); // Persistent knowledge (by entity)
    this.semanticIndex = new Map(); // Similarity-based retrieval
    this.compressionRatio = 0;
  }
  
  reset() {
    this.shortTermMemory = [];
    this.compressionRatio = 0;
    console.log('[EnhancedMemory] State reset');
  }
  
  async invoke({ messages, context, provider }) {
    this.emit('agent_memory:started');
    
    // 1. Score message importance
    const scoredMessages = await this._scoreImportance(messages);
    
    // 2. Compress low-importance clusters
    const compressed = await this._semanticCompress(scoredMessages);
    
    // 3. Adaptive window sizing based on task complexity
    const windowSize = this._getAdaptiveWindowSize(context);
    
    // 4. Retrieve relevant context
    const relevantContext = this._retrieveRelevant(compressed, windowSize);
    
    // 5. Prune expired/low-importance memories
    this._pruneMemory();
    
    // 6. Update long-term memory
    this._updateLongTermMemory(compressed);
    
    this.emit('agent_memory:completed', {
      context: relevantContext,
      compressionRatio: this.compressionRatio,
      memories: {
        short: this.shortTermMemory.length,
        long: this.longTermMemory.size
      }
    });
    
    return relevantContext;
  }
  
  /**
   * Score message importance (0.0-1.0)
   */
  async _scoreImportance(messages) {
    const scored = [];
    
    for (const msg of messages) {
      let importance = 0;
      
      // Factor 1: Message type (questions highest)
      if (msg.content.includes('?')) importance += 0.4;
      if (msg.role === 'user') importance += 0.2;
      
      // Factor 2: Tool results (high value for context)
      if (msg.toolResults?.length > 0) importance += 0.3;
      
      // Factor 3: PII/sensitive (keep longer)
      if (this._hasSensitiveData(msg.content)) importance += 0.2;
      
      // Factor 4: Recency bonus (exponential decay)
      const ageMinutes = (Date.now() - msg.timestamp) / 60000;
      const recencyBonus = Math.exp(-ageMinutes / 60);
      importance += recencyBonus * 0.1;
      
      scored.push({
        ...msg,
        importance: Math.min(importance, 1.0)
      });
    }
    
    return scored.sort((a, b) => b.importance - a.importance);
  }
  
  /**
   * Semantic compression via clustering
   */
  async _semanticCompress(messages) {
    // Group similar messages (tool results, questions, explanations)
    const clusters = new Map();
    
    for (const msg of messages) {
      const type = this._getMessageType(msg);
      if (!clusters.has(type)) {
        clusters.set(type, []);
      }
      clusters.get(type).push(msg);
    }
    
    // Compress each cluster
    const compressed = [];
    for (const [type, cluster] of clusters) {
      if (cluster.length > 3 && type !== 'question') {
        // Summarize cluster
        const summary = await this._summarizeCluster(cluster);
        compressed.push({
          type: 'compressed',
          originalCount: cluster.length,
          summary,
          importance: cluster.reduce((sum, m) => sum + m.importance, 0) / cluster.length
        });
        
        this.compressionRatio += cluster.length - 1;
      } else {
        compressed.push(...cluster);
      }
    }
    
    return compressed;
  }
  
  /**
   * Adaptive context window based on task complexity
   */
  _getAdaptiveWindowSize(context) {
    const complexity = context.complexity || 'medium'; // simple | medium | complex
    
    const windows = {
      simple: 2000,    // ~500 words
      medium: 8000,    // ~2000 words
      complex: 16000   // ~4000 words
    };
    
    return windows[complexity] || windows.medium;
  }
  
  /**
   * Retrieve relevant context from memory
   */
  _retrieveRelevant(messages, maxTokens) {
    const relevant = [];
    let tokenCount = 0;
    
    // Prioritize: recent questions, tool results, high-importance
    const prioritized = messages.sort((a, b) => {
      const scoreA = (a.importance || 0) + (a.toolResults?.length || 0) * 0.1;
      const scoreB = (b.importance || 0) + (b.toolResults?.length || 0) * 0.1;
      return scoreB - scoreA;
    });
    
    for (const msg of prioritized) {
      const msgTokens = Math.ceil(msg.content.length / 4); // Rough tokenization
      if (tokenCount + msgTokens <= maxTokens) {
        relevant.push(msg);
        tokenCount += msgTokens;
      } else {
        break;
      }
    }
    
    return relevant;
  }
  
  /**
   * Memory pruning strategy
   */
  _pruneMemory() {
    // Remove messages with importance < threshold
    this.shortTermMemory = this.shortTermMemory.filter(
      m => m.importance >= this.config.importanceThreshold
    );
    
    // Keep FIFO for overflow
    if (this.shortTermMemory.length > this.config.maxShortTerm) {
      this.shortTermMemory = this.shortTermMemory.slice(-this.config.maxShortTerm);
    }
  }
  
  /**
   * Update long-term memory with entities and relationships
   */
  _updateLongTermMemory(messages) {
    for (const msg of messages) {
      // Extract entities (simple pattern: CAP_NAME)
      const entities = msg.content.match(/\b[A-Z][A-Z_]+\b/g) || [];
      
      for (const entity of entities) {
        if (!this.longTermMemory.has(entity)) {
          this.longTermMemory.set(entity, {
            mentions: 0,
            contexts: [],
            importance: 0
          });
        }
        
        const entry = this.longTermMemory.get(entity);
        entry.mentions++;
        entry.contexts.push(msg.content.substring(0, 200));
        entry.importance = Math.min((entry.mentions / 10), 1.0);
        
        // Cap size
        if (this.longTermMemory.size > this.config.maxLongTerm) {
          const oldest = [...this.longTermMemory.entries()].sort(
            (a, b) => a[1].importance - b[1].importance
          )[0];
          this.longTermMemory.delete(oldest[0]);
        }
      }
    }
  }
  
  _getMessageType(msg) {
    if (msg.content.includes('?')) return 'question';
    if (msg.toolResults?.length > 0) return 'tool_result';
    if (msg.role === 'assistant') return 'explanation';
    return 'other';
  }
  
  _hasSensitiveData(content) {
    // Simple pattern matching for PII
    return /\b\d{3}-\d{2}-\d{4}\b/.test(content) || // SSN
           /\b\d{16}\b/.test(content) ||             // Credit card
           /@/.test(content);                        // Email
  }
  
  async _summarizeCluster(cluster) {
    const summary = `Cluster (${cluster.length} items): ${cluster.map(m => m.content.substring(0, 50)).join(' | ')}`;
    return summary;
  }
}
```

**Benefits:**
- Token efficiency (compression saves 30-40% tokens)
- Intelligent retrieval (importance-weighted context)
- Adaptive window sizing (matches task complexity)
- Persistent knowledge (long-term memory for entities)

#### Enhanced Recovery Agent

**Purpose:** Intelligent error recovery with classification, adaptive backoff, circuit breaker pattern, and fallback hierarchy.

**Improvements:**
- Error classification (transient, permanent, rate-limited, unknown)
- Adaptive backoff learning (learns best strategy per error type)
- Circuit breaker pattern (prevents cascade failures)
- Fallback chain execution (primary → secondary → cache → degradation)
- Error pattern detection (identifies systemic issues)

```js
class EnhancedRecovery extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      maxRetries: 3,
      baseBackoff: 1000,  // ms
      maxBackoff: 60000,  // 1 minute
      circuitBreakerThreshold: 5,
      circuitBreakerResetTime: 300000, // 5 minutes
      ...config
    };
    
    // State tracking
    this.retryAttempts = 0;
    this.errorHistory = [];
    this.circuitBreaker = new Map(); // provider → { failures, lastFailure, state }
    this.backoffStrategies = new Map(); // errorType → learned backoff
  }
  
  reset() {
    this.retryAttempts = 0;
    this.errorHistory = [];
    console.log('[EnhancedRecovery] State reset');
  }
  
  async invoke({ error, task, provider, context }) {
    this.emit('agent_recovery:started', { error: error.message });
    
    // 1. Classify error
    const classification = this._classifyError(error);
    
    // 2. Check circuit breaker
    if (this._isCircuitOpen(provider)) {
      this.emit('agent_recovery:circuit_open', { provider });
      return this._executeWithFallback(task, 'cache');
    }
    
    // 3. Retry with adaptive backoff
    if (classification.retryable && this.retryAttempts < this.config.maxRetries) {
      const backoffTime = this._getAdaptiveBackoff(classification.type);
      this.emit('agent_recovery:retry', {
        attempt: this.retryAttempts + 1,
        backoffMs: backoffTime,
        reason: classification.reason
      });
      
      await this._sleep(backoffTime);
      this.retryAttempts++;
      return await this._retry(task, provider);
    }
    
    // 4. Try provider fallback
    const alternatives = this._getAlternativeProviders(provider);
    for (const alt of alternatives) {
      this.emit('agent_recovery:switching_provider', { from: provider, to: alt });
      const result = await this._executeWithProvider(task, alt);
      if (result.success) {
        this._recordSuccess(alt); // Learn this works
        return result;
      }
    }
    
    // 5. Fallback chain execution
    const fallbacks = ['cache', 'degraded_mode', 'escalate'];
    for (const fallback of fallbacks) {
      this.emit('agent_recovery:fallback', { fallback });
      const result = await this._executeWithFallback(task, fallback);
      if (result.success) return result;
    }
    
    // 6. Escalate to user
    this.emit('agent_recovery:escalate', {
      error: error.message,
      task,
      reason: 'All recovery strategies exhausted',
      userAction: 'required'
    });
    
    return { success: false, escalated: true };
  }
  
  /**
   * Error classification
   */
  _classifyError(error) {
    const msg = error.message || '';
    
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
      return { type: 'timeout', retryable: true, reason: 'Network timeout' };
    }
    
    if (msg.includes('429') || msg.includes('rate limit')) {
      return { type: 'rate_limit', retryable: true, reason: 'Rate limit exceeded' };
    }
    
    if (msg.includes('401') || msg.includes('unauthorized')) {
      return { type: 'auth', retryable: false, reason: 'Authentication failed' };
    }
    
    if (msg.includes('503') || msg.includes('unavailable')) {
      return { type: 'unavailable', retryable: true, reason: 'Service unavailable' };
    }
    
    if (msg.includes('insufficient_quota') || msg.includes('quota')) {
      return { type: 'quota', retryable: false, reason: 'API quota exceeded' };
    }
    
    return { type: 'unknown', retryable: true, reason: msg };
  }
  
  /**
   * Adaptive backoff learning
   */
  _getAdaptiveBackoff(errorType) {
    // Check if we've learned best strategy for this error
    if (this.backoffStrategies.has(errorType)) {
      return this.backoffStrategies.get(errorType);
    }
    
    // Default exponential backoff
    const backoff = Math.min(
      this.config.baseBackoff * Math.pow(2, this.retryAttempts),
      this.config.maxBackoff
    );
    
    return backoff;
  }
  
  /**
   * Learn successful backoff strategies
   */
  _recordSuccess(provider) {
    // Mark provider as healthy
    if (this.circuitBreaker.has(provider)) {
      const cb = this.circuitBreaker.get(provider);
      cb.failures = Math.max(0, cb.failures - 1);
      cb.state = cb.failures < this.config.circuitBreakerThreshold ? 'closed' : 'open';
    }
  }
  
  /**
   * Circuit breaker pattern
   */
  _isCircuitOpen(provider) {
    if (!this.circuitBreaker.has(provider)) {
      this.circuitBreaker.set(provider, { failures: 0, lastFailure: null, state: 'closed' });
    }
    
    const cb = this.circuitBreaker.get(provider);
    
    // Reset if window passed
    if (cb.state === 'open' && Date.now() - cb.lastFailure > this.config.circuitBreakerResetTime) {
      cb.state = 'half-open';
      cb.failures = 0;
    }
    
    // Check if open
    if (cb.failures >= this.config.circuitBreakerThreshold) {
      cb.state = 'open';
      cb.lastFailure = Date.now();
      return true;
    }
    
    return false;
  }
  
  /**
   * Fallback execution chain
   */
  async _executeWithFallback(task, fallback) {
    switch (fallback) {
      case 'cache':
        // Try cached results
        return this._getFromCache(task);
      
      case 'degraded_mode':
        // Execute with reduced expectations
        return {
          success: true,
          result: 'degraded_response',
          cached: false,
          degraded: true
        };
      
      case 'escalate':
        return { success: false, escalated: true };
      
      default:
        return { success: false };
    }
  }
  
  _getFromCache(task) {
    // Check if result is cached
    if (this.cache?.has(task.id)) {
      return {
        success: true,
        result: this.cache.get(task.id),
        cached: true
      };
    }
    return { success: false };
  }
  
  _getAlternativeProviders(current) {
    const all = ['openai', 'anthropic', 'vllm'];
    return all.filter(p => p !== current);
  }
  
  async _retry(task, provider) {
    // Retry execution
    return { success: true }; // Simplified
  }
  
  async _executeWithProvider(task, provider) {
    // Execute with alternative provider
    return { success: true }; // Simplified
  }
  
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Benefits:**
- Intelligent classification (knows which errors are retryable)
- Learning-based backoff (improves over time)
- Circuit breaker (prevents cascade failures)
- Graceful degradation (cache, degraded mode, escalation)
- Systemic issue detection (patterns in error history)

#### Ethics Agent

**Purpose:** GDPR compliance, PII protection, rate limiting, content moderation, and safety guardrails.

```js
class EthicsAgent extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      piiRedaction: true,
      contentMode: 'permissive', // permissive | standard | strict
      rateLimit: 100, // requests per hour
      gdprCompliance: true,
      ...config
    };
    
    // PII patterns for detection
    this.piiPatterns = {
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
      bankAccount: /\b\d{8,17}\b/g
    };
    
    // Rate limiting tracker
    this.rateLimitTracker = new Map(); // userId → { count, resetTime }
    
    // Audit log
    this.auditLog = [];
  }
  
  reset() {
    this.auditLog = [];
    console.log('[EthicsAgent] State reset');
  }
  
  async invoke({ userMessage, userId, provider, context }) {
    this.emit('agent_ethics:started');
    
    const violations = [];
    const actions = [];
    
    // 1. Check rate limiting
    const rateLimited = this._checkRateLimit(userId);
    if (rateLimited) {
      violations.push({
        type: 'rate_limit',
        severity: 'warning',
        message: `User ${userId} exceeded rate limit (100/hour)`
      });
      actions.push('rate_limit');
    }
    
    // 2. Detect PII
    const piiDetected = this._detectPII(userMessage);
    if (piiDetected.found && this.config.piiRedaction) {
      violations.push({
        type: 'pii_detected',
        severity: 'high',
        piiTypes: piiDetected.types,
        message: 'PII detected and will be redacted'
      });
      actions.push('redact_pii');
    }
    
    // 3. Content moderation
    const moderation = await this._moderateContent(userMessage, provider);
    if (moderation.flagged) {
      violations.push({
        type: 'content_policy',
        severity: moderation.severity,
        categories: moderation.categories,
        message: 'Content violates policy'
      });
      actions.push('content_filtered');
    }
    
    // 4. GDPR compliance checks
    if (this.config.gdprCompliance) {
      const gdpr = await this._checkGDPRCompliance(userMessage, context);
      if (gdpr.violations.length > 0) {
        violations.push(...gdpr.violations);
        actions.push(...gdpr.actions);
      }
    }
    
    // 5. Audit log entry
    this._logAudit({
      timestamp: Date.now(),
      userId,
      violations,
      actions,
      messageHash: this._hash(userMessage)
    });
    
    this.emit('agent_ethics:completed', {
      violations,
      actions,
      approved: violations.length === 0,
      redactedMessage: this.config.piiRedaction ? this._redactPII(userMessage) : userMessage
    });
    
    return {
      approved: violations.length === 0,
      violations,
      actions,
      message: this.config.piiRedaction ? this._redactPII(userMessage) : userMessage
    };
  }
  
  /**
   * Rate limiting per user/hour
   */
  _checkRateLimit(userId) {
    const now = Date.now();
    const hourAgo = now - 3600000;
    
    if (!this.rateLimitTracker.has(userId)) {
      this.rateLimitTracker.set(userId, { count: 0, resetTime: now + 3600000 });
    }
    
    const tracker = this.rateLimitTracker.get(userId);
    
    // Reset if window passed
    if (now > tracker.resetTime) {
      tracker.count = 0;
      tracker.resetTime = now + 3600000;
    }
    
    tracker.count++;
    return tracker.count > this.config.rateLimit;
  }
  
  /**
   * PII detection
   */
  _detectPII(text) {
    const found = [];
    const types = [];
    
    for (const [type, pattern] of Object.entries(this.piiPatterns)) {
      if (pattern.test(text)) {
        found.push(...text.match(pattern));
        types.push(type);
      }
    }
    
    return {
      found: found.length > 0,
      types,
      count: found.length
    };
  }
  
  /**
   * PII redaction
   */
  _redactPII(text) {
    let redacted = text;
    
    for (const pattern of Object.values(this.piiPatterns)) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    
    return redacted;
  }
  
  /**
   * Content moderation
   */
  async _moderateContent(text, provider) {
    // Simple keyword-based moderation (replace with actual API if needed)
    const restrictedKeywords = {
      violence: ['kill', 'murder', 'attack'],
      hate: ['hate', 'racist', 'discriminate'],
      adult: ['sexual', 'pornographic']
    };
    
    const textLower = text.toLowerCase();
    const flaggedCategories = [];
    
    for (const [category, keywords] of Object.entries(restrictedKeywords)) {
      for (const keyword of keywords) {
        if (textLower.includes(keyword)) {
          flaggedCategories.push(category);
          break;
        }
      }
    }
    
    const flagged = flaggedCategories.length > 0;
    const severity = flagged ? (flaggedCategories.includes('violence') ? 'high' : 'medium') : 'low';
    
    return {
      flagged,
      categories: flaggedCategories,
      severity
    };
  }
  
  /**
   * GDPR compliance checks
   */
  async _checkGDPRCompliance(message, context) {
    const violations = [];
    const actions = [];
    
    // Check 1: Data retention (auto-delete after 90 days)
    if (context.createdAt && Date.now() - context.createdAt > 7776000000) { // 90 days
      violations.push({
        type: 'gdpr_retention',
        severity: 'warning',
        message: 'Data exceeds GDPR retention period (90 days)'
      });
      actions.push('schedule_deletion');
    }
    
    // Check 2: Right to be forgotten (user request detection)
    if (message.toLowerCase().includes('delete my data') || message.includes('right to be forgotten')) {
      violations.push({
        type: 'gdpr_right_to_be_forgotten',
        severity: 'high',
        message: 'User exercising right to be forgotten'
      });
      actions.push('initiate_data_deletion');
    }
    
    // Check 3: Consent verification
    if (!context.consentGiven) {
      violations.push({
        type: 'gdpr_consent',
        severity: 'high',
        message: 'No valid consent for data processing'
      });
      actions.push('request_consent');
    }
    
    return { violations, actions };
  }
  
  /**
   * Audit logging
   */
  _logAudit(entry) {
    this.auditLog.push(entry);
    
    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
    
    // Log to persistent storage in production
    console.log('[EthicsAgent:Audit]', JSON.stringify(entry));
  }
  
  _hash(text) {
    // Simple hash for audit log (don't store actual message)
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(16);
  }
  
  /**
   * Get audit log
   */
  getAuditLog(filters = {}) {
    return this.auditLog.filter(entry => {
      if (filters.userId && entry.userId !== filters.userId) return false;
      if (filters.from && entry.timestamp < filters.from) return false;
      if (filters.to && entry.timestamp > filters.to) return false;
      return true;
    });
  }
}
```

**Benefits:**
- PII protection (automatic redaction)
- Rate limiting (prevents abuse)
- Content moderation (permissive/standard/strict modes)
- GDPR compliance (retention, right to be forgotten, consent)
- Audit trail (for compliance and debugging)

**Integration Timeline:**
- Enhanced Memory Agent, Enhanced Recovery Agent, Ethics Agent (v1.x Late)
- Human-in-the-Loop, Cancel Logic, Full UI Implementation (v1.x Late)
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

**Event Flow Architecture Benefits:**
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
- **_modules/ for domain-specific tools**. `lib/ai/tools/` is the initial registry only

### 6. Security
- **No API keys in logs**, redact in audit logs
- **Tool sandboxing**: each tool runs in isolated context
- **Critic validation mandatory** for system-modifying tools


## Best Practices Summary

### Architecture Patterns
**EventEmitter for all agents** (decoupling)  
**SessionContext for DI** (agent lifecycle management)  
**Event relay pattern** (Agent → SessionContext → Socket)  
**Constructor-based listener registration** (memory leak prevention)  
**Simple state tracking** (preparing for FSM)  
**Provider adapters are thin** (no agent logic)  

### Code Quality
**Private methods prefixed with _**  
**Export only public APIs when needed**  
**Dependency Injection over instantiation**  
**Pure functions for tools**  
**YAGNI**: Don't over-engineer (State Machine only when needed)  

### Future-Proofing
**Scheduler is FSM candidate** (conditional replanning, recovery)  
**All agents have reset()** (State Machine migration ready)  
**Event-driven architecture** (observability, monitoring ready)  

## Strategic Principle: Domain-First Agent Design

EDIFACTS follows **Domain-First Agent Design**:

- The EDIFACT engine is the **single source of truth** for domain semantics
- LLMs are **explainers, planners, and orchestrators** – never authorities on business rules
- The agentic layer must remain:
  - **Provider-agnostic** (swap OpenAI ↔ Anthropic ↔ vLLM)
  - **Deterministic in control flow** (reproducible execution as much as possible)
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
