# Meta-Cognitive Agent (Self-Optimization)

**Status:** Planned (v1.x Late or v2.x Early)  
**Human Analog:** Executive Function, Self-Reflection, "Thinking about Thinking"  
**Priority:** ⭐⭐⭐ (High - Optimizes entire system)

## Purpose

The Meta-Cognitive Agent observes and optimizes the behavior of all other agents over time. It acts as the "brain's CEO" - monitoring performance, identifying patterns, and making strategic decisions about how agents should work together.

## Core Capabilities

### 1. Performance Monitoring
- Tracks success rates of all agents
- Measures execution time and resource usage
- Identifies bottlenecks and failure patterns

### 2. Strategy Selection
- Decides: Sequential, Parallel, or Competitive execution?
- Adapts strategy based on task complexity
- Routes tasks to best-suited agents

### 3. Self-Optimization
- Detects recurring problems (e.g., "Planner always fails on EANCOM")
- Recommends configuration changes
- A/B tests different approaches

### 4. Agent Coordination
- Determines optimal agent collaboration patterns
- Balances speed vs accuracy tradeoffs
- Manages resource allocation

## Architecture

```js
class MetaCognitiveAgent extends EventEmitter {
  constructor() {
    super();
    this.performanceHistory = new Map(); // Agent → Performance Metrics
    this.strategicInsights = [];
    this.executionStrategies = ['sequential', 'parallel', 'competitive'];
  }
  
  /**
   * Observe agent execution and learn from it
   */
  async observe({ agent, task, result, duration, success }) {
    this.emit('agent_meta:observation', { agent, task, result });
    
    // Store performance data
    this._recordPerformance(agent, {
      taskType: task.type,
      complexity: task.complexity,
      duration,
      success,
      timestamp: Date.now()
    });
    
    // Analyze for patterns
    const insight = await this._analyzePerformance(agent, task, result);
    
    if (insight.shouldOptimize) {
      this.emit('agent_meta:recommendation', {
        agent,
        suggestion: insight.suggestion,
        reason: insight.reason,
        expectedImprovement: insight.impact
      });
    }
    
    return insight;
  }
  
  /**
   * Select optimal execution strategy for a task
   */
  async selectStrategy({ task, context }) {
    this.emit('agent_meta:strategy_selection', { task });
    
    // Analyze task characteristics
    const complexity = this._estimateComplexity(task);
    const parallelizable = this._isParallelizable(task);
    const requiresHighAccuracy = task.critical || context.userDemandedPrecision;
    
    let strategy;
    
    // High complexity + critical → Competitive (Best-of-N)
    if (complexity > 0.8 && requiresHighAccuracy) {
      strategy = 'competitive';
    }
    // Low complexity + parallelizable → Parallel
    else if (complexity < 0.5 && parallelizable) {
      strategy = 'parallel';
    }
    // Default → Sequential
    else {
      strategy = 'sequential';
    }
    
    this.emit('agent_meta:strategy_selected', { task, strategy, complexity });
    return strategy;
  }
  
  /**
   * Get performance report for specific agent
   */
  getAgentPerformance(agentName) {
    const history = this.performanceHistory.get(agentName) || [];
    
    return {
      totalExecutions: history.length,
      successRate: history.filter(h => h.success).length / history.length,
      avgDuration: history.reduce((sum, h) => sum + h.duration, 0) / history.length,
      commonFailures: this._identifyCommonFailures(history),
      recommendations: this._generateRecommendations(history)
    };
  }
  
  /**
   * Analyze performance patterns
   */
  _analyzePerformance(agent, task, result) {
    const history = this.performanceHistory.get(agent) || [];
    
    // Check for recurring failures
    const recentFailures = history.slice(-10).filter(h => !h.success);
    if (recentFailures.length > 5) {
      return {
        shouldOptimize: true,
        suggestion: 'Increase timeout or add retry logic',
        reason: `${agent} has high failure rate (50%+) recently`,
        impact: 'high'
      };
    }
    
    // Check for slow performance
    const avgDuration = history.reduce((sum, h) => sum + h.duration, 0) / history.length;
    if (result.duration > avgDuration * 2) {
      return {
        shouldOptimize: true,
        suggestion: 'Consider caching or parallel execution',
        reason: `${agent} took 2x longer than average`,
        impact: 'medium'
      };
    }
    
    return { shouldOptimize: false };
  }
  
  /**
   * Estimate task complexity (0.0 - 1.0)
   */
  _estimateComplexity(task) {
    let complexity = 0;
    
    // More subtasks → higher complexity
    complexity += Math.min(task.subtasks?.length || 0, 10) / 10 * 0.3;
    
    // Dependencies → higher complexity
    complexity += Math.min(task.dependencies?.length || 0, 5) / 5 * 0.3;
    
    // Length of user query → complexity
    complexity += Math.min(task.userMessage?.length || 0, 500) / 500 * 0.2;
    
    // Keywords indicating complexity
    const complexKeywords = ['complex', 'detailed', 'comprehensive', 'explain why'];
    const hasComplexKeywords = complexKeywords.some(kw => 
      task.userMessage?.toLowerCase().includes(kw)
    );
    complexity += hasComplexKeywords ? 0.2 : 0;
    
    return Math.min(complexity, 1.0);
  }
  
  /**
   * Check if task can be parallelized
   */
  _isParallelizable(task) {
    // Tasks with independent subtasks can be parallelized
    if (!task.subtasks || task.subtasks.length < 2) return false;
    
    // Check for dependencies
    const hasDependencies = task.subtasks.some(st => st.dependencies?.length > 0);
    return !hasDependencies;
  }
  
  reset() {
    // Keep performance history (persistent across sessions)
    console.log('[MetaCognitive] State reset (history preserved)');
  }
}
```

