# Learning Agent (Experience & RAG)

**Status:** Planned (v2.x Early)  
**Human Analog:** Synaptic Plasticity, Long-term Learning, Experience  
**Priority:** ⭐⭐ (Medium - Improves over time)

## Purpose

The Learning Agent stores and retrieves solved problems as "experience". It learns from every execution, building a knowledge base of successful solutions. Unlike Memory Agent (which focuses on conversation context), Learning Agent focuses on **problem-solving patterns** and **tool effectiveness**.

## Core Difference: Memory vs Learning

| Aspect | Memory Agent | Learning Agent |
|--------|-------------|----------------|
| **Scope** | Session-specific | Global, cross-session |
| **Focus** | Conversation context | Problem solutions |
| **Lifetime** | Session duration | Persistent forever |
| **Data** | "What did user say?" | "How did we solve X?" |
| **Storage** | In-memory + DB | Vector DB (RAG) |

**Example:**
- Memory: "User asked about INVOIC segment BGM 5 minutes ago"
- Learning: "We solved 'explain BGM' 100 times, best solution is X"

## Core Capabilities

### 1. Experience Storage (RAG)
- Stores every solved task with embeddings
- Includes: task, solution, tools used, success feedback
- Vector search for similar problems

### 2. Tool Performance Tracking
- Tracks which tools work best for which tasks
- Success rates, average duration, error patterns
- Recommends optimal tools per task type

### 3. Solution Retrieval
- Finds similar previously-solved problems
- Returns top-k solutions with confidence scores
- Adapts solutions to current context

### 4. Continuous Improvement
- Updates success rates based on user feedback
- Prunes low-quality solutions
- Identifies knowledge gaps

## Architecture

```js
class LearningAgent extends EventEmitter {
  constructor() {
    super();
    this.vectorStore = null; // Chroma, Pinecone, or local embeddings
    this.toolUsageStats = new Map(); // Tool → Stats
    this.solutionCache = new Map(); // Recent solutions (fast access)
  }
  
  /**
   * Learn from successful execution
   */
  async learn({ task, solution, toolsUsed, feedback }) {
    this.emit('agent_learning:started', { task: task.description });
    
    // Create embedding for task
    const embedding = await this._embed(task.description);
    
    // Store in vector database
    await this.vectorStore.store({
      id: this._generateId(),
      task: task.description,
      taskType: task.type,
      solution: solution.result,
      reasoning: solution.reasoning,
      toolsUsed,
      feedback,
      successScore: feedback.success ? 1.0 : 0.0,
      timestamp: Date.now(),
      embedding
    });
    
    // Update tool statistics
    this._updateToolStats(toolsUsed, feedback.success);
    
    // Add to cache
    this.solutionCache.set(task.description, solution);
    
    this.emit('agent_learning:completed', {
      stored: true,
      similarCount: await this._countSimilar(embedding)
    });
  }
  
  /**
   * Recall similar solved problems
   */
  async recall({ task, k = 3 }) {
    this.emit('agent_learning:recall_started', { task });
    
    // Check cache first
    if (this.solutionCache.has(task)) {
      return [{ solution: this.solutionCache.get(task), source: 'cache' }];
    }
    
    // Search vector store
    const embedding = await this._embed(task);
    const similar = await this.vectorStore.search(embedding, k);
    
    // Filter by success score
    const successfulSolutions = similar.filter(s => s.successScore > 0.7);
    
    this.emit('agent_learning:recall_completed', {
      found: successfulSolutions.length,
      topScore: successfulSolutions[0]?.successScore || 0
    });
    
    return successfulSolutions.map(s => ({
      solution: s.solution,
      reasoning: s.reasoning,
      confidence: s.successScore,
      similarity: s.distance,
      source: 'experience'
    }));
  }
  
  /**
   * Get best tool for task type
   */
  getBestTool(taskType) {
    const tools = Array.from(this.toolUsageStats.values())
      .filter(t => t.taskType === taskType)
      .sort((a, b) => b.successRate - a.successRate);
    
    return tools[0] || null;
  }
  
  /**
   * Get tool performance report
   */
  getToolPerformance(toolName) {
    const stats = this.toolUsageStats.get(toolName);
    
    if (!stats) {
      return { error: 'Tool not found' };
    }
    
    return {
      toolName,
      totalUses: stats.totalUses,
      successRate: stats.successRate,
      avgDuration: stats.avgDuration,
      commonErrors: stats.commonErrors,
      bestTaskTypes: stats.bestFor
    };
  }
  
  /**
   * Update tool statistics
   */
  _updateToolStats(toolsUsed, success) {
    for (const tool of toolsUsed) {
      if (!this.toolUsageStats.has(tool.name)) {
        this.toolUsageStats.set(tool.name, {
          name: tool.name,
          totalUses: 0,
          successes: 0,
          failures: 0,
          totalDuration: 0,
          successRate: 0,
          avgDuration: 0,
          commonErrors: [],
          bestFor: []
        });
      }
      
      const stats = this.toolUsageStats.get(tool.name);
      stats.totalUses++;
      stats.totalDuration += tool.duration || 0;
      
      if (success) {
        stats.successes++;
      } else {
        stats.failures++;
        if (tool.error) {
          stats.commonErrors.push(tool.error);
        }
      }
      
      stats.successRate = stats.successes / stats.totalUses;
      stats.avgDuration = stats.totalDuration / stats.totalUses;
    }
  }
  
  /**
   * Create embedding for text
   */
  async _embed(text) {
    // Use OpenAI embeddings or local model
    // TODO: Implement based on chosen provider
    return null; // Placeholder
  }
  
  reset() {
    // Clear cache, keep persistent storage
    this.solutionCache.clear();
    console.log('[Learning] Cache cleared (vector store preserved)');
  }
}
```

