# Explanation Agent (Pedagogical Reasoning)

**Status:** Planned (v2.x Mid)  
**Human Analog:** Teacher, Theory of Mind, Adaptive Communication  
**Priority:** ⭐⭐ (Medium - UX/Learning enhancement)

## Purpose

The Explanation Agent adapts explanations to user expertise level, generates visualizations, and creates analogies. It transforms complex EDIFACT concepts into understandable knowledge tailored to each user.

## Core Capabilities

### 1. Expertise Level Detection
- Analyzes user questions to estimate knowledge level
- Tracks user progress over time
- Adapts automatically (beginner → intermediate → expert)

### 2. Adaptive Explanations
- **Beginners:** Analogies, simple language, step-by-step
- **Intermediate:** Technical details, best practices
- **Expert:** Specs, edge cases, optimization tips

### 3. Visualization Generation
- Creates diagrams for message structures
- Generates segment dependency trees
- Visual comparison tables

### 4. Analogy Creation
- Translates technical concepts to everyday examples
- Domain-specific metaphors
- Cultural adaptation

## Architecture

```js
class ExplanationAgent extends EventEmitter {
  constructor() {
    super();
    this.userProfiles = new Map(); // userId → ExpertiseProfile
    this.analogies = this._loadAnalogies();
  }
  
  /**
   * Generate adaptive explanation
   */
  async explain({ concept, context, userId }) {
    this.emit('agent_explanation:started', { concept });
    
    // Get or detect user level
    const userLevel = this._getUserLevel(userId, context);
    
    // Generate explanation
    const explanation = await this._generateExplanation(concept, userLevel, context);
    
    // Add level-specific enhancements
    if (userLevel === 'beginner') {
      explanation.analogy = this._createAnalogy(concept);
      explanation.visualization = await this._generateVisualization(concept);
      explanation.nextSteps = this._suggestNextSteps(concept, 'beginner');
    } else if (userLevel === 'intermediate') {
      explanation.bestPractices = this._getBestPractices(concept);
      explanation.commonMistakes = this._getCommonMistakes(concept);
      explanation.relatedConcepts = this._getRelated(concept);
    } else if (userLevel === 'expert') {
      explanation.technicalDetails = this._getTechnicalSpecs(concept);
      explanation.edgeCases = this._getEdgeCases(concept);
      explanation.optimization = this._getOptimizationTips(concept);
      explanation.standards = this._getStandardReferences(concept);
    }
    
    // Update user profile
    this._updateUserProfile(userId, { concept, level: userLevel });
    
    this.emit('agent_explanation:completed', {
      concept,
      level: userLevel,
      hasVisualization: !!explanation.visualization
    });
    
    return explanation;
  }
  
  /**
   * Detect user expertise level
   */
  _getUserLevel(userId, context) {
    const profile = this.userProfiles.get(userId);
    
    if (profile) {
      return profile.level;
    }
    
    // Detect from context
    const indicators = {
      beginner: ['what is', 'how do i', 'explain', 'simple'],
      expert: ['optimization', 'edge case', 'spec', 'according to', 'compliance']
    };
    
    const message = context.userMessage?.toLowerCase() || '';
    
    if (indicators.expert.some(kw => message.includes(kw))) {
      return 'expert';
    }
    
    if (indicators.beginner.some(kw => message.includes(kw))) {
      return 'beginner';
    }
    
    return 'intermediate'; // Default
  }
  
  /**
   * Generate core explanation
   */
  async _generateExplanation(concept, level, context) {
    // Base explanation (could be from LLM or templates)
    const base = {
      concept,
      definition: this._getDefinition(concept),
      purpose: this._getPurpose(concept),
      example: this._getExample(concept, level)
    };
    
    return base;
  }
  
  /**
   * Create analogy for concept
   */
  _createAnalogy(concept) {
    const analogies = {
      'UNH': {
        analogy: 'Ein Briefumschlag',
        explanation: 'Wie ein Briefumschlag enthält UNH die "Adresse" (Message Reference) und den "Typ" (Message Type). Jede EDIFACT-Nachricht beginnt mit diesem "Umschlag".'
      },
      'UNT': {
        analogy: 'Die Unterschrift am Ende',
        explanation: 'UNT ist wie die Unterschrift am Ende eines Briefs - bestätigt, dass alles vollständig ist und zählt die Segmente.'
      },
      'BGM': {
        analogy: 'Der Betreff eines E-Mails',
        explanation: 'BGM ist der "Betreff" deiner Nachricht - er sagt, worum es geht (z.B. Rechnung, Bestellung) und gibt eine Referenznummer.'
      },
      'DTM': {
        analogy: 'Der Datumsstempel',
        explanation: 'DTM ist wie der Poststempel auf einem Brief - markiert wann etwas passiert ist (Rechnungsdatum, Lieferdatum, etc.).'
      },
      'NAD': {
        analogy: 'Adressbuch-Eintrag',
        explanation: 'NAD speichert Adressen wie ein Adressbuch - Rechnungsadresse, Lieferadresse, Käufer, Verkäufer.'
      },
      'LIN': {
        analogy: 'Eine Zeile in einer Tabelle',
        explanation: 'LIN ist wie eine Zeile in einer Excel-Tabelle mit Produktinformationen - jede LIN ist ein Artikel.'
      },
      'LOC': {
        analogy: 'GPS-Koordinate',
        explanation: 'LOC gibt an "wo" etwas ist oder hingeht - wie eine GPS-Koordinate für Lager, Ladeort, Entladeort.'
      }
    };
    
    return analogies[concept] || {
      analogy: 'Kein Analogie verfügbar',
      explanation: `${concept} ist ein technisches EDIFACT-Segment.`
    };
  }
  
  /**
   * Generate visualization
   */
  async _generateVisualization(concept) {
    // Generate Mermaid diagram or ASCII art
    const visualizations = {
      'INVOIC': `