## Use Cases

### 1. Automatic Strategy Selection
```js
// User: "Analyze this complex INVOIC message"
const strategy = await metaCognitive.selectStrategy({
  task: { complexity: 0.9, critical: true },
  context: { userDemandedPrecision: true }
});
// Result: 'competitive' → Use Best-of-N with 3 executors
```

### 2. Performance Optimization
```js
// Meta-Cognitive observes: Planner fails 60% on EANCOM
metaCognitive.emit('agent_meta:recommendation', {
  agent: 'Planner',
  suggestion: 'Add more EANCOM examples to prompt',
  reason: 'High failure rate on EANCOM subset detection',
  expectedImprovement: '30% success rate increase'
});
```

### 3. Resource Management
```js
// System under high load
const decision = await metaCognitive.selectStrategy({
  task: { complexity: 0.3 },
  context: { systemLoad: 0.9 }
});
// Result: 'sequential' (save resources, parallel would overload)
```

## Integration Points

- **Orchestrator:** Receives strategy recommendations
- **All Agents:** Send performance metrics to MetaCognitive
- **UI:** Displays optimization insights to admins
- **Database:** Persists performance history for long-term learning

## Events

```js
// Emitted events:
'agent_meta:observation' - Agent performance observed
'agent_meta:recommendation' - Optimization suggestion generated
'agent_meta:strategy_selection' - Strategy selection started
'agent_meta:strategy_selected' - Strategy chosen
```

## Implementation Priority

**Phase 1 (v1.x Late - Q3 2026):**
- Basic performance monitoring
- Simple strategy selection (sequential vs parallel)
- Performance reports

**Phase 2 (v2.x Early - Q4 2026):**
- Advanced pattern recognition
- A/B testing support
- Automatic optimization recommendations

**Phase 3 (v2.x Late - Q1 2027):**
- Machine learning for strategy selection
- Predictive performance modeling
- Self-tuning agent parameters

## Benefits

- 🚀 **Speed:** Automatically selects fastest execution strategy
- 🎯 **Accuracy:** Routes critical tasks to competitive execution
- 💰 **Cost:** Optimizes token usage by avoiding unnecessary parallel execution
- 🔄 **Self-Improvement:** System gets better over time without manual tuning
- 📊 **Observability:** Provides insights into system health

## Notes

- Performance history should be persisted across restarts
- Consider using time-series database for metrics
- May require ML model for advanced complexity estimation (Phase 3)
- Should respect user-configured strategies (manual override)
