/**
 * OpenAI Provider Adapter
 * =======================
 * Purpose: Bridge between universal agent interface and OpenAI API.
 *
 * Responsibilities:
 * - Convert universal tool definitions → OpenAI `tools[]` format
 * - Convert OpenAI `tool_calls[]` → universal tool calls
 * - Format tool results → OpenAI `role=tool` messages
 * - Handle streaming responses with delta accumulation
 * - Parse and validate tool call JSON arguments
 * - Manage context window limits
 * - Detect and handle API errors, rate limits, retries
 *
 * Architecture:
 * ┌─────────────────────────────────┐
 * │  Agent (Router, Planner, etc)   │
 * │  Receives universal interface   │
 * └──────────────┬──────────────────┘
 *                │
 *        invoke({ messages, tools, ... })
 *                │
 * ┌──────────────▼──────────────────┐
 * │  OpenAIAdapter                  │
 * │  - convertTools() ───┐          │
 * │  - complete()        ├─→ OpenAI API
 * │  - streamComplete()  │  (gpt-4-turbo)
 * │  - formatResults() ──┘          │
 * └──────────────┬──────────────────┘
 *                │
 *        Response with { content, toolCalls }
 *                │
 * ┌──────────────▼──────────────────┐
 * │  Agent processes response       │
 * │  (Universal interface)          │
 * └─────────────────────────────────┘
 *
 * Key Translations:
 * ┌────────────────────────────────────────────────────┐
 * │ Universal ←→ OpenAI Mapping                       │
 * ├────────────────────────────────────────────────────┤
 * │ UniversalTool.inputSchema                        │
 * │   ↓ convertTools()                                │
 * │ tools[{ type: 'function', function: {...} }]    │
 * ├────────────────────────────────────────────────────┤
 * │ OpenAI tool_calls[]                             │
 * │   ↓ parseToolCalls()                             │
 * │ UniversalToolCall[] { id, tool, arguments }     │
 * ├────────────────────────────────────────────────────┤
 * │ ToolResult { id, result, success }               │
 * │   ↓ formatToolResults()                           │
 * │ Message { role: 'tool', tool_call_id, content }  │
 * └────────────────────────────────────────────────────┘
 *
 * Capabilities:
 * - Parallel tool calls: YES (OpenAI supports multiple tools per response)
 * - Streaming: YES (real-time content + tool call deltas)
 * - Vision: YES (for gpt-4-vision model)
 * - Function calling: YES (tool_choice parameter)
 *
 * Context Window Management:
 * - Auto-detect from model name
 * - gpt-4-turbo: 128k tokens
 * - gpt-4: 8k tokens
 * - gpt-3.5-turbo: 4k-16k depending on variant
 *
 * Error Handling:
 * - Network errors: throw (Recovery Agent retries)
 * - Rate limits: throw (Recovery Agent implements backoff)
 * - Invalid JSON in tool args: attempt recovery, fallback to string
 * - Model errors: throw with error message from OpenAI
 *
 * Streaming Implementation:
 * - Accumulates tool_calls across deltas
 * - Yields chunk deltas for real-time UX
 * - Recovers from partial JSON in arguments
 * - Yields final { type: 'complete' } when done
 *
 * Implementation Notes:
 * - Stateless: no side effects, pure translation
 * - Provider-specific quirks handled here (not in agents)
 * - No agent logic: just format translation
 * - Test with mock responses (avoid real API calls in tests)
 * - All errors include context for debugging
 */

import OpenAI from 'openai';

export class OpenAIAdapter {
    /**
     * Initialize OpenAI adapter
     * 
     * @param {object} config - Configuration object
     * @param {string} config.apiKey - OpenAI API key (required)
     * @param {string} config.model - Model name (default: 'gpt-4-turbo')
     * @param {number} config.temperature - Temperature 0-2 (default: 0.7)
     * @param {number} config.maxTokens - Max output tokens (default: 4096)
     * @param {string} config.baseUrl - Custom API endpoint (optional, for proxies)
     * @param {number} config.requestTimeoutMs - Timeout for requests (default: 60000)
     * @throws {Error} If apiKey is missing
     */
    constructor(config) {
        if (!config?.apiKey) {
            throw new Error('OpenAI API key is required');
        }

        this.config = {
            model: 'gpt-4-turbo',
            temperature: 0.7,
            maxTokens: 4096,
            requestTimeoutMs: 60000,
            ...config
        };

        this.client = new OpenAI({
            apiKey: this.config.apiKey,
            baseURL: "http://localhost:11434/v1", //this.config.baseUrl,
            timeout: this.config.requestTimeoutMs,
            maxRetries: 2,
        });

        this.name = 'openai';
        this.capabilities = {
            parallel_tool_calls: true,
            streaming: true,
            vision: this._supportsVision(this.config.model),
            context_window: this._getContextWindow(this.config.model),
        };
    }

