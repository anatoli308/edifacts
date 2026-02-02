# Anticipation Agent (Predictive Processing)

**Status:** Planned (v2.x Mid)  
**Human Analog:** Predictive Coding, Intuition, Expectation  
**Priority:** ⭐ (Low-Medium - UX enhancement)

## Purpose

The Anticipation Agent predicts user intent and pre-loads relevant context. It makes the system feel "intuitive" by anticipating next questions, detecting incomplete inputs, and preparing resources before they're needed.

## Core Capabilities

### 1. Next Question Prediction
- Analyzes conversation flow to predict likely follow-up questions
- Pre-loads context for top-3 predicted questions
- Reduces latency for common workflows

### 2. Incomplete Input Detection
- Identifies ambiguous or incomplete user queries
- Suggests clarifications before execution
- Prevents wasted LLM calls on unclear requests

### 3. Contextual Pre-loading
- Loads relevant documentation ahead of time
- Prepares tool configurations for likely operations
- Caches common query results

### 4. Workflow Recognition
- Detects common user patterns (e.g., "analyze → validate → explain")
- Optimizes multi-step processes
- Suggests next logical steps

## Architecture

```js
class AnticipationAgent extends EventEmitter {
  constructor() {
    super();
    this.conversationPatterns = new Map(); // Pattern → Frequency
    this.preloadedContext = new Map(); // Question → Context
  }
  
  /**
   * Predict next user questions
   */
  async predict({ conversationHistory, currentContext }) {
    this.emit('agent_anticipation:started');
    
    // Extract conversation pattern
    const pattern = this._extractPattern(conversationHistory);
    
    // Find common next questions for this pattern
    const likelyQuestions = await this._predictNextQuestions(pattern, currentContext);
    
    // Pre-load context for top-3 predictions
    for (const question of likelyQuestions.slice(0, 3)) {
      await this._preloadContext(question);
    }
    
    this.emit('agent_anticipation:completed', {
      predictions: likelyQuestions,
      preloaded: likelyQuestions.slice(0, 3).length
    });
    
    return likelyQuestions;
  }
  
  /**
   * Detect incomplete or ambiguous input
   */
  async detectIncomplete({ userMessage, context }) {
    this.emit('agent_anticipation:analyzing_input', { userMessage });
    
    const issues = [];
    
    // Check for ambiguous references
    if (this._hasAmbiguousReference(userMessage)) {
      issues.push({
        type: 'ambiguous_reference',
        message: 'Which segment do you mean?',
        suggestions: this._extractPossibleReferences(userMessage, context)
      });
    }
    
    // Check for missing information
    if (this._isMissingInformation(userMessage, context)) {
      issues.push({
        type: 'missing_information',
        message: 'I need more details to help you',
        suggestions: this._suggestRequiredInfo(userMessage)
      });
    }
    
    // Check for multiple intents
    if (this._hasMultipleIntents(userMessage)) {
      issues.push({
        type: 'multiple_intents',
        message: 'Do you want me to do all of these?',
        suggestions: this._splitIntents(userMessage)
      });
    }
    
    if (issues.length > 0) {
      this.emit('agent_anticipation:incomplete_detected', { issues });
      return {
        incomplete: true,
        issues,
        recommendedAction: 'request_clarification'
      };
    }
    
    this.emit('agent_anticipation:input_valid');
    return { incomplete: false };
  }
  
  /**
   * Extract conversation pattern
   */
  _extractPattern(history) {
    // Convert conversation to pattern
    // E.g., ["explain_invoic", "list_segments", "validate_bgm"] → "analysis_workflow"
    const topics = history.map(msg => this._classifyTopic(msg.content));
    return topics.join(' → ');
  }
  
  /**
   * Predict next questions based on pattern
   */
  async _predictNextQuestions(pattern, context) {
    // Common patterns in EDIFACT analysis
    const commonPatterns = {
      'explain_message': [
        'What segments are mandatory?',
        'Show me an example',
        'How do I validate this?'
      ],
      'explain_segment': [
        'What are the qualifiers?',
        'Is this mandatory?',
        'Show me in context'
      ],
      'validate_message': [
        'What errors did you find?',
        'How do I fix this?',
        'Is this compliant with EANCOM?'
      ],
      'list_segments': [
        'Explain segment X',
        'Which are mandatory?',
        'Show dependencies'
      ]
    };
    
    // Find matching pattern
    for (const [key, predictions] of Object.entries(commonPatterns)) {
      if (pattern.includes(key)) {
        return predictions.map(q => ({
          question: q,
          confidence: 0.7 + Math.random() * 0.2, // 0.7-0.9
          context: context
        }));
      }
    }
    
    return [];
  }
  
  /**
   * Pre-load context for predicted question
   */
  async _preloadContext(prediction) {
    // Fetch and cache relevant context
    const context = await this._fetchRelevantContext(prediction.question);
    this.preloadedContext.set(prediction.question, context);
    
    this.emit('agent_anticipation:preloaded', {
      question: prediction.question,
      contextSize: JSON.stringify(context).length
    });
  }
  
  /**
   * Check for ambiguous references
   */
  _hasAmbiguousReference(message) {
    const ambiguousWords = ['it', 'this', 'that', 'the segment', 'the message'];
    return ambiguousWords.some(word => 
      message.toLowerCase().includes(word)
    );
  }
  
  /**
   * Check for missing information
   */
  _isMissingInformation(message, context) {
    // If user asks about "the message" but no message uploaded
    if (message.includes('message') && !context.currentMessage) {
      return true;
    }
    
    // If user asks about "segment" without specifying which
    if (message.toLowerCase().includes('segment') && 
        !this._hasSpecificSegmentMention(message)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check for multiple intents
   */
  _hasMultipleIntents(message) {
    const intentKeywords = ['and', 'also', 'then', 'after that'];
    return intentKeywords.some(kw => message.toLowerCase().includes(kw));
  }
  
  reset() {
    this.preloadedContext.clear();
    console.log('[Anticipation] State reset');
  }
}
```

