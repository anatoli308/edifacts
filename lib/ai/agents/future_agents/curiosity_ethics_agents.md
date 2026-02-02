# Curiosity & Ethics Agent Bundle

## Curiosity Agent (Proactive Exploration)

**Status:** Planned (v2.x Late)  
**Human Analog:** Curiosity, Exploration Drive  
**Priority:** ⭐ (Low - Enhancement, nice-to-have)

### Purpose
Proactively suggests related topics and unexplored areas to enhance user learning.

### Core Capabilities

1. **Related Topic Suggestions**
   - Suggests related EDIFACT concepts
   - "You might also be interested in..."
   
2. **Knowledge Gap Detection**
   - Identifies areas user hasn't explored
   - Personalized learning path recommendations

3. **Contextual Discovery**
   - Surfaces relevant but unexpected information
   - Cross-domain connections

### Architecture

```js
class CuriosityAgent extends EventEmitter {
  async suggestRelated({ currentTopic, userHistory }) {
    this.emit('agent_curiosity:started');
    
    const related = this._findRelatedTopics(currentTopic);
    const unexplored = related.filter(t => !userHistory.includes(t));
    
    this.emit('agent_curiosity:completed', { suggestions: unexplored });
    
    return unexplored.map(topic => ({
      topic: topic.name,
      relevance: topic.score,
      preview: topic.summary,
      reason: `Because you learned about ${currentTopic}`
    }));
  }
  
  _findRelatedTopics(topic) {
    const relations = {
      'INVOIC': ['DESADV', 'ORDERS', 'PRICAT', 'EANCOM Subset'],
      'UNH': ['UNT', 'UNB', 'UNZ', 'Message Structure'],
      'BGM': ['DTM', 'RFF', 'Document Types']
    };
    
    return relations[topic] || [];
  }
}
```

---

## Ethics/Safety Agent (Guardrails)

**Status:** Planned (v1.x Late)  
**Human Analog:** Conscience, Moral Reasoning  
**Priority:** ⭐⭐ (Medium-High - Enterprise requirement)

### Purpose
Ensures system operates within ethical boundaries, prevents harmful outputs, and enforces compliance.

### Core Capabilities

1. **PII Detection & Protection**
   - Scans for personal data (GDPR compliance)
   - Redacts sensitive information
   - Warns before processing personal data

2. **Rate Limiting & Abuse Prevention**
   - Prevents API abuse
   - Fair usage enforcement
   - DoS protection

3. **Content Moderation**
   - Blocks harmful instructions
   - Prevents malicious use
   - Maintains professional tone

4. **Compliance Validation**
   - GDPR compliance checks
   - Data retention policies
   - Audit trail generation

### Architecture

