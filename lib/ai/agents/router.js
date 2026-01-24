/**
 * Router Agent
 * ============
 * Purpose: Intent classification and agent pipeline selection.
 *
 * Responsibilities:
 * - Classify user intent from incoming messages (analysis, debugging, planning, coding, compliance).
 * - Determine appropriate agent pipeline (fast-path for simple queries, full pipeline for complex tasks).
 * - Route to Planner, Explanation Engine, or direct Executor based on complexity.
 * - Handle multi-intent requests and prioritization.
 *
 * Intent Types:
 * - SIMPLE_EXPLAIN: Factual questions about EDIFACT (e.g., "What is UNH?")
 * - ANALYSIS: Analyze data/errors (e.g., "Find all errors in this file")
 * - DEBUG: Debug issues (e.g., "Why is this invalid?")
 * - PLANNING: Plan actions (e.g., "How do I fix this?")
 * - CODING: Generate code (e.g., "Write validation code")
 * - COMPLIANCE: Check compliance (e.g., "Is this D96A compliant?")
 *
 * Pipeline Selection:
 * - FAST_PATH: Simple queries → Explanation Engine only (< 1s)
 * - FULL_PIPELINE: Complex tasks → Router → Planner → Executor → Critic (slower, more thorough)
 *
 * Inputs:
 * - messages: User message + chat history
 * - context: Domain context (EDIFACT analysis, file, etc)
 * - provider: LLM provider (for few-shot fallback)
 *
 * Outputs:
 * {
 *   intent: 'ANALYSIS' | 'DEBUG' | 'PLANNING' | 'CODING' | 'COMPLIANCE' | 'SIMPLE_EXPLAIN',
 *   pipeline: 'FAST_PATH' | 'FULL_PIPELINE',
 *   confidence: 0-1,
 *   reasoning: string,
 *   suggestedTools: string[] (optional, for Executor)
 * }
 *
 * Implementation Strategy:
 * 1. Fast heuristic-based classification (pattern matching, keywords)
 * 2. If confidence < threshold, use few-shot LLM prompting
 * 3. Pipeline selection based on intent complexity + context
 * 4. Always < 1 second for UX responsiveness
 *
 * Implementation Notes:
 * - Stateless: no side effects, pure function.
 * - Fast: heuristics first, LLM fallback only if needed.
 * - Output must be JSON-serializable for persistence and replay.
 * - Provider-Agnostic: works with any LLM provider (OpenAI, Anthropic, vLLM, etc)
 */

export class Router {
    constructor(config = {}) {
        this.config = {
            heuristicConfidenceThreshold: 0.7,
            useHeuristicsOnly: true, // Set false to enable LLM fallback
            ...config
        };

        // Intent detection patterns (heuristics)
        this.patterns = this._initializePatterns();
    }

