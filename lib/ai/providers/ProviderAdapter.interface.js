/**
 * Provider Adapter Interface (Abstract Contract)
 * ==============================================
 * REQUIRED: All provider adapters MUST implement this interface.
 *
 * Purpose:
 * - Define the contract that all LLM provider adapters must fulfill
 * - Ensure agents can work with any provider without modification
 * - Specify method signatures, parameters, return types
 * - Document capabilities and limitations
 *
 * This is NOT a runtime interface (JS doesn't enforce at runtime),
 * but rather a CONTRACT that all adapters MUST follow.
 *
 * Usage:
 * Every new provider adapter (OpenAI, Anthropic, vLLM, etc) MUST:
 * 1. Implement all methods with these exact signatures
 * 2. Return data in the specified formats
 * 3. Document any provider-specific differences
 * 4. Pass all adapter tests
 *
 * Implementation Checklist:
 * ┌─ Constructor
 * │  ├─ Accept config with apiKey, model, temperature, maxTokens
 * │  ├─ Initialize client (SDK or HTTP)
 * │  ├─ Set this.name (e.g., 'openai')
 * │  └─ Set this.capabilities (parallel_tool_calls, streaming, vision, context_window)
 * │
 * ├─ convertTools(tools)
 * │  ├─ Accept universal tool definitions
 * │  ├─ Convert to provider-specific format
 * │  └─ Validate tool schemas
 * │
 * ├─ parseToolCalls(response)
 * │  ├─ Extract tool calls from provider response
 * │  ├─ Convert to universal format
 * │  └─ Validate tool call structure
 * │
 * ├─ complete(params)
 * │  ├─ Non-streaming LLM call
 * │  ├─ Return { content, toolCalls, finishReason, usage }
 * │  └─ Handle errors gracefully
 * │
 * ├─ streamComplete(params)
 * │  ├─ Async generator for streaming
 * │  ├─ Yield chunks with { type, content, toolCalls, ... }
 * │  └─ Handle streaming errors
 * │
 * └─ formatToolResults(results)
 *    ├─ Format tool results for provider
 *    ├─ Convert to provider message format
 *    └─ Return array of messages
 */

/**
 * Provider Adapter Interface
 * ==========================
 *
 * @interface ProviderAdapter
 */
export class ProviderAdapter {
    /**
     * Initialize provider adapter
     *
     * @param {object} config - Configuration object
     * @param {string} config.apiKey - API key for provider (REQUIRED)
     * @param {string} config.model - Model name/ID (REQUIRED)
     * @param {number} config.temperature - Temperature 0-2 (optional, default: 0.7)
     * @param {number} config.maxTokens - Max output tokens (optional, default: 4096)
     * @param {string} config.baseUrl - Custom API endpoint (optional)
     * @param {number} config.requestTimeoutMs - Request timeout (optional, default: 60000)
     * @throws {Error} If apiKey or model is missing
     *
     * Example:
     * const adapter = new OpenAIAdapter({
     *   apiKey: 'sk-...',
     *   model: 'gpt-4-turbo',
     *   temperature: 0.7,
     *   maxTokens: 4096
     * });
     */
    constructor(config) {
        // REQUIRED: Implement in subclass
        throw new Error('ProviderAdapter is abstract, use OpenAIAdapter or AnthropicAdapter');
    }

    /**
     * Provider name identifier
     * @type {string} - 'openai' | 'anthropic' | 'vllm' | etc
     */
    name;

    /**
     * Provider capabilities
     * @type {object}
     * @property {boolean} parallel_tool_calls - Can execute multiple tools in parallel
     * @property {boolean} streaming - Supports streaming responses
     * @property {boolean} vision - Supports vision/image input
     * @property {number} context_window - Max tokens for context (e.g., 128000)
     *
     * Example:
     * this.capabilities = {
     *   parallel_tool_calls: true,
     *   streaming: true,
     *   vision: true,
     *   context_window: 128000
     * }
     */
    capabilities;

