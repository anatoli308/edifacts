/**
 * Executor Agent (ReAct Loop)
 * ===========================
 * Status: ✅ Implemented (v1.x Early) + 🚧 Enhancements Planned (v1.x Late)
 * Human Analog: Motor Cortex (Execution, Action)
 * 
 * Purpose: Execute task plans using tools and manage Thought → Action → Observation cycles.
 *
 * Responsibilities:
 * - Receive a task from Coordinator/Planner.
 * - Reason about how to accomplish the task (Thought).
 * - Select and call appropriate tools from Tool Registry.
 * - Collect tool results (Observation).
 * - Iterate until task is complete or escalate to Recovery Agent.
 * - Persist tool calls and results for audit/replay.
 *
 * Inputs:
 * - Task (from Planner/Coordinator)
 * - Available tools (from Tool Registry)
 * - Current agent state (memory)
 *
 * Outputs:
 * - Tool calls (UniversalToolCall[], persisted in AnalysisMessage.toolCalls[])
 * - Tool results (any[], persisted in AnalysisMessage.toolResults[])
 * - Execution trace (for debugging/audit)
 * - Final task result
 *
 * ReAct Loop:
 * 1. Thought: Analyze task, plan tool calls
 * 2. Action: Call tool(s) from registry
 * 3. Observation: Receive tool result
 * 4. Repeat until task complete or max iterations
 *
 * Implementation Notes:
 * - Tool calls are universal (provider-agnostic).
 * - Tools are sandboxed; no direct DB access (use deterministic interfaces).
 * - Tool arguments validated before execution.
 * - Max iterations to prevent infinite loops.
 * - Streaming support for long-running tools.
 * - All state persisted for replay.
 *
 * Security:
 * - Tool sandboxing: each tool runs in isolated context.
 * - Tool arguments validated against JSON schema.
 * - No cross-tool state leakage.
 * - Critic Agent reviews results after task completion.
 *
 * Provider-Agnostic: Works with any LLM for reasoning; tools are universal.
 */

import { registry } from '../tools/index.js';
import { getPrompt } from '../prompts/index.js';
import { calculateUsage } from '../../utils/usageCalculator.js';

/**
 * Executor Agent Configuration
 * - Low temperature (precise tool calling)
 * - ReAct loops with iteration limit
 * - Long response allowed
 */
const EXECUTOR_CONFIG = {
    temperature: 0.3, // Low: precise tool selection
    maxTokens: 4000, // Detailed reasoning + multiple tool calls
    topP: 0.9,
    timeoutMs: 30000, // Longer: may call multiple tools
    maxRetries: 3,
    retryBackoff: 'exponential',
    maxIterations: 10, // Prevent infinite loops
    iterationTimeoutMs: 5000, // Per iteration
};

