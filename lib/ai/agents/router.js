/**
 * Router Agent
 * ============
 * Purpose: Intent classification and agent pipeline selection.
 *
 * Responsibilities:
 * - Classify user intent from incoming messages using LLM-based classification
 * - Determine appropriate agent pipeline (fast-path for simple queries, full pipeline for complex tasks)
 * - Route to Planner, Explanation Engine, or direct Executor based on complexity
 * - Handle multi-intent requests and prioritization
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
 * - provider: LLM provider
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
 * Implementation Notes:
 * - Stateless: no side effects, pure function
 * - LLM-based classification for accurate intent detection
 * - Output must be JSON-serializable for persistence and replay
 * - Provider-Agnostic: works with any LLM provider (OpenAI, Anthropic, vLLM, etc)
 */
import { getPrompt } from '../prompts/index.js';
import { ROUTER_CONFIG } from '../config/index.js';

export class Router {
    constructor(config = {}) {
        this.config = {
            ...ROUTER_CONFIG,
            ...config // Allow override
        };
    }

    /**
     * Main router invocation - acts as full orchestrator
     *
     * @param {object} params
     * @param {array} params.messages - Chat messages
     * @param {object} params.context - Domain context
     * @param {object} params.provider - LLM provider
     * @returns {promise<object>} Final result with assistant message
     */
    async invoke({ messages, context = {}, provider }) {
        const startTime = Date.now();

        try {
            // Validate provider
            if (!provider) {
                throw new Error('Provider is required for Router agent');
            }

            // Extract user message
            const userMessage = this._extractUserMessage(messages);
            if (!userMessage) {
                return {
                    intent: 'SIMPLE_EXPLAIN',
                    pipeline: 'FAST_PATH',
                    assistantMessage: 'Keine Nachricht gefunden.',
                    reasoning: 'No message found',
                    duration_ms: Date.now() - startTime
                };
            }

            // Step 1: Classify intent with LLM
            console.log('[Router] Classifying intent for:', userMessage.substring(0, 100));
            const classificationResult = await this._classifyWithLLM(userMessage, context, provider);
            console.log('[Router] Classification result:', classificationResult);

            // Step 2: Select pipeline based on intent
            const pipeline = this._selectPipeline(classificationResult.intent, context);
            const intent = classificationResult.intent;

            console.log(`[Router] Final: intent=${intent}, pipeline=${pipeline}, confidence=${classificationResult.confidence}`);

            // Step 3: Execute based on pipeline selection
            if (intent === 'SIMPLE_EXPLAIN' || pipeline === 'FAST_PATH') {
                // Fast path: Simple LLM response without tools
                console.log('[Router] Executing FAST_PATH: Direct LLM response');
                return await this._executeFastPath(userMessage, provider, intent, pipeline, startTime);
            } else {
                // Full pipeline: Planner → Executor → Critic with tools
                console.log('[Router] Executing FULL_PIPELINE: Planner → Executor → Critic');
                return await this._executeFullPipeline(messages, userMessage, context, provider, intent, pipeline, startTime);
            }
        } catch (error) {
            console.error('[Router] Error:', error);
            return {
                intent: 'SIMPLE_EXPLAIN',
                pipeline: 'FAST_PATH',
                assistantMessage: `Router error: ${error.message}`,
                reasoning: `Error occurred: ${error.message}`,
                duration_ms: Date.now() - startTime
            };
        }
    }

    /**
     * Execute FAST_PATH: Simple LLM response
     * @private
     */
    async _executeFastPath(userMessage, provider, intent, pipeline, startTime) {
        try {
            console.log('[Router._executeFastPath] Generating direct LLM response');
            
            const systemPrompt = getPrompt('router');
            const llmMessages = [
                { role: 'user', content: userMessage }
            ];

            let fullResponse = '';
            for await (const chunk of provider.streamComplete({
                messages: llmMessages,
                systemPrompt,
                options: {
                    temperature: 0.7,
                    max_tokens: 200,
                }
            })) {
                if (chunk.type === 'content_delta' && chunk.content) {
                    fullResponse += chunk.content;
                }
            }

            return {
                intent,
                pipeline,
                assistantMessage: fullResponse,
                reasoning: 'Direct LLM response (FAST_PATH)',
                duration_ms: Date.now() - startTime
            };
        } catch (error) {
            console.error('[Router._executeFastPath] Error:', error);
            throw error;
        }
    }