    /**
     * Convert universal tool definitions to provider-specific format
     *
     * @param {array} tools - Array of universal tool definitions
     * @param {string} tools[].name - Tool name (e.g., 'analyze_segment')
     * @param {string} tools[].description - Human-readable description
     * @param {object} tools[].inputSchema - JSON schema for tool inputs
     * @returns {array|undefined} Provider-specific tools format, or undefined if empty
     * @throws {Error} If tool definition is invalid
     *
     * Universal Format:
     * [{
     *   name: 'analyze_segment',
     *   description: 'Analyze an EDIFACT segment',
     *   inputSchema: {
     *     type: 'object',
     *     properties: { segment_id: { type: 'string' } },
     *     required: ['segment_id']
     *   }
     * }]
     *
     * OpenAI Output:
     * [{
     *   type: 'function',
     *   function: {
     *     name: 'analyze_segment',
     *     description: 'Analyze an EDIFACT segment',
     *     parameters: { type: 'object', properties: {...}, required: [...] }
     *   }
     * }]
     *
     * Anthropic Output:
     * [{
     *   name: 'analyze_segment',
     *   description: 'Analyze an EDIFACT segment',
     *   input_schema: { type: 'object', properties: {...}, required: [...] }
     * }]
     */
    convertTools(tools) {
        throw new Error('convertTools() must be implemented');
    }

    /**
     * Extract tool calls from provider response
     *
     * @param {*} response - Provider-specific response object or content array
     * @returns {array} Array of universal tool calls
     *
     * Universal Tool Call Format:
     * [{
     *   id: 'call_abc123',
     *   tool: 'analyze_segment',
     *   arguments: { segment_id: 'UNH' }
     * }]
     *
     * OpenAI Response Format:
     * message.tool_calls = [{
     *   id: 'call_abc123',
     *   type: 'function',
     *   function: {
     *     name: 'analyze_segment',
     *     arguments: '{"segment_id": "UNH"}'
     *   }
     * }]
     *
     * Anthropic Response Format:
     * content = [{
     *   type: 'tool_use',
     *   id: 'call_abc123',
     *   name: 'analyze_segment',
     *   input: { segment_id: 'UNH' }
     * }]
     *
     * Responsibilities:
     * - Parse provider response for tool calls
     * - Convert provider format to universal format
     * - Handle JSON parsing (especially for OpenAI's string arguments)
     * - Validate parsed tool calls
     * - Return empty array if no tool calls
     * - Throw only on critical errors, warn on minor issues
     */
    parseToolCalls(response) {
        throw new Error('parseToolCalls() must be implemented');
    }

    /**
     * Complete (non-streaming) LLM call
     *
     * @param {object} params - Request parameters
     * @param {array} params.messages - Chat messages
     *        { role: 'system'|'user'|'assistant', content: string }
     * @param {array} params.tools - Universal tool definitions (optional)
     * @param {string} params.systemPrompt - System prompt (optional, alternative to messages)
     * @param {object} params.options - Additional options
     * @param {number} params.options.temperature - Override temperature
     * @param {number} params.options.maxTokens - Override max tokens
     * @param {string} params.options.toolChoice - 'auto' | 'required' | tool name
     * @returns {promise<object>} Response object
     *   {
     *     content: string,              // Generated text
     *     toolCalls: array,             // Universal tool calls
     *     finishReason: string,         // 'stop' | 'length' | 'tool_calls' | etc
     *     usage: {                      // Token usage
     *       promptTokens: number,
     *       completionTokens: number,
     *       totalTokens: number
     *     }
     *   }
     * @throws {Error} On API errors
     *
     * Example:
     * const response = await adapter.complete({
     *   messages: [{ role: 'user', content: 'Analyze this' }],
     *   tools: [...],
     *   options: { temperature: 0.7 }
     * });
     *
     * Responsibilities:
     * - Build provider-specific request
     * - Call provider API
     * - Parse response
     * - Convert to universal format
     * - Handle errors
     * - Return usage stats
     */
    async complete({ messages, tools, systemPrompt, options = {} }) {
        throw new Error('complete() must be implemented');
    }