    /**
     * Initialize intent detection patterns
     * @private
     */
    _initializePatterns() {
        return {
            SIMPLE_EXPLAIN: {
                keywords: ['what', 'what\'s', 'what is', 'define', 'explain', 'meaning', 'is this', 'meaning of'],
                patterns: [
                    /^what\s+(is|are|\'s).*\?$/i,
                    /^explain\s+/i,
                    /^(what|can you explain|define)\s+/i,
                    /^is\s+(this\s+)?(a|an|the)\s+/i,
                    /^meaning\s+of\s+/i
                ],
                minWords: 2,
                maxWords: 15
            },

            ANALYSIS: {
                keywords: ['analyze', 'analysis', 'find', 'identify', 'check', 'examine', 'scan', 'list', 'show all'],
                patterns: [
                    /^(analyze|analysis|examine)\s+/i,
                    /^find\s+(all\s+)?(errors|issues|problems|violations)/i,
                    /^identify\s+/i,
                    /^check\s+(for\s+)?(errors|issues|violations)/i,
                    /^(list|show|display)\s+/i,
                    /^scan\s+/i
                ],
                minWords: 2,
                maxWords: 50,
                context: ['errors', 'issues', 'violations', 'problems']
            },

            DEBUG: {
                keywords: ['why', 'error', 'invalid', 'broken', 'wrong', 'fail', 'issue', 'problem'],
                patterns: [
                    /^why\s+/i,
                    /^why\s+(is|are|can\'t|isn\'t)/i,
                    /^what.*error\s+/i,
                    /^(error|invalid|broken|wrong)\s+/i,
                    /^(this|it)\s+(is\s+)?(invalid|broken|wrong|failing)/i
                ],
                minWords: 2,
                maxWords: 50,
                context: ['error', 'invalid', 'fail', 'wrong', 'broken']
            },

            PLANNING: {
                keywords: ['how', 'plan', 'steps', 'approach', 'solve', 'fix', 'implement', 'should i'],
                patterns: [
                    /^how\s+(do|can|should)\s+/i,
                    /^how\s+(to\s+)?(fix|solve|implement|resolve)/i,
                    /^plan\s+/i,
                    /^what\s+(are\s+)?the\s+(steps|approach)/i,
                    /^(fix|solve|implement)\s+/i
                ],
                minWords: 2,
                maxWords: 50,
                context: ['fix', 'solve', 'plan', 'implement', 'approach']
            },

            CODING: {
                keywords: ['code', 'write', 'script', 'function', 'implement', 'program', 'generate'],
                patterns: [
                    /^(write|generate|create)\s+(code|script|function)/i,
                    /^code\s+/i,
                    /^implement\s+/i,
                    /^(write|create)\s+(a\s+)?(validator|parser|function)/i,
                    /^(in python|in javascript|in java)\s+/i
                ],
                minWords: 2,
                maxWords: 50,
                context: ['code', 'function', 'script', 'python', 'javascript']
            },

            COMPLIANCE: {
                keywords: ['compliant', 'compliance', 'valid', 'standard', 'd96a', 'd98a', 'edifact', 'conform'],
                patterns: [
                    /^(is|are)\s+.*\s+(compliant|valid|conform)/i,
                    /^(check\s+)?(compliance|conformance)\s+/i,
                    /^does\s+.*\s+conform\s+/i,
                    /^validate\s+/i,
                    /^(d96a|d98a|edifact)\s+/i
                ],
                minWords: 2,
                maxWords: 50,
                context: ['compliant', 'valid', 'conform', 'standard', 'edifact']
            }
        };
    }

    /**
     * Main router invocation
     *
     * @param {object} params
     * @param {array} params.messages - Chat messages
     * @param {object} params.context - Domain context
     * @param {object} params.provider - LLM provider (for LLM fallback)
     * @returns {promise<object>} Router result
     */
    async invoke({ messages, context = {}, provider }) {
        const startTime = Date.now();

        try {
            // Extract user message
            const userMessage = this._extractUserMessage(messages);
            if (!userMessage) {
                return this._defaultResult(
                    'SIMPLE_EXPLAIN',
                    'FAST_PATH',
                    'No message found',
                    0.0,
                    startTime
                );
            }

            // Step 1: Try heuristic classification (fast)
            const heuristicResult = this._classifyWithHeuristics(userMessage, context);
            console.log('[Router] Heuristic result:', heuristicResult);

            // Step 2: If confidence low and LLM available, use few-shot prompting
            if (
                heuristicResult.confidence < this.config.heuristicConfidenceThreshold &&
                provider &&
                !this.config.useHeuristicsOnly
            ) {
                const llmResult = await this._classifyWithLLM(
                    userMessage,
                    context,
                    provider
                );
                if (llmResult.confidence > heuristicResult.confidence) {
                    return this._finalizeResult(llmResult, startTime);
                }
            }

            // Step 3: Select pipeline based on intent
            const pipeline = this._selectPipeline(heuristicResult.intent, context);
            heuristicResult.pipeline = pipeline;

            return this._finalizeResult(heuristicResult, startTime);
        } catch (error) {
            console.error('[Router] Error:', error);
            return this._defaultResult(
                'SIMPLE_EXPLAIN',
                'FAST_PATH',
                `Router error: ${error.message}`,
                0.0,
                startTime
            );
        }
    }

    /**
     * Extract user message from messages array
     * @private
     */
    _extractUserMessage(messages) {
        if (!messages || !Array.isArray(messages)) return null;

        // Find the last user message
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                return messages[i].content || '';
            }
        }

        return null;
    }

    /**
     * Classify intent using heuristics (fast)
     * @private
     */
    _classifyWithHeuristics(userMessage, context) {
        const messageLower = userMessage.toLowerCase().trim();
        const words = messageLower.split(/\s+/);
        const wordCount = words.length;

        // Store matches for all intents
        const matches = {};

        for (const [intent, config] of Object.entries(this.patterns)) {
            let score = 0;

            // Check word count bounds
            if (config.minWords && wordCount < config.minWords) continue;
            if (config.maxWords && wordCount > config.maxWords) continue;

            // Check keywords
            if (config.keywords) {
                const keywordMatches = config.keywords.filter(kw =>
                    messageLower.includes(kw.toLowerCase())
                ).length;
                score += keywordMatches * 0.3;
            }

            // Check patterns
            if (config.patterns) {
                const patternMatches = config.patterns.filter(p =>
                    p.test(messageLower)
                ).length;
                score += patternMatches * 0.4;
            }

            // Check context keywords
            if (config.context && context.analysis) {
                const contextStr = JSON.stringify(context.analysis).toLowerCase();
                const contextMatches = config.context.filter(c =>
                    contextStr.includes(c)
                ).length;
                score += contextMatches * 0.2;
            }

            matches[intent] = score;
        }

        // Find highest scoring intent
        const [intent, score] = Object.entries(matches).reduce((prev, curr) =>
            curr[1] > prev[1] ? curr : prev,
            ['SIMPLE_EXPLAIN', 0]
        );

        // Normalize confidence to 0-1
        const confidence = Math.min(1, score / 2); // Max possible score is 2

        return {
            intent,
            confidence,
            reasoning: `Heuristic classification based on keywords and patterns (score: ${score.toFixed(2)})`
        };
    }