    /**
     * Execute FULL_PIPELINE: Planner → Executor → Critic with tools
     * @private
     */
    async _executeFullPipeline(messages, userMessage, context, provider, intent, pipeline, startTime) {
        try {
            console.log('[Router._executeFullPipeline] Starting orchestration');

            // Dynamic import to avoid circular dependencies
            const { loadAgent } = await import('./index.js');
            const { registry } = await import('../tools/registry.js');

            // Step 1: Load and invoke Planner
            console.log('[Router._executeFullPipeline] Step 1: Planner');
            const planner = loadAgent('planner');
            const planResult = await planner.invoke({
                goal: userMessage,
                context,
                provider
            });
            console.log('[Router._executeFullPipeline] Plan created:', planResult.subtasks?.length || 0, 'subtasks');

            // Step 2: Load and invoke Executor with tools
            console.log('[Router._executeFullPipeline] Step 2: Executor');
            const availableTools = registry.listTools();
            const toolNames = availableTools.map(t => t.name);
            console.log('[Router._executeFullPipeline] Available tools:', toolNames.length, '-', JSON.stringify(toolNames));

            const executor = loadAgent('executor');
            const executionResult = await executor.invoke({
                messages,
                context,
                provider,
                toolNames
            });
            console.log('[Router._executeFullPipeline] Execution result:', {
                success: executionResult.success,
                toolCalls: executionResult.toolCalls?.length || 0,
                toolResults: executionResult.toolResults?.length || 0
            });

            // Step 3: Load and invoke Critic for validation
            console.log('[Router._executeFullPipeline] Step 3: Critic');
            const critic = loadAgent('critic');
            const validation = await critic.invoke({
                output: {
                    assistantMessage: executionResult.assistantMessage || '',
                    toolCalls: executionResult.toolCalls || [],
                    toolResults: executionResult.toolResults || []
                },
                context
            });
            console.log('[Router._executeFullPipeline] Validation result:', validation.recommendation);

            // Step 4: Return synthesized result
            const assistantMessage = executionResult.assistantMessage || 
                (executionResult.toolResults?.length > 0
                    ? `Die folgenden Tools wurden ausgeführt:\n\n${
                        executionResult.toolResults
                            .map(tr => `**${tr.tool}**: ${JSON.stringify(tr.result, null, 2)}`)
                            .join('\n\n')
                      }`
                    : 'Keine Antwort erhalten.');

            return {
                intent,
                pipeline,
                assistantMessage,
                taskTree: planResult,
                toolCalls: executionResult.toolCalls || [],
                toolResults: executionResult.toolResults || [],
                validationScore: typeof validation.score === 'number' ? validation.score : 0,
                reasoning: `Full pipeline executed: ${executionResult.toolCalls?.length || 0} tools called`,
                duration_ms: Date.now() - startTime
            };
        } catch (error) {
            console.error('[Router._executeFullPipeline] Error:', error);
            throw error;
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
     * Classify intent using LLM-based classification with retry logic
     * @private
     */
    async _classifyWithLLM(userMessage, context, provider) {
        if (!provider) {
            throw new Error('Provider required for LLM classification');
        }

        const classificationPrompt = this._buildClassificationPrompt(userMessage, context);
        const systemPrompt = getPrompt('router');
        let lastError = null;

        // Retry logic with backoff strategy
        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                const response = await Promise.race([
                    provider.complete({
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: classificationPrompt }
                        ],
                        options: {
                            temperature: this.config.temperature,
                            maxTokens: this.config.maxTokens,
                            topP: this.config.topP
                        }
                    }),
                    this._createTimeout(this.config.timeoutMs)
                ]);

                // Parse LLM response
                const result = this._parseLLMResponse(response.content);
                return { ...result, reasoning: `LLM classification (attempt ${attempt + 1})` };
            } catch (error) {
                lastError = error;
                console.warn(`[Router] Attempt ${attempt + 1} failed: ${error.message}`);
                
                if (attempt === this.config.maxRetries) {
                    return { intent: 'SIMPLE_EXPLAIN', confidence: 0.5, reasoning: `Failed: ${lastError.message}` };
                }

                const delay = this._calculateBackoff(attempt, this.config.retryBackoff);
                await this._sleep(delay);
            }
        }
    }

    /**
     * Calculate backoff delay
     * @private
     */
    _calculateBackoff(attempt, strategy) {
        const base = 500;
        return strategy === 'exponential' ? base * Math.pow(2, attempt) : base * (attempt + 1);
    }

    /**
     * Sleep helper
     * @private
     */
    _sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    /**
     * Timeout helper
     * @private
     */
    _createTimeout(ms) {
        return new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms));
    }

    /**
     * Build classification prompt for LLM
     * @private
     */
    _buildClassificationPrompt(userMessage, context) {
        const contextInfo = context.analysis
            ? `\n\nContext: User has EDIFACT analysis data available (${context.analysis.totalSegments || 0} segments, ${context.analysis.errors?.length || 0} errors).`
            : '';

        return `Classify the following user message into ONE of these intents:

**Intent Types:**
- **SIMPLE_EXPLAIN**: Simple factual questions about EDIFACT concepts or definitions (e.g., "What is UNH?", "Explain BGM segment")
- **ANALYSIS**: Requests to analyze data, find errors, examine files, or investigate issues (e.g., "Find all errors", "Analyze this invoice", "Check for validation issues")
- **DEBUG**: Debug why something is wrong or invalid (e.g., "Why is this segment invalid?", "What's wrong with my file?")
- **PLANNING**: Plan how to solve/fix problems or implement solutions (e.g., "How do I fix these errors?", "What steps should I take?")
- **CODING**: Generate code, scripts, or validation logic (e.g., "Write Python code to validate", "Create a parser function")
- **COMPLIANCE**: Check compliance with standards or validate against specifications (e.g., "Is this D96A compliant?", "Validate against INVOIC standard")

**Examples:**
- "What is the UNH segment?" → SIMPLE_EXPLAIN (confidence: 0.95)
- "Find all validation errors in this file" → ANALYSIS (confidence: 0.95)
- "Why is this NAD segment marked as invalid?" → DEBUG (confidence: 0.90)
- "How can I fix these D96A compliance issues?" → PLANNING (confidence: 0.90)
- "Write Python code to validate EDIFACT invoices" → CODING (confidence: 0.95)
- "Is this message D98A compliant?" → COMPLIANCE (confidence: 0.95)
- "Analysiere diese Rechnung und zeige alle Fehler" → ANALYSIS (confidence: 0.90)
- "Wie ist das Wetter heute?" → ANALYSIS (confidence: 0.70, requires external data lookup)
${contextInfo}

**User Message:** "${userMessage}"

**Response Format (JSON only):**
{
  "intent": "<INTENT_TYPE>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}`;
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
        console.log(`[Router._selectPipeline] Intent: ${intent}, Has analysis context: ${!!context.analysis && Object.keys(context.analysis).length > 0}`);
        
        // Simple intents → fast path (no tools needed)
        if (intent === 'SIMPLE_EXPLAIN') {
            console.log('[Router._selectPipeline] → FAST_PATH (SIMPLE_EXPLAIN)');
            return 'FAST_PATH';
        }

        // Complex intents ALWAYS need full pipeline with tools
        // ANALYSIS: Needs tools to analyze data
        // DEBUG: Needs tools to debug issues
        // PLANNING: Needs tools to plan actions
        // COMPLIANCE: Needs tools to check compliance
        // CODING: Needs tools to generate code
        if (['ANALYSIS', 'DEBUG', 'PLANNING', 'COMPLIANCE', 'CODING'].includes(intent)) {
            console.log(`[Router._selectPipeline] → FULL_PIPELINE (${intent} requires tools)`);
            return 'FULL_PIPELINE';
        }

        // Default
        console.log('[Router._selectPipeline] → FAST_PATH (default)');
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