## Use Cases

### 1. Question Prediction
```js
// User: "What is INVOIC?"
await anticipation.predict({
  conversationHistory: [
    { role: 'user', content: 'What is INVOIC?' }
  ],
  currentContext: { topic: 'INVOIC' }
});

// Pre-loads context for:
// - "What segments are mandatory in INVOIC?"
// - "Show me an INVOIC example"
// - "How do I validate INVOIC?"

// Next user question is instant (context already loaded!)
```

### 2. Incomplete Input Detection
```js
// User: "Explain the segment"
const result = await anticipation.detectIncomplete({
  userMessage: "Explain the segment",
  context: { hasMultipleSegments: true }
});

// Result:
// {
//   incomplete: true,
//   issues: [{
//     type: 'ambiguous_reference',
//     message: 'Which segment do you mean?',
//     suggestions: ['BGM', 'DTM', 'NAD', 'LOC']
//   }]
// }
```

### 3. Workflow Recognition
```js
// User completes: explain → validate → fix
// System recognizes "error-fixing workflow"
// Pre-loads: documentation, common solutions, validation rules
```

## Integration Points

- **Agent Handlers:** Calls before executing main flow
- **Memory Agent:** Provides conversation history for prediction
- **UI:** Shows "You might want to..." suggestions
- **Executor:** Uses pre-loaded context for faster execution

## Events

```js
// Emitted events:
'agent_anticipation:started' - Prediction started
'agent_anticipation:completed' - Predictions generated
'agent_anticipation:analyzing_input' - Checking for completeness
'agent_anticipation:incomplete_detected' - Issues found
'agent_anticipation:input_valid' - Input is complete
'agent_anticipation:preloaded' - Context pre-loaded
```

## Implementation Priority

**Phase 1 (v2.x Mid - Q1 2027):**
- Basic pattern recognition (hardcoded patterns)
- Simple incomplete detection
- Manual pre-loading

**Phase 2 (v2.x Late - Q2 2027):**
- ML-based prediction
- Advanced ambiguity detection
- Automatic context caching

## Benefits

- ⚡ **Speed:** Pre-loading reduces response time by 50%
- 🎯 **UX:** System feels "intuitive"
- 💬 **Clarity:** Catches unclear questions early
- 🔄 **Efficiency:** Reduces back-and-forth clarifications

## Notes

- Requires conversation history analysis
- Should be non-blocking (predictions in background)
- Consider privacy: don't predict sensitive queries
- May need ML model for advanced prediction (Phase 2)