    /**
     * Classify intent using LLM (few-shot prompting)
     * @private
     */
    async _classifyWithLLM(userMessage, context, provider) {
        if (!provider) {
            throw new Error('Provider required for LLM classification');
        }

        const fewShotPrompt = this._buildFewShotPrompt(userMessage);

        try {
            const response = await provider.complete({
                messages: [
                    {
                        role: 'system',
                        content: 'You are an intent classifier. Classify user intents for EDIFACT data analysis.'
                    },
                    {
                        role: 'user',
                        content: fewShotPrompt
                    }
                ],
                options: {
                    temperature: 0.3, // Low temperature for consistency
                    maxTokens: 200
                }
            });

            // Parse LLM response
            const result = this._parseLLMResponse(response.content);
            return {
                ...result,
                reasoning: `LLM classification using few-shot prompting`
            };
        } catch (error) {
            console.error('[Router._classifyWithLLM] Error:', error);
            throw error;
        }
    }

    /**
     * Build few-shot prompt for intent classification
     * @private
     */
    _buildFewShotPrompt(userMessage) {
        return `Classify the following user message into one of these intents:
- SIMPLE_EXPLAIN: Factual question about EDIFACT (e.g., "What is UNH?")
- ANALYSIS: Analyze data or find errors (e.g., "Find all errors")
- DEBUG: Debug why something is wrong (e.g., "Why is this invalid?")
- PLANNING: Plan how to solve/fix something (e.g., "How do I fix this?")
- CODING: Request code generation (e.g., "Write validation code")
- COMPLIANCE: Check compliance/standards (e.g., "Is this D96A compliant?")

Examples:
- "What is UNH?" → SIMPLE_EXPLAIN (confidence: 0.95)
- "Find all errors in this file" → ANALYSIS (confidence: 0.95)
- "Why is segment invalid?" → DEBUG (confidence: 0.90)
- "How can I fix this issue?" → PLANNING (confidence: 0.90)
- "Write Python code to validate" → CODING (confidence: 0.95)
- "Is this D96A compliant?" → COMPLIANCE (confidence: 0.95)

User message: "${userMessage}"

Respond with JSON: { "intent": "...", "confidence": 0.X }`;
    }

    /**
     * Parse LLM response to extract intent and confidence
     * @private
     */
    _parseLLMResponse(content) {
        try {
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return {
                    intent: 'SIMPLE_EXPLAIN',
                    confidence: 0.5,
                    reasoning: 'Could not parse LLM response'
                };
            }

            const parsed = JSON.parse(jsonMatch[0]);
            return {
                intent: parsed.intent || 'SIMPLE_EXPLAIN',
                confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5))
            };
        } catch (error) {
            console.error('[Router._parseLLMResponse] Error:', error);
            return {
                intent: 'SIMPLE_EXPLAIN',
                confidence: 0.5,
                reasoning: 'LLM parsing error'
            };
        }
    }

    /**
     * Select pipeline based on intent and context
     * @private
     */
    _selectPipeline(intent, context) {
        // Simple intents → fast path
        if (intent === 'SIMPLE_EXPLAIN') {
            return 'FAST_PATH';
        }

        // Complex intents → full pipeline
        if (['ANALYSIS', 'DEBUG', 'PLANNING', 'COMPLIANCE'].includes(intent)) {
            // But if no analysis context, still use fast path
            if (!context.analysis || Object.keys(context.analysis).length === 0) {
                return 'FAST_PATH';
            }
            return 'FULL_PIPELINE';
        }

        // Coding → full pipeline (needs planning)
        if (intent === 'CODING') {
            return 'FULL_PIPELINE';
        }

        return 'FAST_PATH';
    }

    /**
     * Create default router result
     * @private
     */
    _defaultResult(intent, pipeline, reasoning, confidence, startTime) {
        return {
            intent,
            pipeline,
            confidence,
            reasoning,
            duration_ms: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Finalize router result with metadata
     * @private
     */
    _finalizeResult(result, startTime) {
        return {
            intent: result.intent,
            pipeline: result.pipeline,
            confidence: result.confidence,
            reasoning: result.reasoning,
            suggestedTools: result.suggestedTools || [],
            duration_ms: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };
    }
}