import {
    validateToolCall,
    validateToolArguments,
    validateToolResult
} from '../tools/validateToolContract.js';
import { EventEmitter } from 'events';
export class Executor extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            ...EXECUTOR_CONFIG,
            ...config // Allow override
        };
        this.currentTask = null;
    }

    /**
     * Reset executor state for next task
     */
    reset() {
        this.currentTask = null; //TODO: anatoli implemntieren
        console.log('[Executor] State reset');
    }

    /**
     * Main executor invocation
     * Implements ReAct loop: Thought → Action → Observation → Repeat
     *
     * @param {object} params
     * @param {array} params.messages - Chat messages with system + user/assistant history
     * @param {object} params.context - Domain context (domain, provider, sessionId, etc)
     * @param {array} params.toolNames - Optional: specific tools to make available (default: all)
     * @returns {promise<object>} Executor result with toolCalls and toolResults
     */
    async invoke({ messages, context = {}, toolNames }) {
        const startTime = Date.now();

        try {
            // Get provider from context
            if (!context.provider) {
                throw new Error('Provider required in executionContext for Executor');
            }

            // Get available tools from registry
            //TODO: anatoli check ob tools korrekt weiter gereicht werden
            const availableTools = this._getAvailableTools(toolNames, context.module);

            console.log(`[Executor.invoke] Starting ReAct with ${availableTools.length} available tools:`);

            // Pure text generation task (no tools) - call LLM once without tools
            if (availableTools.length === 0) {
                console.log('[Executor.invoke] No tools available - running pure text generation');
                
                const llmResponse = await this._callLLMForToolSelection(
                    messages,
                    [],  // No tools
                    context
                );

                return {
                    success: true,
                    toolCalls: [],
                    toolResults: [],
                    reasoning: llmResponse.content,
                    assistantMessage: llmResponse.content,
                    duration_ms: Date.now() - startTime,
                    usage: llmResponse.usage || null
                };
            }

            // ReAct loop state
            const toolCalls = [];
            const toolResults = [];
            const executionTrace = [];
            const toolCallCounts = new Map(); // Track how often each tool is called
            const allUsageData = [];  // ✨ Collect usage from each LLM call
            let currentMessages = [...messages];
            let iteration = 0;
            let lastAssistantContent = '';

            // ReAct Loop: Thought → Action → Observation
            while (iteration < this.config.maxIterations) {
                iteration++;
                const iterationStart = Date.now();

                console.log(`[Executor.invoke] ReAct iteration ${iteration}/${this.config.maxIterations}`);

                try {
                    // Step 1: THOUGHT - Call LLM to decide which tools to use
                    const llmResponse = await this._callLLMForToolSelection(
                        currentMessages,
                        availableTools,
                        context
                    );

                    // ✨ Collect usage data from LLM response
                    if (llmResponse.usage) {
                        allUsageData.push(llmResponse.usage);
                    }

                    if (llmResponse.content) {
                        lastAssistantContent = llmResponse.content;
                    }

                    console.log(`[Executor.invoke] Step 1: THOUGHT complete. Tool calls received: ${llmResponse.toolCalls.length}`);

                    // Check if LLM wants to call tools
                    if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
                        // LLM decided task is complete
                        executionTrace.push({
                            iteration,
                            step: 'THOUGHT',
                            decision: 'TASK_COMPLETE',
                            reasoning: llmResponse.content,
                        });
                        console.log('[Executor.invoke] LLM decided task is complete. Exiting ReAct loop.');
                        break;
                    }

                    // Step 2: ACTION - Execute tools
                    const iterationToolResults = [];
                    console.log(`[Executor.invoke] Step 2: ACTION. Executing ${llmResponse.toolCalls.length} tools`);

                    for (const toolCall of llmResponse.toolCalls) {
                        // Track tool call frequency
                        const callCount = (toolCallCounts.get(toolCall.tool) || 0) + 1;
                        toolCallCounts.set(toolCall.tool, callCount);

                        // Warn if same tool is called too many times
                        if (callCount > 3) {
                            console.warn(`[Executor.invoke] ⚠️ Tool "${toolCall.tool}" called ${callCount} times. Possible infinite loop!`);
                        }

                        console.log(`[Executor.invoke] Executing tool: ${toolCall.tool} (call #${callCount})`);

                        // Stream tool call immediately
                        this.emit('agent_executor:tool_call', {
                            tool: toolCall.tool,
                            arguments: toolCall.arguments,
                            callId: toolCall.id,
                            timestamp: Date.now()
                        });

                        const toolResult = await this._executeTool(
                            toolCall,
                            context
                        );

                        iterationToolResults.push(toolResult);
                        toolCalls.push(toolCall);
                        toolResults.push(toolResult);

                        console.log(`[Executor.invoke] Tool result: ${toolCall.tool} = ${toolResult.success ? 'success' : 'failed'}`);

                        // Stream tool result immediately
                        this.emit('agent_executor:tool_result', {
                            tool: toolCall.tool,
                            result: toolResult.result,
                            success: toolResult.success,
                            duration_ms: toolResult.duration_ms,
                            callId: toolCall.id,
                            timestamp: Date.now()
                        });
                    }

                    // Step 3: OBSERVATION - Add results to messages for next iteration
                    currentMessages.push({
                        role: 'assistant',
                        content: llmResponse.content,
                        tool_calls: llmResponse.toolCalls.map(tc => ({
                            id: tc.id,
                            type: 'function',
                            function: {
                                name: tc.tool,
                                arguments: JSON.stringify(tc.arguments)
                            }
                        }))
                    });

                    // Add tool results as messages
                    for (const result of iterationToolResults) {
                        currentMessages.push({
                            role: 'tool',
                            tool_call_id: result.id,
                            content: JSON.stringify({
                                success: result.success,
                                result: result.result,
                                error: result.error
                            })
                        });
                    }

                    executionTrace.push({
                        iteration,
                        step: 'ACTION',
                        toolCalls: llmResponse.toolCalls,
                        toolResults: iterationToolResults,
                        duration_ms: Date.now() - iterationStart
                    });

                } catch (error) {
                    console.error(`[Executor] Iteration ${iteration} error:`, error);

                    executionTrace.push({
                        iteration,
                        step: 'ERROR',
                        error: error.message,
                        duration_ms: Date.now() - iterationStart
                    });

                    // Don't break on error, let it try next iteration
                    // or eventually hit max iterations
                    if (iteration >= this.config.maxIterations) {
                        throw error;
                    }
                }

                // Check iteration timeout
                if (Date.now() - iterationStart > this.config.iterationTimeoutMs) {
                    console.warn(`[Executor] Iteration ${iteration} timeout`);
                    executionTrace.push({
                        iteration,
                        step: 'TIMEOUT',
                        message: 'Iteration timeout exceeded'
                    });
                    break;
                }
            }

            // Prepare final result
            const result = {
                success: true,
                toolCalls,
                toolResults,
                executionTrace,
                iterationCount: iteration,
                maxIterationsReached: iteration >= this.config.maxIterations,
                assistantMessage: lastAssistantContent,
                usage: this._aggregateUsage(allUsageData, context),  // ✨ Aggregated usage
                duration_ms: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };

            console.log(`[Executor] Completed: ${iteration} iterations, ${toolCalls.length} tools called`, {
                totalTokens: result.usage?.tokens?.total || 0,
                totalCost: result.usage?.cost?.total ? `$${result.usage.cost.total.toFixed(4)}` : 'N/A'
            });
            return result;

        } catch (error) {
            console.error('[Executor] Fatal error:', error);
            return {
                success: false,
                error: error.message,
                toolCalls: [],
                toolResults: [],
                duration_ms: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get available tools from registry
     * @private
     */
    _getAvailableTools(toolNames, module) {
        const tools = [];

        // Handle three cases:
        // 1. toolNames is undefined/null → load all tools (fallback for backward compatibility)
        // 2. toolNames is empty array [] → no tools needed (explicit, saves LLM costs)
        // 3. toolNames has items → load only those specific tools

        if (toolNames === undefined || toolNames === null) {
            // Case 1: Not specified → load all tools for module (fallback)
            const allTools = registry.listTools();
            for (const tool of allTools) {
                if (!module || tool.module === module) {
                    tools.push({
                        name: tool.name,
                        schema: registry.getSchema(tool.name),
                        description: tool.description
                    });
                }
            }
        } else if (Array.isArray(toolNames)) {
            if (toolNames.length === 0) {
                // Case 2: Explicitly empty → no tools needed (pure text generation task)
                console.log('[Executor._getAvailableTools] No tools requested (tools: []) - pure text generation');
                return [];
            } else {
                // Case 3: Specific tools requested → load only those
                for (const name of toolNames) {
                    if (registry.has(name)) {
                        tools.push({
                            name,
                            schema: registry.getSchema(name),
                            description: registry.getTool(name).description
                        });
                    } else {
                        console.warn(`[Executor._getAvailableTools] Tool "${name}" not found in registry`);
                    }
                }
            }
        }

        return tools;
    }

    /**
     * Call LLM to select and reason about which tools to use (with retry logic)
     * @private
     */
    async _callLLMForToolSelection(messages, availableTools, context) {
        let lastError = null;

        // Retry loop for LLM tool selection
        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                // Prepare universal tool definitions for provider
                console.log(`[Executor._callLLMForToolSelection] Attempt ${attempt + 1}/${this.config.maxRetries + 1}. Preparing ${availableTools.length} universal tools for provider`);
                const universalTools = availableTools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: tool.schema
                }));

                // Prepare messages with system prompt from executor prompt
                const executorPrompt = getPrompt('executor');
                const messagesWithSystem = [
                    { role: 'system', content: executorPrompt },
                    ...messages
                ];

                // For intermediate tasks (not the final one), inject guidance so the LLM
                // produces brief analytical notes instead of a full user-facing answer.
                // The last task should produce the actual response the user sees.
                if (!context.isLastTask) {
                    messagesWithSystem.push({
                        role: 'system',
                        content: 'IMPORTANT: This is an INTERMEDIATE task in a multi-step pipeline. Your output will be used as input for subsequent tasks, NOT shown directly to the user. Provide brief, concise analytical notes or key findings (2-4 sentences max). Do NOT write a full user-facing answer or greeting. Focus on extracting and summarizing the relevant information needed for the next step.'
                    });
                }

                if (typeof context.provider.streamComplete !== 'function') {
                    throw new Error('Provider must support streamComplete()');
                }

                console.log(`[Executor._callLLMForToolSelection] Streaming with ${universalTools.length} tools`);
                let accumulatedContent = '';
                let toolCalls = [];
                let usage = null;  // ✨ Track usage
                const streamStartTime = Date.now();  // ✨ Track timing
                let firstTokenTime = null;

                // Build provider options - only include tools if we have any
                const streamOptions = {
                    messages: messagesWithSystem,
                    options: {
                        temperature: this.config.temperature,
                        maxTokens: this.config.maxTokens,
                        topP: this.config.topP
                    }
                };

                // Only pass tools and toolChoice if tools are available
                if (universalTools.length > 0) {
                    streamOptions.tools = universalTools;
                    streamOptions.options.toolChoice = 'auto';
                }

                for await (const chunk of context.provider.streamComplete(streamOptions)) {
                    if (chunk.type === 'content_delta' && chunk.content) {
                        // ✨ Track first token time
                        if (!firstTokenTime) {
                            firstTokenTime = Date.now();
                        }

                        accumulatedContent += chunk.content;

                        // Last task → stream as response:chunk (final user-facing answer)
                        // All other tasks → stream as reasoning (internal thinking)
                        if (context.isLastTask) {
                            this.emit('agent_executor:chunk', {
                                content: chunk.content,
                                role: 'assistant',
                                isComplete: false,
                                timestamp: Date.now()
                            });
                        } else {
                            this.emit('agent_executor:reasoning', {
                                content: chunk.content,
                                isComplete: false,
                                taskId: context.currentTask?.id,
                                timestamp: Date.now()
                            });
                        }
                    }

                    if (chunk.type === 'complete') {
                        accumulatedContent = chunk.content || accumulatedContent;
                        toolCalls = Array.isArray(chunk.toolCalls) ? chunk.toolCalls : [];
                        
                        // ✨ Debug: Check what we received
                        console.log(`[Executor._callLLMForToolSelection] Complete event received:`, {
                            hasUsage: !!chunk.usage,
                            usage: chunk.usage,
                            provider: context.provider.name
                        });
                        
                        // ✨ Extract usage from complete event
                        if (chunk.usage) {
                            usage = calculateUsage({
                                provider: context.provider.name,
                                model: context.provider.config.model,
                                providerUsage: chunk.usage,
                                timing: {
                                    startTime: streamStartTime,
                                    firstTokenTime,
                                    endTime: Date.now()
                                }
                            });
                            
                            console.log(`[Executor._callLLMForToolSelection] Calculated usage:`, usage);
                        } else {
                            // ✨ Fallback: Estimate tokens from content + messages
                            console.warn(`[Executor._callLLMForToolSelection] No usage in complete event from ${context.provider.name}. Using token estimation.`);
                            
                            usage = calculateUsage({
                                provider: context.provider.name,
                                model: context.provider.config.model,
                                providerUsage: null,
                                content: accumulatedContent,  // ✨ Pass content for output estimation
                                messages: messagesWithSystem, // ✨ Pass messages for input estimation
                                timing: {
                                    startTime: streamStartTime,
                                    firstTokenTime,
                                    endTime: Date.now()
                                }
                            });
                            
                            console.log(`[Executor._callLLMForToolSelection] Estimated usage:`, usage);
                        }
                    }
                }

                // Emit completion event matching the streaming channel used
                if (context.isLastTask) {
                    this.emit('agent_executor:chunk', {
                        content: '',
                        role: 'assistant',
                        isComplete: true,
                        timestamp: Date.now()
                    });
                    console.log('[Executor._callLLMForToolSelection] 🎯 Last task - streamed as final response');
                } else {
                    this.emit('agent_executor:reasoning', {
                        content: '',
                        isComplete: true,
                        taskId: context.currentTask?.id,
                        timestamp: Date.now()
                    });
                    console.log('[Executor._callLLMForToolSelection] 🧠 Intermediate task - streamed as reasoning');
                }

                console.log(`[Executor._callLLMForToolSelection] Stream complete`, {
                    contentLength: accumulatedContent.length,
                    toolCallsCount: toolCalls.length,
                    tokens: usage?.tokens?.total || 0,
                    cost: usage?.cost?.total ? `$${usage.cost.total.toFixed(4)}` : 'N/A'
                });

                return {
                    content: accumulatedContent,
                    toolCalls,
                    usage  // ✨ Include usage in response
                };
            } catch (error) {
                lastError = error;
                console.warn(`[Executor._callLLMForToolSelection] Attempt ${attempt + 1} failed: ${error.message}`);

                if (attempt === this.config.maxRetries || error.status === 429) {
                    console.error('[Executor._callLLMForToolSelection] All retries exhausted or rate limited.');
                    const err = new Error(`LLM tool selection failed: ${lastError.message}`);
                    err.status = lastError.status;
                    err.type = lastError.type;
                    throw err;
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
     * Execute a single tool from registry
     * @private
     */
    async _executeTool(toolCall, context) {
        const normalizedCall = this._normalizeToolCall(toolCall);
        const { id, tool, arguments: toolArgs } = normalizedCall;
        const start = Date.now();

        try {
            // Validate tool call structure
            const callValidation = validateToolCall(normalizedCall);
            if (!callValidation.valid) {
                return {
                    id,
                    tool,
                    success: false,
                    error: `Invalid tool call: ${callValidation.errors.join('; ')}`,
                    result: null,
                    callId: id,
                    duration_ms: Date.now() - start
                };
            }

            // Validate tool exists
            if (!registry.has(tool)) {
                return {
                    id,
                    tool,
                    success: false,
                    error: `Tool not found: ${tool}`,
                    result: null,
                    callId: id,
                    duration_ms: Date.now() - start
                };
            }

            // Get tool
            const toolObj = registry.getTool(tool);

            // Validate arguments against schema
            const argValidation = validateToolArguments(toolArgs, toolObj.inputSchema);
            if (!argValidation.valid) {
                return {
                    id,
                    tool,
                    success: false,
                    error: `Invalid arguments: ${argValidation.errors.join('; ')}`,
                    result: null,
                    callId: id,
                    duration_ms: Date.now() - start
                };
            }

            // Execute tool (with timeout)
            const result = await Promise.race([
                toolObj.execute(toolArgs, context),
                this._createTimeout(this.config.iterationTimeoutMs)
            ]);

            const successPayload = {
                id,
                tool,
                success: true,
                result,
                callId: id,
                duration_ms: Date.now() - start
            };

            const resultValidation = validateToolResult(successPayload);
            if (!resultValidation.valid) {
                return {
                    id,
                    tool,
                    success: false,
                    error: `Invalid tool result: ${resultValidation.errors.join('; ')}`,
                    result: null,
                    callId: id,
                    duration_ms: successPayload.duration_ms
                };
            }

            return successPayload;

        } catch (error) {
            console.error(`[Executor._executeTool] Tool ${tool} failed:`, error);
            return {
                id,
                tool,
                success: false,
                error: error.message || 'Tool execution failed',
                result: null,
                callId: id,
                duration_ms: Date.now() - start
            };
        }
    }

    /**
     * Normalize tool call shape to match universal contract
     * @private
     */
    _normalizeToolCall(call) {
        const normalizedId =
            typeof call.id === 'string' && /^call_[a-zA-Z0-9_]+$/.test(call.id)
                ? call.id
                : `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const safeArgs = call && typeof call.arguments === 'object' && call.arguments !== null
            ? call.arguments
            : {};

        return {
            ...call,
            id: normalizedId,
            arguments: safeArgs
        };
    }

    /**
     * Aggregate usage from multiple LLM calls in ReAct loop
     * @private
     */
    _aggregateUsage(allUsageData, context) {
        if (!allUsageData || allUsageData.length === 0) {
            return null;
        }

        // If only one call, return it directly
        if (allUsageData.length === 1) {
            return allUsageData[0];
        }

        // Aggregate multiple calls
        const aggregated = {
            provider: context.provider.name,
            model: context.provider.config.model,
            tokens: { input: 0, output: 0, total: 0, cached: 0 },
            cost: { input: 0, output: 0, total: 0 },
            latency: { total_ms: 0, tokensPerSecond: 0 }
        };

        for (const usage of allUsageData) {
            if (!usage) continue;
            
            aggregated.tokens.input += usage.tokens?.input || 0;
            aggregated.tokens.output += usage.tokens?.output || 0;
            aggregated.tokens.total += usage.tokens?.total || 0;
            aggregated.tokens.cached += usage.tokens?.cached || 0;
            
            aggregated.cost.input += usage.cost?.input || 0;
            aggregated.cost.output += usage.cost?.output || 0;
            aggregated.cost.total += usage.cost?.total || 0;
            
            aggregated.latency.total_ms += usage.latency?.total_ms || 0;
        }

        // Average tokens per second
        if (aggregated.latency.total_ms > 0 && aggregated.tokens.output > 0) {
            aggregated.latency.tokensPerSecond = parseFloat(
                (aggregated.tokens.output / (aggregated.latency.total_ms / 1000)).toFixed(2)
            );
        }

        // Round costs
        aggregated.cost.input = parseFloat(aggregated.cost.input.toFixed(6));
        aggregated.cost.output = parseFloat(aggregated.cost.output.toFixed(6));
        aggregated.cost.total = parseFloat(aggregated.cost.total.toFixed(6));

        return aggregated;
    }
}
