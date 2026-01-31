/**
 * Executor Agent (ReAct Loop)
 * ===========================
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
 * - Critic Agent reviews results before synthesis.
 *
 * Provider-Agnostic: Works with any LLM for reasoning; tools are universal.
 */

import { registry } from '../tools/index.js';
import { getPrompt } from '../prompts/index.js';
import { EXECUTOR_CONFIG } from '../config/index.js';
import {
    validateToolCall,
    validateToolArguments,
    validateToolResult
} from '../tools/validateToolContract.js';

export class Executor {
    constructor(config = {}) {
        this.config = {
            ...EXECUTOR_CONFIG,
            ...config // Allow override
        };
    }

    /**
     * Main executor invocation
     * Implements ReAct loop: Thought → Action → Observation → Repeat
     *
     * @param {object} params
     * @param {array} params.messages - Chat messages with system + user/assistant history
     * @param {object} params.context - Domain context (domain, analysis, etc)
     * @param {object} params.provider - LLM provider (for tool selection reasoning)
     * @param {array} params.toolNames - Optional: specific tools to make available (default: all)
     * @returns {promise<object>} Executor result with toolCalls and toolResults
     */
    async invoke({ messages, context = {}, provider, toolNames }) {
        const startTime = Date.now();

        try {
            if (!provider) {
                throw new Error('Provider required for Executor');
            }

            // Get available tools from registry
            //TODO: anatoli check ob tools korrekt weiter gereicht werden
            const availableTools = this._getAvailableTools(toolNames, context.module);
            
            console.log(`[Executor.invoke] Starting ReAct with ${availableTools.length} available tools:`);
            
            if (availableTools.length === 0) {
                return {
                    success: false,
                    error: 'No tools available for execution',
                    toolCalls: [],
                    toolResults: [],
                    reasoning: 'No matching tools found in registry',
                    duration_ms: Date.now() - startTime,
                };
            }

            // ReAct loop state
            const toolCalls = [];
            const toolResults = [];
            const executionTrace = [];
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
                        provider,
                        context
                    );

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
                    
                    // Extract socket for streaming
                    const socket = context?.socket;
                    
                    for (const toolCall of llmResponse.toolCalls) {
                        console.log(`[Executor.invoke] Executing tool: ${toolCall.tool}`);
                        
                        // Stream tool call immediately
                        if (socket && typeof socket.emit === 'function') {
                            socket.emit('agent:tool_call', {
                                tool: toolCall.tool,
                                arguments: toolCall.arguments,
                                callId: toolCall.id,
                                timestamp: Date.now()
                            });
                        }
                        
                        const toolResult = await this._executeTool(
                            toolCall,
                            context
                        );
                        
                        iterationToolResults.push(toolResult);
                        toolCalls.push(toolCall);
                        toolResults.push(toolResult);
                        
                        console.log(`[Executor.invoke] Tool result: ${toolCall.tool} = ${toolResult.success ? 'success' : 'failed'}`);
                        
                        // Stream tool result immediately
                        if (socket && typeof socket.emit === 'function') {
                            socket.emit('agent:tool_result', {
                                tool: toolCall.tool,
                                result: toolResult.result,
                                success: toolResult.success,
                                duration_ms: toolResult.duration_ms,
                                callId: toolCall.id,
                                timestamp: Date.now()
                            });
                        }
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
                duration_ms: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };

            console.log(`[Executor] Completed: ${iteration} iterations, ${toolCalls.length} tools called`);
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

        if (toolNames && Array.isArray(toolNames) && toolNames.length > 0) {
            // Use specified tools
            for (const name of toolNames) {
                if (registry.has(name)) {
                    tools.push({
                        name,
                        schema: registry.getSchema(name),
                        description: registry.getTool(name).description
                    });
                }
            }
        } else {
            // Use all tools for the module (or all if no module specified)
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
        }

        return tools;
    }

    /**
     * Call LLM to select and reason about which tools to use (with retry logic)
     * @private
     */
    async _callLLMForToolSelection(messages, availableTools, provider, context) {
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

                // Always stream (requires socket + streamComplete)
                if (!context?.socket) {
                    throw new Error('Socket required for streaming LLM responses');
                }
                if (typeof provider.streamComplete !== 'function') {
                    throw new Error('Provider must support streamComplete()');
                }

                console.log(`[Executor._callLLMForToolSelection] Streaming with ${universalTools.length} tools`);
                let accumulatedContent = '';
                let toolCalls = [];

                for await (const chunk of provider.streamComplete({
                    messages: messagesWithSystem,
                    tools: universalTools,
                    options: {
                        toolChoice: 'auto',
                        temperature: this.config.temperature,
                        maxTokens: this.config.maxTokens,
                        topP: this.config.topP
                    }
                })) {
                    if (chunk.type === 'content_delta' && chunk.content) {
                        accumulatedContent += chunk.content;
                        // Emit reasoning chunks to show "thinking" in UI
                        context.socket.emit('agent:reasoning', {
                            content: chunk.content,
                            isComplete: false,
                            timestamp: Date.now()
                        });
                    }

                    if (chunk.type === 'complete') {
                        accumulatedContent = chunk.content || accumulatedContent;
                        toolCalls = Array.isArray(chunk.toolCalls) ? chunk.toolCalls : [];
                    }
                }

                // Emit reasoning complete
                context.socket.emit('agent:reasoning', {
                    content: '',
                    isComplete: true,
                    timestamp: Date.now()
                });

                console.log(`[Executor._callLLMForToolSelection] Stream complete`, {
                    hasToolCalls: toolCalls.length > 0,
                    toolCallCount: toolCalls.length,
                    content: accumulatedContent.substring(0, 100)
                });

                return {
                    content: accumulatedContent,
                    toolCalls
                };
            } catch (error) {
                lastError = error;
                console.warn(`[Executor._callLLMForToolSelection] Attempt ${attempt + 1} failed: ${error.message}`);

                if (attempt === this.config.maxRetries) {
                    console.error('[Executor._callLLMForToolSelection] All retries exhausted');
                    throw new Error(`LLM tool selection failed: ${lastError.message}`);
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
     * Helper: Create timeout promise
     * @private
     */
    _createTimeout(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
        });
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
}
