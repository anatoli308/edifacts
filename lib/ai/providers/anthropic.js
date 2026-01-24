/**
 * Anthropic Provider Adapter
 * ==========================
 * Purpose: Translate universal agent interface to Anthropic Claude API format.
 *
 * Responsibilities:
 * - Convert UniversalTool schema to Anthropic `tools[]` format
 * - Convert UniversalToolCall to Anthropic `tool_use` block format
 * - Map Anthropic `tool_result` blocks to universal tool results
 * - Handle Anthropic's tool calling semantics (different from OpenAI)
 * - Support streaming responses
 * - Parse tool calls from content blocks
 * - Manage Anthropic's message format (role, content[])
 *
 * Key Differences from OpenAI:
 * - Tool calls are content blocks, not separate message field
 * - Tool results are user-role messages with tool_result content block
 * - Streaming uses event-based format (different deltas)
 * - No parallel tool calls (sequential only)
 *
 * Key Mappings:
 * Universal → Anthropic:
 * - UniversalTool.inputSchema → tools[].input_schema (JSON schema)
 * - UniversalToolCall → content: [{ type: "tool_use", id, name, input }]
 * - Tool result → message { role: "user", content: [{ type: "tool_result", tool_use_id, content }] }
 *
 * Inputs:
 * - Universal tool definitions
 * - User messages
 * - System prompt
 * - Model config (model name, max_tokens)
 *
 * Outputs:
 * - Anthropic-formatted API request
 * - LLM response (parsed from streaming)
 * - Tool calls extracted and validated
 *
 * Streaming:
 * - Event-based streaming (different from OpenAI)
 * - Content block deltas accumulated
 * - Tool use blocks extracted and validated
 *
 * Limitations:
 * - No parallel tool calls (must execute sequentially)
 * - Slightly different tool schema format
 * - Handled gracefully by Executor Agent
 *
 * Implementation Notes:
 * - Stateless adapter: pure request/response translation
 * - Differences isolated here, agents remain unchanged
 * - Test with mock Anthropic responses
 *
 * Supported Models:
 * - claude-3-opus
 * - claude-3-sonnet
 * - claude-3-haiku
 * (See ANTHROPIC_MODELS config)
 */

import Anthropic from '@anthropic-ai/sdk';

export class AnthropicAdapter {
    /**
     * @param {Object} config - Provider configuration
     * @param {string} config.apiKey - Anthropic API key
     * @param {string} config.model - Model name (default: 'claude-3-5-sonnet-20241022')
     * @param {number} config.temperature - Temperature (0-1, default: 0.7)
     * @param {number} config.maxTokens - Max tokens (default: 4096)
     */
    constructor(config) {
        this.config = {
            model: 'claude-3-5-sonnet-20241022',
            temperature: 0.7,
            maxTokens: 4096,
            ...config
        };
        
        this.client = new Anthropic({
            apiKey: this.config.apiKey,
        });
        
        this.name = 'anthropic';
        this.capabilities = {
            parallel_tool_calls: false, // Anthropic executes tools sequentially
            streaming: true,
            vision: this.config.model.includes('claude-3'),
            context_window: this._getContextWindow(this.config.model)
        };
    }
    
    /**
     * Get context window size for model
     * @private
     */
    _getContextWindow(model) {
        if (model.includes('claude-3')) return 200000;
        if (model.includes('claude-2')) return 100000;
        return 100000;
    }
    
