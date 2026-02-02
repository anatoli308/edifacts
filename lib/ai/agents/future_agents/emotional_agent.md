# Emotional Intelligence Agent

**Status:** Planned (v2.x Late)  
**Human Analog:** Emotional Intelligence, Empathy, Limbic System  
**Priority:** ⭐ (Low - UX polish, nice-to-have)

## Purpose

The Emotional Agent detects user sentiment and adapts communication style accordingly. It makes interactions feel more human by recognizing frustration, confusion, or satisfaction and adjusting tone appropriately.

## Core Capabilities

### 1. Sentiment Detection
- Analyzes user messages for emotional tone
- Detects: frustrated, confused, satisfied, impatient, curious
- Tracks sentiment trends over conversation

### 2. Tone Adaptation
- Adjusts response style based on sentiment
- Frustrated → Empathetic, apologetic
- Confused → Clearer, more examples
- Satisfied → Encouraging, brief

### 3. De-escalation
- Recognizes when user is upset
- Offers human support escalation
- Apologizes for failures

### 4. Encouragement
- Celebrates user progress
- Provides positive reinforcement
- Suggests next learning steps

## Architecture

```js
class EmotionalAgent extends EventEmitter {
  constructor() {
    super();
    this.sentimentHistory = new Map(); // userId → [sentiments]
  }
  
  /**
   * Analyze user sentiment
   */
  async analyze({ userMessage, userId, conversationHistory }) {
    this.emit('agent_emotional:started');
    
    // Detect sentiment
    const sentiment = await this._detectSentiment(userMessage, conversationHistory);
    
    // Store sentiment history
    this._recordSentiment(userId, sentiment);
    
    // Check for trends
    const trend = this._analyzeTrend(userId);
    
    // Generate response adaptation
    const adaptation = await this._adaptResponse(sentiment, trend);
    
    this.emit('agent_emotional:completed', { sentiment, adaptation });
    
    return {
      sentiment: sentiment.type,
      confidence: sentiment.confidence,
      trend,
      adaptation
    };
  }
  
  /**
   * Detect sentiment from message
   */
  async _detectSentiment(message, history) {
    const indicators = {
      frustrated: {
        keywords: ['not working', 'doesnt work', 'broken', '!!!', 'still', 'again', 'why'],
        patterns: [/what the (hell|heck)/, /this (sucks|is terrible)/, /i (hate|cant stand)/]
      },
      confused: {
        keywords: ['confusing', 'dont understand', 'unclear', 'makes no sense', 'what do you mean'],
        patterns: [/i (dont|don't) (get|understand)/, /why (would|is)/, /confused about/]
      },
      satisfied: {
        keywords: ['thanks', 'perfect', 'great', 'exactly', 'works', 'helpful', 'appreciate'],
        patterns: [/thank(s| you)/, /that('s| is) (great|perfect|good)/, /very helpful/]
      },
      impatient: {
        keywords: ['hurry', 'fast', 'quick', 'now', 'asap', 'waiting'],
        patterns: [/can you (hurry|speed up)/, /taking too long/, /still waiting/]
      }
    };
    
    const lowerMessage = message.toLowerCase();
    
    // Check for indicators
    for (const [type, { keywords, patterns }] of Object.entries(indicators)) {
      const keywordMatch = keywords.some(kw => lowerMessage.includes(kw));
      const patternMatch = patterns.some(p => p.test(lowerMessage));
      
      if (keywordMatch || patternMatch) {
        return {
          type,
          confidence: keywordMatch && patternMatch ? 0.9 : 0.7,
          indicators: [...keywords.filter(kw => lowerMessage.includes(kw))]
        };
      }
    }
    
    return { type: 'neutral', confidence: 0.5, indicators: [] };
  }
  
  /**
   * Adapt response based on sentiment
   */
  async _adaptResponse(sentiment, trend) {
    const adaptations = {
      frustrated: {
        tone: 'empathetic',
        prefix: 'I understand this is frustrating. Let me help clarify:',
        actions: [
          'Simplify explanation',
          'Offer alternative approach',
          'Suggest human support if persistent'
        ],
        responseStyle: {
          brevity: 'concise',
          technicality: 'simple',
          examples: 'many'
        }
      },
      
      confused: {
        tone: 'patient',
        prefix: 'Let me explain that more clearly:',
        actions: [
          'Add more examples',
          'Use analogies',
          'Break into smaller steps',
          'Add visual aids'
        ],
        responseStyle: {
          brevity: 'detailed',
          technicality: 'simple',
          examples: 'many'
        }
      },
      
      satisfied: {
        tone: 'encouraging',
        prefix: 'Great! ',
        actions: [
          'Keep response brief',
          'Suggest next steps',
          'Offer related topics'
        ],
        responseStyle: {
          brevity: 'brief',
          technicality: 'maintain_current',
          examples: 'few'
        }
      },
      
      impatient: {
        tone: 'efficient',
        prefix: '',
        actions: [
          'Skip verbose explanations',
          'Provide direct answer first',
          'Details as optional expansion'
        ],
        responseStyle: {
          brevity: 'very_brief',
          technicality: 'maintain_current',
          examples: 'minimal'
        }
      },
      
      neutral: {
        tone: 'professional',
        prefix: '',
        actions: ['Standard response'],
        responseStyle: {
          brevity: 'balanced',
          technicality: 'appropriate',
          examples: 'balanced'
        }
      }
    };
    
    let adaptation = adaptations[sentiment.type] || adaptations.neutral;
    
    // Check for escalation need
    if (trend.decliningExperience && sentiment.type === 'frustrated') {
      adaptation.escalate = true;
      adaptation.prefix = 'I apologize for the continued issues. ' + adaptation.prefix;
      adaptation.actions.push('Offer human support immediately');
    }
    
    return adaptation;
  }
  
  /**
   * Analyze sentiment trend
   */
  _analyzeTrend(userId) {
    const history = this.sentimentHistory.get(userId) || [];
    
    if (history.length < 3) {
      return { trend: 'insufficient_data', decliningExperience: false };
    }
    
    // Last 5 sentiments
    const recent = history.slice(-5);
    const negativeSentiments = recent.filter(s => 
      s.type === 'frustrated' || s.type === 'confused'
    ).length;
    
    return {
      trend: negativeSentiments > 3 ? 'declining' : 'stable',
      decliningExperience: negativeSentiments > 3,
      negativeStreak: negativeSentiments
    };
  }
  
  /**
   * Record sentiment
   */
  _recordSentiment(userId, sentiment) {
    if (!this.sentimentHistory.has(userId)) {
      this.sentimentHistory.set(userId, []);
    }
    
    this.sentimentHistory.get(userId).push({
      ...sentiment,
      timestamp: Date.now()
    });
    
    // Keep only last 50 sentiments
    const history = this.sentimentHistory.get(userId);
    if (history.length > 50) {
      history.shift();
    }
  }
  
  reset() {
    // Keep sentiment history (persistent across sessions)
    console.log('[Emotional] State reset (history preserved)');
  }
}
```

