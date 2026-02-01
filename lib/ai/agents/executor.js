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
 * - Critic Agent reviews results after task completion.
 *
 * Provider-Agnostic: Works with any LLM for reasoning; tools are universal.
 */

import { registry } from '../tools/index.js';
import { getPrompt } from '../prompts/index.js';

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
            const toolCallCounts = new Map(); // Track how often each tool is called
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

                        // If this is the LAST task, stream as final response:chunk
                        // Otherwise stream as agent:reasoning (internal thinking)
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
                    }
                }

                // Emit completion (response:chunk for last task, agent:reasoning for others)
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
                }

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