    /**
     * Streaming LLM call (async generator)
     *
     * @param {object} params - Same as complete()
     * @yields {object} Streaming chunks
     *   - { type: 'content_delta', content: string }
     *   - { type: 'tool_call_delta', id, tool, arguments: partial }
     *   - { type: 'complete', content, toolCalls, finishReason, usage }
     * @throws {Error} On streaming errors
     *
     * Example:
     * for await (const chunk of adapter.streamComplete({...})) {
     *   if (chunk.type === 'content_delta') {
     *     console.log(chunk.content);
     *   }
     *   if (chunk.type === 'complete') {
     *     console.log('Done:', chunk.toolCalls);
     *   }
     * }
     *
     * Chunk Types:
     * 1. content_delta: Text streaming
     *    { type: 'content_delta', content: 'Hello' }
     *
     * 2. tool_call_delta: Partial tool call (accumulating)
     *    { type: 'tool_call_delta', id, tool, arguments: {...partial} }
     *
     * 3. complete: Final response
     *    { type: 'complete', content, toolCalls, finishReason, usage }
     *
     * Responsibilities:
     * - Stream from provider API
     * - Accumulate tool call arguments
     * - Yield intermediate deltas for UX
     * - Parse streaming chunks
     * - Handle streaming errors
     * - Yield final complete when done
     */
    async *streamComplete({ messages, tools, systemPrompt, options = {} }) {
        throw new Error('streamComplete() must be implemented');
    }

    /**
     * Format tool results as provider messages
     *
     * @param {array} toolResults - Tool execution results
     *        [{
     *          id: 'call_abc123',
     *          tool: 'analyze_segment',
     *          result: {...} or string,
     *          success: boolean,
     *          duration_ms: number,
     *          error: string (optional)
     *        }]
     * @returns {array} Provider-specific messages
     *
     * OpenAI Output:
     * [{
     *   role: 'tool',
     *   tool_call_id: 'call_abc123',
     *   content: '...'
     * }]
     *
     * Anthropic Output:
     * [{
     *   role: 'user',
     *   content: [{
     *     type: 'tool_result',
     *     tool_use_id: 'call_abc123',
     *     content: '...'
     *   }]
     * }]
     *
     * Responsibilities:
     * - Convert universal tool results to provider format
     * - Serialize results to string if needed
     * - Handle errors in tool results
     * - Return array of provider-specific messages
     */
    formatToolResults(toolResults) {
        throw new Error('formatToolResults() must be implemented');
    }

    /**
     * (Optional) Get context window percentage used
     * Useful for Memory Agent to manage token budgets
     *
     * @param {array} messages - Chat messages to estimate
     * @returns {number} Estimated token count
     *
     * Note: This is an approximation. Providers may estimate differently.
     * OpenAI provides actual usage in responses.
     */
    estimateTokens(messages) {
        // Optional: can be overridden
        // Rough estimate: ~1.3 tokens per word
        const text = messages.map(m => m.content).join(' ');
        return Math.ceil(text.split(/\s+/).length * 1.3);
    }
}

/**
 * Test that a provider adapter implements the interface correctly
 * @param {ProviderAdapter} adapter - Adapter instance
 * @throws {Error} If adapter doesn't implement required methods
 */
export function validateProviderAdapter(adapter) {
    const required = [
        'name',
        'capabilities',
        'convertTools',
        'parseToolCalls',
        'complete',
        'streamComplete',
        'formatToolResults'
    ];

    for (const method of required) {
        if (!(method in adapter)) {
            throw new Error(`Provider adapter missing required: ${method}`);
        }
    }

    if (typeof adapter.convertTools !== 'function') {
        throw new Error('convertTools must be a function');
    }
    if (typeof adapter.parseToolCalls !== 'function') {
        throw new Error('parseToolCalls must be a function');
    }
    if (typeof adapter.complete !== 'function') {
        throw new Error('complete must be a function');
    }
    if (typeof adapter.streamComplete !== 'function') {
        throw new Error('streamComplete must be a function');
    }
    if (typeof adapter.formatToolResults !== 'function') {
        throw new Error('formatToolResults must be a function');
    }
}
