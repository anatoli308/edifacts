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

// TODO: Implement Anthropic adapter