```js
class EthicsAgent extends EventEmitter {
  constructor() {
    super();
    this.piiPatterns = this._loadPIIPatterns();
    this.rateLimits = new Map(); // userId → RequestCount
  }
  
  /**
   * Validate action before execution
   */
  async validate({ action, data, user }) {
    this.emit('agent_ethics:started', { action });
    
    const checks = await Promise.all([
      this._checkPII(data),
      this._checkRateLimit(user),
      this._checkContent(data),
      this._checkCompliance(action, data, user)
    ]);
    
    const violations = checks.filter(c => !c.passed);
    
    if (violations.length > 0) {
      this.emit('agent_ethics:violation', { violations });
      return {
        allowed: false,
        violations,
        recommendation: this._getRemediation(violations)
      };
    }
    
    this.emit('agent_ethics:approved', { action });
    return { allowed: true };
  }
  
  /**
   * Check for PII
   */
  async _checkPII(data) {
    const piiDetected = [];
    
    // Email pattern
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(data)) {
      piiDetected.push({ type: 'email', severity: 'high' });
    }
    
    // Phone number pattern
    if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(data)) {
      piiDetected.push({ type: 'phone', severity: 'medium' });
    }
    
    // Credit card pattern
    if (/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/.test(data)) {
      piiDetected.push({ type: 'credit_card', severity: 'critical' });
    }
    
    if (piiDetected.length > 0) {
      return {
        passed: false,
        reason: 'PII_DETECTED',
        details: piiDetected,
        action: 'REDACT'
      };
    }
    
    return { passed: true };
  }
  
  /**
   * Check rate limit
   */
  async _checkRateLimit(user) {
    const limits = {
      free: { requests: 100, window: 3600000 }, // 100 per hour
      premium: { requests: 1000, window: 3600000 }
    };
    
    const userLimit = limits[user.tier] || limits.free;
    const key = `${user.id}:${Date.now() / userLimit.window}`;
    
    const current = this.rateLimits.get(key) || 0;
    
    if (current >= userLimit.requests) {
      return {
        passed: false,
        reason: 'RATE_LIMIT_EXCEEDED',
        retryAfter: userLimit.window - (Date.now() % userLimit.window)
      };
    }
    
    this.rateLimits.set(key, current + 1);
    return { passed: true };
  }
  
  /**
   * Check content safety
   */
  async _checkContent(data) {
    const banned = ['hack', 'exploit', 'bypass', 'injection'];
    const lowerData = data.toLowerCase();
    
    const violations = banned.filter(word => lowerData.includes(word));
    
    if (violations.length > 0) {
      return {
        passed: false,
        reason: 'UNSAFE_CONTENT',
        violations
      };
    }
    
    return { passed: true };
  }
  
  /**
   * Check GDPR compliance
   */
  async _checkCompliance(action, data, user) {
    // Check data retention policy
    if (action === 'store' && !user.consent?.dataStorage) {
      return {
        passed: false,
        reason: 'GDPR_VIOLATION',
        details: 'User has not consented to data storage'
      };
    }
    
    return { passed: true };
  }
  
  /**
   * Redact PII from text
   */
  redact(text) {
    let redacted = text;
    
    // Redact emails
    redacted = redacted.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL REDACTED]');
    
    // Redact phone numbers
    redacted = redacted.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE REDACTED]');
    
    // Redact credit cards
    redacted = redacted.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD REDACTED]');
    
    return redacted;
  }
  
  reset() {
    // Keep rate limits (persistent)
    console.log('[Ethics] State reset (limits preserved)');
  }
}
```

## Use Cases

### Ethics Agent

**1. PII Detection**
```js
// User uploads EDIFACT with embedded email
const validation = await ethics.validate({
  action: 'analyze',
  data: "NAD+BY+1234567890123::9++John Doe+Main Street+Berlin++12345+DE' Contact: john@example.com",
  user: { id: 'user123' }
});

// Result:
// {
//   allowed: false,
//   violations: [{ type: 'email', severity: 'high' }],
//   recommendation: 'Redact PII before processing'
// }
```

**2. Rate Limiting**
```js
// User exceeds free tier limit
// Result:
// {
//   allowed: false,
//   reason: 'RATE_LIMIT_EXCEEDED',
//   retryAfter: 1847000 // milliseconds
// }
```

### Curiosity Agent

**1. Topic Suggestions**
```js
// User learned about INVOIC
const suggestions = await curiosity.suggestRelated({
  currentTopic: 'INVOIC',
  userHistory: ['UNH', 'UNT', 'BGM']
});

// Result:
// [
//   { topic: 'DESADV', reason: 'Because you learned about INVOIC' },
//   { topic: 'ORDERS', reason: 'Related to INVOIC workflow' }
// ]
```

## Integration Points

- **Ethics:** Validate BEFORE every action
- **Curiosity:** Suggest AFTER successful explanation
- **UI:** Display suggestions, handle violations gracefully
- **Analytics:** Track violations, adjust limits

## Implementation Priority

**Ethics Agent (v1.x Late - Q2 2026):**
- PII detection & redaction
- Basic rate limiting
- GDPR compliance checks

**Curiosity Agent (v2.x Late - Q2 2027):**
- Hardcoded topic relations
- Simple suggestion engine

## Benefits

- 🛡️ **Ethics:** GDPR compliance, enterprise-ready
- 🔒 **Safety:** Prevents abuse, protects users
- 🎓 **Curiosity:** Enhances learning experience
- 📊 **Insights:** Identifies popular learning paths
