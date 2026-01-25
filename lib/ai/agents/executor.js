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

export class Executor {
    constructor(config = {}) {
        this.config = {
            temperature: 0.3,
            max_tokens: 4000,
            max_iterations: 10,
            iteration_timeout_ms: 5000,
            ...config
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
            const availableTools = this._getAvailableTools(toolNames, context.module);
            
            console.log(`[Executor.invoke] Starting ReAct with ${availableTools.length} available tools:`, availableTools.map(t => t.name));
            
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
            while (iteration < this.config.max_iterations) {
                iteration++;
                const iterationStart = Date.now();
                
                console.log(`[Executor.invoke] ReAct iteration ${iteration}/${this.config.max_iterations}`);

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
                    
                    for (const toolCall of llmResponse.toolCalls) {
                        console.log(`[Executor.invoke] Executing tool: ${toolCall.tool}`);
                        const toolResult = await this._executeTool(
                            toolCall,
                            context
                        );
                        
                        iterationToolResults.push(toolResult);
                        toolCalls.push(toolCall);
                        toolResults.push(toolResult);
                        
                        console.log(`[Executor.invoke] Tool result: ${toolCall.tool} = ${toolResult.success ? 'success' : 'failed'}`);
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
                    if (iteration >= this.config.max_iterations) {
                        throw error;
                    }
                }

                // Check iteration timeout
                if (Date.now() - iterationStart > this.config.iteration_timeout_ms) {
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
                maxIterationsReached: iteration >= this.config.max_iterations,
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

        if (toolNames && Array.isArray(toolNames)) {
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
     * Call LLM to select and reason about which tools to use
     * @private
     */
    async _callLLMForToolSelection(messages, availableTools, provider, context) {
        // Prepare universal tool definitions for provider
        console.log(`[Executor._callLLMForToolSelection] Preparing ${availableTools.length} universal tools for provider`);
        const universalTools = availableTools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.schema
        }));

        try {
            // Stream if socket + streaming provider available, else fallback to single complete
            const canStream = context?.socket && typeof provider.streamComplete === 'function';

            if (canStream) {
                console.log(`[Executor._callLLMForToolSelection] Streaming with ${universalTools.length} tools`);
                let accumulatedContent = '';
                let toolCalls = [];

                for await (const chunk of provider.streamComplete({
                    messages,
                    tools: universalTools,
                    options: {
                        toolChoice: 'auto',
                        temperature: this.config.temperature,
                        maxTokens: this.config.max_tokens
                    }
                })) {
                    if (chunk.type === 'content_delta' && chunk.content) {
                        accumulatedContent += chunk.content;
                        // emit streaming chunk without completing
                        context.socket.emit('response:chunk', {
                            content: chunk.content,
                            role: 'assistant',
                            isComplete: false,
                            timestamp: Date.now()
                        });
                    }

                    if (chunk.type === 'complete') {
                        accumulatedContent = chunk.content || accumulatedContent;
                        toolCalls = Array.isArray(chunk.toolCalls) ? chunk.toolCalls : [];
                    }
                }

                // Emit final completion chunk (empty content, just signals isComplete)
                // Frontend has already accumulated all deltas
                context.socket.emit('response:chunk', {
                    content: '',
                    role: 'assistant',
                    isComplete: true,
                    timestamp: Date.now()
                });

                console.log(`[Executor._callLJMForToolSelection] Stream complete`, {
                    hasToolCalls: toolCalls.length > 0,
                    toolCallCount: toolCalls.length,
                    content: accumulatedContent.substring(0, 100)
                });

                return {
                    content: accumulatedContent,
                    toolCalls
                };
            }

            // Non-streaming path
            console.log(`[Executor._callLLMForToolSelection] Calling LLM with ${universalTools.length} tools (non-streaming)`);
            const response = await provider.complete({
                messages,
                tools: universalTools,
                options: {
                    toolChoice: 'auto', // Let LLM decide when to call tools
                    temperature: this.config.temperature,
                    maxTokens: this.config.max_tokens
                }
            });
            
            console.log(`[Executor._callLLMForToolSelection] Response received:`, {
                hasToolCalls: !!response.toolCalls,
                toolCallCount: response.toolCalls?.length || 0,
                content: response.content?.substring(0, 100)
            });

            const toolCalls = Array.isArray(response.toolCalls) ? response.toolCalls : [];

            return {
                content: response.content || '',
                toolCalls
            };
        } catch (error) {
            console.error('[Executor._callLLMForToolSelection] Error:', error);
            throw error;
        }
    }

    /**
     * Parse tool calls from LLM response
     * @private
     */
    _parseToolCalls(response) {
        const toolCalls = [];

        console.log(`[Executor._parseToolCalls] Parsing response:`, {
            hasToolCalls: !!response.tool_calls,
            isArray: Array.isArray(response.tool_calls),
            length: response.tool_calls?.length
        });

        if (!response.tool_calls || !Array.isArray(response.tool_calls)) {
            console.log('[Executor._parseToolCalls] No tool calls in response');
            return toolCalls;
        }

        console.log(`[Executor._parseToolCalls] Found ${response.tool_calls.length} tool calls`);

        for (const toolCall of response.tool_calls) {
            try {
                // Handle both OpenAI format and parsed format
                let arguments_ = toolCall.arguments;
                
                if (typeof arguments_ === 'string') {
                    arguments_ = JSON.parse(arguments_);
                }

                const parsed = {
                    id: toolCall.id || `tool-${Date.now()}-${Math.random()}`,
                    tool: toolCall.function?.name || toolCall.tool,
                    arguments: arguments_
                };
                
                console.log(`[Executor._parseToolCalls] Parsed tool call:`, parsed.tool);
                toolCalls.push(parsed);
            } catch (error) {
                console.warn('[Executor._parseToolCalls] Failed to parse tool call:', error);
            }
        }

        console.log(`[Executor._parseToolCalls] Returned ${toolCalls.length} parsed tool calls`);
        return toolCalls;
    }

    /**
     * Execute a single tool from registry
     * @private
     */
    async _executeTool(toolCall, context) {
        const { id, tool, arguments: toolArgs } = toolCall;

        try {
            // Validate tool exists
            if (!registry.has(tool)) {
                return {
                    id,
                    tool,
                    success: false,
                    error: `Tool not found: ${tool}`,
                    result: null
                };
            }

            // Get tool
            const toolObj = registry.getTool(tool);

            // Validate arguments against schema
            try {
                registry.validate(tool, toolArgs);
            } catch (validationError) {
                return {
                    id,
                    tool,
                    success: false,
                    error: `Invalid arguments: ${validationError.message}`,
                    result: null
                };
            }

            // Execute tool (with timeout)
            const result = await Promise.race([
                toolObj.execute(toolArgs, context),
                this._createTimeout(this.config.iteration_timeout_ms)
            ]);

            return {
                id,
                tool,
                success: true,
                result,
                callId: id,
                duration_ms: Date.now()
            };

        } catch (error) {
            console.error(`[Executor._executeTool] Tool ${tool} failed:`, error);
            return {
                id,
                tool,
                success: false,
                error: error.message || 'Tool execution failed',
                result: null,
                callId: id
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
}