## Use Cases

### 1. Frustrated User
```js
// User: "This still doesn't work!!!"
const analysis = await emotional.analyze({
  userMessage: "This still doesn't work!!!",
  userId: 'user123'
});

// Result:
// {
//   sentiment: 'frustrated',
//   confidence: 0.9,
//   adaptation: {
//     tone: 'empathetic',
//     prefix: "I understand this is frustrating. Let me help clarify:",
//     actions: ['Simplify explanation', 'Offer alternative approach'],
//     escalate: false
//   }
// }
```

### 2. Satisfied User
```js
// User: "Thanks, that's perfect!"
// Result:
// {
//   sentiment: 'satisfied',
//   tone: 'encouraging',
//   prefix: "Great! ",
//   actions: ['Keep response brief', 'Suggest next steps']
// }
```

### 3. Declining Experience Detection
```js
// User has been frustrated 4 times in a row
// Result:
// {
//   sentiment: 'frustrated',
//   trend: { decliningExperience: true, negativeStreak: 4 },
//   adaptation: {
//     escalate: true,
//     prefix: "I apologize for the continued issues. ...",
//     actions: ['Offer human support immediately']
//   }
// }
```

## Integration Points

- **Agent Handlers:** Analyzes every user message
- **Response Generator:** Applies tone adaptations
- **UI:** Shows support escalation options
- **Analytics:** Tracks user satisfaction metrics

## Events

```js
// Emitted events:
'agent_emotional:started' - Analysis started
'agent_emotional:completed' - Sentiment detected
'agent_emotional:escalation_needed' - User needs human support
```

## Implementation Priority

**Phase 1 (v2.x Late - Q2 2027):**
- Keyword-based sentiment detection
- Basic tone adaptation
- Simple escalation rules

**Phase 2 (v3.x - Q3 2027):**
- ML-based sentiment analysis
- Multilingual support
- Advanced de-escalation strategies

## Benefits

- 😊 **UX:** More human-like interactions
- 🚀 **Retention:** Users feel heard
- 📊 **Insights:** Early warning for UX issues
- 🎯 **Efficiency:** Adapts communication to user state

## Notes

- Sentiment detection should be lightweight (no heavy ML initially)
- Respect user privacy (sentiment data anonymized)
- Don't over-apologize (can feel insincere)
- Consider cultural differences in emotional expression