## Use Cases

### 1. Fast Problem Solving
```js
// User asks: "What is BGM segment?"
const similar = await learning.recall({ task: "Explain BGM segment", k: 3 });

if (similar.length > 0 && similar[0].confidence > 0.9) {
  // High confidence → reuse solution (skip LLM call!)
  return similar[0].solution;
}
// Low confidence → ask LLM, then learn from it
```

### 2. Tool Recommendation
```js
// Executor needs to parse EDIFACT
const bestTool = learning.getBestTool('parse_edifact');
// Result: { name: 'parseSegment', successRate: 0.95, avgDuration: 120ms }
```

### 3. Knowledge Gap Detection
```js
// Identify topics with few solved examples
const gaps = await learning.identifyGaps();
// Result: [
//   { topic: 'EANCOM subset validation', solutions: 2 },
//   { topic: 'LOC segment qualifier rules', solutions: 1 }
// ]
```

## Integration Points

- **Executor:** Requests tool recommendations
- **Planner:** Checks for similar plans before creating new ones
- **Critic:** Compares solutions against historical best practices
- **UI:** Shows "Learn from this" / "Mark as good solution" buttons
- **Database:** Vector DB for embeddings (Chroma, Pinecone)

## Events

```js
// Emitted events:
'agent_learning:started' - Learning process started
'agent_learning:completed' - Solution stored
'agent_learning:recall_started' - Searching for similar problems
'agent_learning:recall_completed' - Similar solutions found
```

## Implementation Priority

**Phase 1 (v2.x Early - Q4 2026):**
- Basic vector store integration (Chroma or local)
- Simple recall functionality
- Tool usage tracking

**Phase 2 (v2.x Mid - Q1 2027):**
- Advanced similarity search
- Automatic solution pruning (remove low-quality)
- User feedback integration ("This answer was helpful")

**Phase 3 (v2.x Late - Q2 2027):**
- Fine-tuned embeddings for EDIFACT domain
- Cross-session learning patterns
- Collaborative filtering (learn from all users)

## Technology Stack

**Vector Database Options:**
- **Chroma** (local, easy setup)
- **Pinecone** (cloud, scalable)
- **Weaviate** (self-hosted, powerful)

**Embedding Models:**
- OpenAI `text-embedding-3-small` (fast, cheap)
- Cohere Embeddings (domain-specific)
- Local Sentence-Transformers (privacy)

## Benefits

- ⚡ **Speed:** Skip LLM calls for known problems (10x faster)
- 💰 **Cost:** Reduce token usage by 30-50%
- 🎯 **Accuracy:** Learn from past successes
- 📊 **Insights:** Identify knowledge gaps
- 🔧 **Tool Optimization:** Use best tools automatically

## Notes

- Requires vector database infrastructure
- Should support both cloud and on-premise deployments
- User feedback loop critical for quality
- Consider GDPR: embeddings should not contain PII