    /**
     * Detect if model supports vision
     * @private
     */
    _supportsVision(model) {
        return model.includes('vision') ||
            model.includes('gpt-4') ||
            model.includes('gpt-4-turbo');
    }

    /**
     * Get context window for model
     * @private
     */
    _getContextWindow(model) {
        if (model.includes('gpt-4-turbo') || model.includes('gpt-4-1106')) return 128000;
        if (model.includes('gpt-4')) return 8192;
        if (model.includes('gpt-3.5-turbo-16k')) return 16384;
        if (model.includes('gpt-3.5-turbo')) return 4096;
        return 4096;
    }

    /**
     * Convert universal tool definitions to OpenAI tools format
     * 
     * UniversalTool:
     * {
     *   name: 'analyze_document',
     *   description: 'Analyze a document',
     *   inputSchema: { type: 'object', properties: {...}, required: [...] }
     * }
     * 
     * ↓ convertTools()
     * 
     * OpenAI format:
     * [{
     *   type: 'function',
     *   function: {
     *     name: 'analyze_document',
     *     description: 'Analyze a document',
     *     parameters: { type: 'object', properties: {...}, required: [...] }
     *   }
     * }]
     * 
     * @param {array} tools - Universal tool definitions
     * @returns {array|undefined} OpenAI tools[] format, or undefined if empty
     */
    convertTools(tools) {
        if (!tools || !Array.isArray(tools) || tools.length === 0) {
            return undefined;
        }

        return tools.map(tool => {
            if (!tool.name || !tool.description || !tool.inputSchema) {
                throw new Error(`Invalid tool definition: missing name, description, or inputSchema`);
            }

            return {
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema
                }
            };
        });
    }

    /**
     * Parse OpenAI tool_calls to universal format
     * 
     * OpenAI tool_calls[]:
     * [{
     *   id: 'call_abc123',
     *   type: 'function',
     *   function: {
     *     name: 'analyze_document',
     *     arguments: '{"doc_id": "123"}'
     *   }
     * }]
     * 
     * ↓ parseToolCalls()
     * 
     * UniversalToolCall[]:
     * [{
     *   id: 'call_abc123',
     *   tool: 'analyze_document',
     *   arguments: { doc_id: '123' }
     * }]
     * 
     * @param {array} toolCalls - OpenAI tool_calls
     * @returns {array} Universal tool calls format
     */
    parseToolCalls(toolCalls) {
        if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
            return [];
        }

        return toolCalls.map(call => {
            const { id, function: func } = call;

            if (!id || !func?.name || !func?.arguments) {
                console.warn('[OpenAIAdapter] Invalid tool call format:', call);
                return null;
            }

            let arguments_;
            try {
                arguments_ = typeof func.arguments === 'string'
                    ? JSON.parse(func.arguments)
                    : func.arguments;
            } catch (error) {
                console.error('[OpenAIAdapter] Failed to parse tool arguments:', func.arguments, error);
                // Fallback: treat as string argument
                arguments_ = { input: func.arguments };
            }

            return {
                id,
                tool: func.name,
                arguments: arguments_
            };
        }).filter(call => call !== null);
    }

    /**
     * Normalize messages for OpenAI API
     * OpenAI only accepts content as strings (not objects)
     * @private
     */
    _normalizeMessages(messages) {
        if (!messages || !Array.isArray(messages)) return [];
        
        return messages.map(msg => {
            // Ensure content is a string
            let content = msg.content;
            
            if (typeof content === 'string') {
                // Already a string - good
                return msg;
            } else if (typeof content === 'object' && content !== null) {
                // Object - convert to string (take .text or JSON.stringify)
                if (content.text && typeof content.text === 'string') {
                    return { ...msg, content: content.text };
                } else {
                    return { ...msg, content: JSON.stringify(content) };
                }
            } else {
                // Fallback: empty string
                return { ...msg, content: '' };
            }
        });
    }

    /**
     * Complete API call (non-streaming)
     * 
     * @param {object} params
     * @param {array} params.messages - Chat messages (role, content)
     * @param {array} params.tools - Universal tool definitions (optional)
     * @param {string} params.systemPrompt - System prompt (optional)
     * @param {object} params.options - Additional options
     * @param {number} params.options.temperature - Override temperature
     * @param {number} params.options.maxTokens - Override max tokens
     * @param {string} params.options.toolChoice - 'auto', 'required', or tool name
     * @returns {promise<object>} Response with content, toolCalls, finishReason, usage
     * @throws {error} On API or network error
     */
    async complete({ messages, tools, systemPrompt, options = {} }) {
        try {
            // Normalize messages: ensure content is always a string
            const normalizedMessages = this._normalizeMessages(messages);
            
            // Build message array
            const messageArray = systemPrompt
                ? [{ role: 'system', content: systemPrompt }, ...normalizedMessages]
                : normalizedMessages;

            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages: messageArray,
                temperature: options.temperature ?? this.config.temperature,
                max_tokens: options.maxTokens ?? this.config.maxTokens,
                tools: this.convertTools(tools),
                tool_choice: options.toolChoice || 'auto',
            });

            const message = response.choices[0]?.message;
            if (!message) {
                throw new Error('Empty response from OpenAI API');
            }

            return {
                content: message.content || '',
                toolCalls: message.tool_calls ? this.parseToolCalls(message.tool_calls) : [],
                finishReason: response.choices[0]?.finish_reason || 'unknown',
                usage: {
                    promptTokens: response.usage?.prompt_tokens,
                    completionTokens: response.usage?.completion_tokens,
                    totalTokens: response.usage?.total_tokens
                }
            };
        } catch (error) {
            console.error('[OpenAIAdapter.complete] Error:', error.message);
            throw new Error(`OpenAI API error: ${error.message}`);
        }
    }

    /**
     * Complete with streaming (async generator)
     * 
     * Yields chunks in real-time:
     * { type: 'content_delta', content: '...' }
     * { type: 'tool_call', id, tool, arguments }
     * { type: 'complete', content, toolCalls, finishReason, usage }
     * 
     * @param {object} params - Same as complete()
     * @yields {object} Streaming chunks
     * @throws {error} On API or network error
     */
    async *streamComplete({ messages, tools, systemPrompt, options = {} }) {
        try {
            // Normalize messages: ensure content is always a string
            const normalizedMessages = this._normalizeMessages(messages);
            
            // Build message array
            const messageArray = systemPrompt
                ? [{ role: 'system', content: systemPrompt }, ...normalizedMessages]
                : normalizedMessages;

            const stream = await this.client.chat.completions.create({
                model: this.config.model,
                messages: messageArray,
                temperature: options.temperature ?? this.config.temperature,
                max_tokens: options.maxTokens ?? this.config.maxTokens,
                tools: this.convertTools(tools),
                tool_choice: options.toolChoice || 'auto',
                stream: true,
            });

            let accumulatedContent = '';
            let toolCallsMap = new Map();

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;
                const finishReason = chunk.choices[0]?.finish_reason;

                // Stream content deltas
                if (delta?.content) {
                    accumulatedContent += delta.content;
                    yield {
                        type: 'content_delta',
                        content: delta.content
                    };
                }

                // Accumulate tool calls
                if (delta?.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                        const index = toolCall.index ?? 0;

                        if (!toolCallsMap.has(index)) {
                            toolCallsMap.set(index, {
                                id: toolCall.id || '',
                                type: 'function',
                                function: {
                                    name: toolCall.function?.name || '',
                                    arguments: ''
                                }
                            });
                        }

                        const accumulated = toolCallsMap.get(index);

                        if (toolCall.id) accumulated.id = toolCall.id;
                        if (toolCall.function?.name) {
                            accumulated.function.name = toolCall.function.name;
                        }
                        if (toolCall.function?.arguments) {
                            accumulated.function.arguments += toolCall.function.arguments;
                        }
                    }
                }

                // Finish: yield complete response
                if (finishReason) {
                    const accumulatedToolCalls = Array.from(toolCallsMap.values());
                    const parsedToolCalls = this.parseToolCalls(accumulatedToolCalls);

                    yield {
                        type: 'complete',
                        content: accumulatedContent,
                        toolCalls: parsedToolCalls,
                        finishReason: finishReason
                    };

                    // Stop iteration
                    break;
                }
            }
        } catch (error) {
            console.error('[OpenAIAdapter.streamComplete] Error:', error.message);
            throw new Error(`OpenAI streaming error: ${error.message}`);
        }
    }

    /**
     * Format tool results as OpenAI messages
     * 
     * ToolResult:
     * {
     *   id: 'call_abc123',
     *   result: { success: true, data: '...' } or string,
     *   success: true,
     *   duration_ms: 150
     * }
     * 
     * ↓ formatToolResults()
     * 
     * OpenAI message:
     * {
     *   role: 'tool',
     *   tool_call_id: 'call_abc123',
     *   content: '{"success": true, "data": "..."}'
     * }
     * 
     * @param {array} toolResults - Tool execution results
     * @returns {array} OpenAI-formatted messages with role='tool'
     */
    formatToolResults(toolResults) {
        if (!toolResults || !Array.isArray(toolResults)) {
            return [];
        }

        return toolResults.map(result => {
            if (!result.id) {
                console.warn('[OpenAIAdapter] Tool result missing id:', result);
                return null;
            }

            const content = typeof result.result === 'string'
                ? result.result
                : JSON.stringify(result.result);

            return {
                role: 'tool',
                tool_call_id: result.id,
                content: content
            };
        }).filter(msg => msg !== null);
    }
}