INVOIC Structure:
┌─────────────┐
│ UNH (Header)│
├─────────────┤
│ BGM         │ ← Document type
│ DTM         │ ← Dates
│ NAD         │ ← Parties (Buyer, Seller)
├─────────────┤
│ LIN         │ ← Line items (repeat)
│   ├─ QTY    │   ← Quantity
│   └─ PRI    │   ← Price
├─────────────┤
│ UNS         │ ← Summary section
│ MOA         │ ← Totals
└─────────────┘
│ UNT (Trailer)│
└─────────────┘
      `,
      'UNH': `
UNH+MessageRef+MessageType:Version:Release:Agency'
    │       │           │        │      │      │
    │       │           │        │      │      └─ Controlling Agency
    │       │           │        │      └─ Release Number
    │       │           │        └─ Version Number
    │       │           └─ Message Type (e.g., INVOIC)
    │       └─ Message Reference Number (unique)
    └─ Segment Tag
      `
    };
    
    return visualizations[concept] || null;
  }
  
  /**
   * Get technical specifications
   */
  _getTechnicalSpecs(concept) {
    // Detailed technical info for experts
    return {
      standard: 'UN/EDIFACT',
      mandatory: true, // example
      position: '0010',
      maxOccurrences: 1,
      dataElements: [
        { code: '0062', name: 'Message Reference Number', format: 'an..14' },
        { code: '0065', name: 'Message Type', format: 'an..6' }
      ]
    };
  }
  
  /**
   * Load analogy database
   */
  _loadAnalogies() {
    // Could load from external file
    return new Map();
  }
  
  reset() {
    // Keep user profiles (persistent)
    console.log('[Explanation] State reset (profiles preserved)');
  }
}
```

## Use Cases

### 1. Beginner Explanation
```js
// User (beginner): "What is UNH?"
await explanation.explain({
  concept: 'UNH',
  userId: 'user123',
  context: { userMessage: 'What is UNH?' }
});

// Result:
// {
//   definition: "UNH is the message header segment",
//   analogy: {
//     analogy: "Ein Briefumschlag",
//     explanation: "Wie ein Briefumschlag enthält UNH die 'Adresse'..."
//   },
//   visualization: [ASCII diagram],
//   nextSteps: ["Learn about UNT", "Understand message structure"]
// }
```

### 2. Expert Explanation
```js
// User (expert): "UNH optimization for large messages?"
// Result:
// {
//   technicalDetails: { standard: "UN/EDIFACT", position: "0010" },
//   optimization: [
//     "Use compressed message references",
//     "Batch processing for multiple messages",
//     "Consider UNB envelope for grouping"
//   ],
//   edgeCases: ["Maximum reference number", "Character encoding issues"]
// }
```

## Integration Points

- **Executor:** Requests explanations during analysis
- **UI:** Renders visualizations and analogies
- **Memory Agent:** Tracks user expertise progression
- **Learning Agent:** Stores successful explanations

## Events

```js
// Emitted events:
'agent_explanation:started' - Explanation generation started
'agent_explanation:completed' - Explanation ready
'agent_explanation:level_detected' - User level determined
```

## Implementation Priority

**Phase 1 (v2.x Mid - Q1 2027):**
- Hardcoded analogies for common segments
- Basic level detection
- Simple ASCII visualizations

**Phase 2 (v2.x Late - Q2 2027):**
- LLM-generated analogies
- Advanced visualizations (Mermaid, diagrams)
- Adaptive learning (user level tracking)

## Benefits

- 🎓 **Learning:** Makes EDIFACT accessible to beginners
- ⚡ **Efficiency:** Experts get what they need (no fluff)
- 🎨 **Engagement:** Visual learners benefit from diagrams
- 🌍 **Accessibility:** Cultural adaptation of analogies

## Notes

- Analogies should be culturally sensitive
- Visualizations need responsive design (mobile/desktop)
- Consider adding audio explanations (accessibility)
- User profiles should respect GDPR (opt-in tracking)
