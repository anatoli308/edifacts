/**
 * Router Agent
 * ============
 * Purpose: Intent classification and agent pipeline selection.
 *
 * Responsibilities:
 * - Classify user intent from incoming messages using LLM-based classification
 * - Determine appropriate agent pipeline (full pipeline only)
 * - Route to Planner → Executor → Critic
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
 * - FULL_PIPELINE: Router → Planner → Executor → Critic (single pipeline)
 *
 * Inputs:
 * - messages: User message + chat history
 * - context: agent context (EDIFACT data, history, sessionId, userId, socket, etc)
 * - provider: LLM provider
 *
 * Outputs:
 * {
 *   intent: 'ANALYSIS' | 'DEBUG' | 'PLANNING' | 'CODING' | 'COMPLIANCE' | 'SIMPLE_EXPLAIN',
 *   pipeline: 'FULL_PIPELINE',
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
     * @param {array} params.messages - Chat messages max last 5 + current
     * @param {object} params.context - agent context (EDIFACT data, history, sessionId, userId, socket, etc)
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
            // Debug: Log incoming messages
            console.log(`[Router.invoke] Received ${messages?.length || 0} messages`);

            // Extract user message
            const userMessage = this._extractUserMessage(messages);
            if (!userMessage) {
                console.log('[Router.invoke] No user message found in messages array');
                /*const socket = context?.socket;
                if (socket && typeof socket.emit === 'function') {
                    socket.emit('agent:failed', {
                        error: 'No user message found',
                        details: 'Messages array is empty or contains no user messages',
                        timestamp: Date.now()
                    });
                }*/
                throw new Error('No user message found in messages array');
            }

            // Step 1: Classify intent with LLM
            console.log('[Router] Classifying intent for:', userMessage.substring(0, 10));
            const classificationResult = await this._classifyWithLLM(userMessage, context, provider);
            console.log('[Router] Classification result:', classificationResult);

            // Step 2: Select pipeline based on intent
            const pipeline = this._selectPipeline(classificationResult.intent, context);
            const intent = classificationResult.intent;

            console.log(`[Router] Final: intent=${intent}, pipeline=${pipeline}, confidence=${classificationResult.confidence}`);

            // Step 3: Execute FULL_PIPELINE only
            console.log('[Router] Executing FULL_PIPELINE: Planner → Executor → Critic');
            return await this._executeFullPipeline(messages, userMessage, context, provider, intent, pipeline, startTime);
        } catch (error) {
            console.error('[Router] Error:', error);
            /*const socket = context?.socket;
            if (socket && typeof socket.emit === 'function') {
                socket.emit('agent:failed', {
                    error: error.message,
                    stack: error.stack,
                    timestamp: Date.now(),
                    duration_ms: Date.now() - startTime
                });
            }*/
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
            console.log(`[Router._executeFullPipeline] Messages for agents: ${messages?.length || 0}`);

            // Stream pipeline selection to client
            const socket = context?.socket;
            if (socket && typeof socket.emit === 'function') {
                socket.emit('agent:step', {
                    step: 'pipeline_selected',
                    pipeline: 'FULL_PIPELINE',
                    intent: intent,
                    timestamp: Date.now()
                });
            }

            // Dynamic import to avoid circular dependencies
            const { loadAgent } = await import('./index.js');

            // Step 1: Load and invoke Planner
            console.log('[Router._executeFullPipeline] Step 1: Planner');
            if (socket && typeof socket.emit === 'function') {
                socket.emit('agent:step', {
                    step: 'planner_started',
                    message: 'Erstelle Aufgabenplan...',
                    timestamp: Date.now()
                });
            }
            
            const planner = loadAgent('planner');
            const planResult = await planner.invoke({
                goal: userMessage,
                messages, // Pass conversation history for better planning context
                context,
                provider
            });
            console.log('[Router._executeFullPipeline] Plan created:', planResult.subtasks?.length || 0, 'subtasks');

            // Step 1.5: Load Scheduler for task orchestration
            const { Scheduler } = await import('../orchestration/index.js');
            const scheduler = new Scheduler({
                maxParallel: 2, // Run max 2 tasks in parallel
                timeoutPerTaskMs: 60000, // 60s per task
                enableMetrics: true
            });
            
            if (socket && typeof socket.emit === 'function') {
                socket.emit('agent:step', {
                    step: 'scheduler_started',
                    message: 'Orchestriere Tasks...',
                    timestamp: Date.now()
                });
            }

            // Step 2: Execute tasks via Scheduler (orchestrates Executor calls)
            console.log('[Router._executeFullPipeline] Step 2: Scheduler orchestrates task execution');
            
            const executor = loadAgent('executor');
            const critic = loadAgent('critic');
            
            const schedulerResult = await scheduler.execute({
                taskTree: planResult,
                agents: {
                    executor,
                    critic,
                    planner // For potential replanning
                },
                context: {
                    ...context,
                    socket, // Pass socket for progress streaming
                    provider
                },
                messages
            });
            
            console.log('[Router._executeFullPipeline] Scheduler execution result:', {
                goalCompleted: schedulerResult.goalCompleted,
                tasksCompleted: schedulerResult.metrics.tasksCompleted,
                tasksRun: schedulerResult.metrics.tasksRun,
                tasksFailed: schedulerResult.metrics.tasksFailed
            });
            
            // Aggregate tool calls and results from all tasks
            const allToolCalls = [];
            const allToolResults = [];
            let finalAssistantMessage = '';
            
            // Get all task IDs in order
            const taskIds = Object.keys(schedulerResult.subtaskResults);
            
            // Collect ALL tool calls and results from all tasks
            for (const [taskId, taskResult] of Object.entries(schedulerResult.subtaskResults)) {
                if (taskResult.toolCalls) {
                    allToolCalls.push(...taskResult.toolCalls);
                }
                if (taskResult.toolResults) {
                    allToolResults.push(...taskResult.toolResults);
                }
            }
            
            // BUT: Only use the LAST task's assistant message as final answer
            // The last task should be the "format answer" or "generate response" task
            if (taskIds.length > 0) {
                const lastTaskId = taskIds[taskIds.length - 1];
                const lastTaskResult = schedulerResult.subtaskResults[lastTaskId];
                if (lastTaskResult && lastTaskResult.assistantMessage) {
                    finalAssistantMessage = lastTaskResult.assistantMessage;
                }
            }
            
            const executionResult = {
                success: schedulerResult.goalCompleted,
                toolCalls: allToolCalls,
                toolResults: allToolResults,
                assistantMessage: finalAssistantMessage.trim(),
                metrics: schedulerResult.metrics
            };
            
            console.log('[Router._executeFullPipeline] Aggregated execution result:', {
                success: executionResult.success,
                toolCalls: executionResult.toolCalls?.length || 0,
                toolResults: executionResult.toolResults?.length || 0
            });
            
            console.log('[Router._executeFullPipeline] Streaming complete.');

            return {
                intent,
                pipeline,
                assistantMessage: finalAssistantMessage || 'Keine Antwort generiert.',
                taskTree: planResult,
                toolCalls: executionResult.toolCalls || [],
                toolResults: executionResult.toolResults || [],
                schedulerMetrics: schedulerResult.metrics,
                executionTrace: schedulerResult.executionTrace,
                reasoning: `Full pipeline with Scheduler: ${schedulerResult.metrics.tasksCompleted}/${schedulerResult.metrics.tasksRun} tasks completed`,
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
        
        // Single pipeline only
        console.log('[Router._selectPipeline] → FULL_PIPELINE (single pipeline)');
        return 'FULL_PIPELINE';
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