    /**
     * Convert UniversalTool to Anthropic tools[] format
     * @param {Array} tools - Universal tool definitions
     * @returns {Array} Anthropic tools format
     */
    convertTools(tools) {
        if (!tools || tools.length === 0) return undefined;
        
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema
        }));
    }
    
    /**
     * Parse tool calls from Anthropic content blocks
     * @param {Array} content - Anthropic content blocks
     * @returns {Array} Universal tool calls
     */
    parseToolCalls(content) {
        if (!content || !Array.isArray(content)) return [];
        
        return content
            .filter(block => block.type === 'tool_use')
            .map(block => ({
                id: block.id,
                tool: block.name,
                arguments: block.input
            }));
    }
    
    /**
     * Extract system prompt from messages
     * Anthropic requires system as separate parameter
     * @param {Array} messages - Chat messages
     * @returns {Object} { system, messages }
     */
    extractSystem(messages) {
        const systemMessages = messages.filter(m => m.role === 'system');
        const otherMessages = messages.filter(m => m.role !== 'system');
        
        const system = systemMessages.length > 0 
            ? systemMessages.map(m => m.content).join('\n\n')
            : undefined;
        
        return { system, messages: otherMessages };
    }
    
    /**
     * Complete (non-streaming)
     * @param {Object} params
     * @param {Array} params.messages - Chat messages
     * @param {Array} params.tools - Universal tool definitions
     * @param {Object} params.options - Additional options
     * @returns {Promise<Object>} Response with content and tool calls
     */
    async complete({ messages, tools, options = {} }) {
        try {
            const { system, messages: cleanMessages } = this.extractSystem(messages);
            
            const response = await this.client.messages.create({
                model: this.config.model,
                max_tokens: options.maxTokens ?? this.config.maxTokens,
                temperature: options.temperature ?? this.config.temperature,
                system,
                messages: cleanMessages,
                tools: this.convertTools(tools),
            });
            
            // Extract text content
            const textContent = response.content
                .filter(block => block.type === 'text')
                .map(block => block.text)
                .join('');
            
            return {
                content: textContent,
                toolCalls: this.parseToolCalls(response.content),
                finishReason: response.stop_reason,
                usage: response.usage
            };
        } catch (error) {
            console.error('[AnthropicAdapter] Complete error:', error);
            throw new Error(`Anthropic API error: ${error.message}`);
        }
    }
    
    /**
     * Complete with streaming
     * @param {Object} params
     * @param {Array} params.messages - Chat messages
     * @param {Array} params.tools - Universal tool definitions
     * @param {Object} params.options - Additional options
     * @returns {AsyncGenerator} Stream of response chunks
     */
    async *streamComplete({ messages, tools, options = {} }) {
        try {
            const { system, messages: cleanMessages } = this.extractSystem(messages);
            
            const stream = await this.client.messages.create({
                model: this.config.model,
                max_tokens: options.maxTokens ?? this.config.maxTokens,
                temperature: options.temperature ?? this.config.temperature,
                system,
                messages: cleanMessages,
                tools: this.convertTools(tools),
                stream: true,
            });
            
            let accumulatedContent = '';
            let accumulatedToolCalls = [];
            let currentToolUse = null;
            
            for await (const event of stream) {
                if (event.type === 'content_block_start') {
                    if (event.content_block.type === 'tool_use') {
                        currentToolUse = {
                            id: event.content_block.id,
                            name: event.content_block.name,
                            input: ''
                        };
                    }
                }
                
                if (event.type === 'content_block_delta') {
                    if (event.delta.type === 'text_delta') {
                        accumulatedContent += event.delta.text;
                        yield {
                            type: 'content_delta',
                            content: event.delta.text
                        };
                    }
                    
                    if (event.delta.type === 'input_json_delta' && currentToolUse) {
                        currentToolUse.input += event.delta.partial_json;
                    }
                }
                
                if (event.type === 'content_block_stop') {
                    if (currentToolUse) {
                        try {
                            currentToolUse.input = JSON.parse(currentToolUse.input);
                            accumulatedToolCalls.push(currentToolUse);
                        } catch (error) {
                            console.error('[AnthropicAdapter] Failed to parse tool input:', error);
                        }
                        currentToolUse = null;
                    }
                }
                
                if (event.type === 'message_stop') {
                    yield {
                        type: 'complete',
                        content: accumulatedContent,
                        toolCalls: accumulatedToolCalls.map(tc => ({
                            id: tc.id,
                            tool: tc.name,
                            arguments: tc.input
                        })),
                        finishReason: 'end_turn'
                    };
                }
            }
            
        } catch (error) {
            console.error('[AnthropicAdapter] Stream error:', error);
            throw new Error(`Anthropic streaming error: ${error.message}`);
        }
    }
    
    /**
     * Format tool results as Anthropic messages
     * @param {Array} toolResults - Tool execution results
     * @returns {Object} Anthropic tool result message
     */
    formatToolResults(toolResults) {
        return {
            role: 'user',
            content: toolResults.map(result => ({
                type: 'tool_result',
                tool_use_id: result.id,
                content: typeof result.result === 'string'
                    ? result.result
                    : JSON.stringify(result.result)
            }))
        };
    }
}
