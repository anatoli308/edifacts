/**
 * Universal Tool Contract
 * =======================
 * Standard data format for tools across all providers and agents.
 *
 * Purpose:
 * - Define the universal format that all tools MUST follow
 * - Enable tools to work with any LLM provider (OpenAI, Anthropic, vLLM, etc)
 * - Ensure consistent tool calling across all agents (Router, Planner, Executor, etc)
 * - Provide schema validation and documentation
 *
 * This contract defines THREE primary data structures:
 * 1. UniversalTool - Tool definition (name, description, schema)
 * 2. UniversalToolCall - Tool invocation (which tool, with what args)
 * 3. ToolResult - Tool execution outcome (success, result, error)
 *
 * Flow:
 * ┌──────────────────────┐
 * │  UniversalTool[]     │  Tool registry defines what tools exist
 * │ (e.g., EDIFACT tools)│
 * └──────────┬───────────┘
 *            │
 *            ▼
 * ┌──────────────────────┐
 * │  Agent receives      │
 * │  tools to call       │
 * └──────────┬───────────┘
 *            │
 *            ▼
 * ┌──────────────────────┐
 * │  Provider Adapter    │  Converts tools to provider format
 * │  convertTools()      │  (OpenAI format, Anthropic format, etc)
 * └──────────┬───────────┘
 *            │
 *            ▼
 * ┌──────────────────────┐
 * │  LLM API call        │
 * │  (OpenAI, Anthropic) │
 * └──────────┬───────────┘
 *            │
 *            ▼
 * ┌──────────────────────────────┐
 * │  LLM returns tool_calls      │
 * │  in provider-specific format │
 * └──────────┬────────────────────┘
 *            │
 *            ▼
 * ┌──────────────────────────────┐
 * │  Provider Adapter            │  Converts response to universal
 * │  parseToolCalls()            │  tool calls
 * └──────────┬────────────────────┘
 *            │
 *            ▼
 * ┌──────────────────────┐
 * │  UniversalToolCall[] │  Now we have standardized tool calls
 * │ (e.g., {            │
 * │   id: 'call_123',    │
 * │   tool: 'validate',  │
 * │   arguments: {...}   │
 * │ })                   │
 * └──────────┬───────────┘
 *            │
 *            ▼
 * ┌──────────────────────┐
 * │  Executor Agent      │
 * │  executes tool()     │
 * │  from tool registry  │
 * └──────────┬───────────┘
 *            │
 *            ▼
 * ┌──────────────────────┐
 * │  ToolResult          │
 * │ (success, result)    │
 * └──────────┬───────────┘
 *            │
 *            ▼
 * ┌──────────────────────────────┐
 * │  Provider Adapter            │  Converts results back to
 * │  formatToolResults()         │  provider message format
 * └──────────┬────────────────────┘
 *            │
 *            ▼
 * ┌──────────────────────┐
 * │  LLM API call        │
 * │  (with tool results) │
 * └──────────────────────┘
 */

/**
 * UniversalTool
 * ==============
 * Defines a tool that an agent can call.
 *
 * @typedef {object} UniversalTool
 * @property {string} name - Tool identifier (lowercase, alphanumeric, underscores)
 *           Examples: 'analyze_segment', 'validate_rule', 'parse_document'
 * @property {string} description - Human-readable description of what tool does
 *           Should explain: what it does, when to use, typical inputs
 * @property {object} inputSchema - JSON Schema describing tool inputs
 *           Must be a valid JSON Schema (type, properties, required, etc)
 *           Type must be 'object'
 * @property {object} [meta] - Optional metadata
 * @property {string} meta.category - Category (e.g., 'validation', 'analysis', 'parsing')
 * @property {string} meta.version - Tool version (e.g., '1.0.0')
 * @property {string[]} meta.tags - Search tags (e.g., ['edifact', 'segment'])
 * @property {number} meta.avgExecutionMs - Typical execution time in ms
 *
 * @example
 * {
 *   name: 'analyze_segment',
 *   description: 'Analyze an EDIFACT segment for structure and validity',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       segment_id: {
 *         type: 'string',
 *         description: 'Segment identifier (e.g., UNH, BGM)'
 *       },
 *       segment_data: {
 *         type: 'string',
 *         description: 'Full segment line'
 *       }
 *     },
 *     required: ['segment_id', 'segment_data']
 *   },
 *   meta: {
 *     category: 'analysis',
 *     version: '1.0.0',
 *     tags: ['edifact', 'segment', 'analysis'],
 *     avgExecutionMs: 50
 *   }
 * }
 */
export const UniversalToolExample = {
    name: 'analyze_segment',
    description: 'Analyze an EDIFACT segment for structure and validity',
    inputSchema: {
        type: 'object',
        properties: {
            segment_id: {
                type: 'string',
                description: 'Segment identifier (e.g., UNH, BGM)'
            },
            segment_data: {
                type: 'string',
                description: 'Full segment line'
            }
        },
        required: ['segment_id', 'segment_data']
    },
    meta: {
        category: 'analysis',
        version: '1.0.0',
        tags: ['edifact', 'segment', 'analysis'],
        avgExecutionMs: 50
    }
};

/**
 * UniversalToolCall
 * =================
 * Represents a call to execute a tool.
 * Generated by LLM via provider adapter.
 *
 * @typedef {object} UniversalToolCall
 * @property {string} id - Unique call identifier
 *           Format: 'call_' + unique suffix (e.g., 'call_abc123')
 *           Used to match tool results back to tool calls
 * @property {string} tool - Name of the tool to call
 *           Must match a tool name in the tool registry
 * @property {object} arguments - Arguments to pass to the tool
 *           Keys/values must match inputSchema requirements
 * @property {number} [timestamp] - When tool call was generated (optional)
 * @property {number} [index] - Order in batch (optional, if multiple calls)
 *
 * @example
 * {
 *   id: 'call_abc123',
 *   tool: 'analyze_segment',
 *   arguments: {
 *     segment_id: 'UNH',
 *     segment_data: "UNH+C+ORDERS'D+970501+109"
 *   },
 *   timestamp: 1704067200000,
 *   index: 0
 * }
 */
export const UniversalToolCallExample = {
    id: 'call_abc123',
    tool: 'analyze_segment',
    arguments: {
        segment_id: 'UNH',
        segment_data: "UNH+C+ORDERS'D+970501+109"
    },
    timestamp: 1704067200000,
    index: 0
};

/**
 * ToolResult
 * ==========
 * Result of executing a tool.
 *
 * @typedef {object} ToolResult
 * @property {string} id - Matches toolCall.id for result matching
 * @property {string} tool - Name of the tool that was called
 * @property {*} result - Tool execution result (any JSON-serializable type)
 *           Could be: string, object, array, number, boolean
 *           Shape depends on the specific tool
 * @property {boolean} success - Whether tool execution succeeded
 * @property {number} duration_ms - Execution time in milliseconds
 * @property {string} [error] - Error message if success=false
 * @property {number} [timestamp] - When result was generated
 *
 * @example
 * {
 *   id: 'call_abc123',
 *   tool: 'analyze_segment',
 *   result: {
 *     segment_id: 'UNH',
 *     valid: true,
 *     fields: 3,
 *     issues: []
 *   },
 *   success: true,
 *   duration_ms: 45,
 *   timestamp: 1704067200045
 * }
 *
 * @example - Error case
 * {
 *   id: 'call_xyz789',
 *   tool: 'validate_rule',
 *   result: null,
 *   success: false,
 *   error: 'Rule engine timeout after 5s',
 *   duration_ms: 5000,
 *   timestamp: 1704067205000
 * }
 */
export const ToolResultExample = {
    id: 'call_abc123',
    tool: 'analyze_segment',
    result: {
        segment_id: 'UNH',
        valid: true,
        fields: 3,
        issues: []
    },
    success: true,
    duration_ms: 45,
    timestamp: 1704067200045
};

/**
 * Tool Execution Context
 * =====================
 * Context passed to tool execution function.
 *
 * @typedef {object} ToolExecutionContext
 * @property {object} sessionId - Chat session ID
 * @property {object} userId - User ID executing the tool
 * @property {object} domain - Domain context (e.g., EDIFACT analysis data)
 * @property {object} previousResults - Results from previous tool calls
 * @property {object} logger - Logger instance
 * @property {object} cache - Cache for tool results (optional)
 *
 * @example
 * {
 *   sessionId: '507f1f77bcf86cd799439011',
 *   userId: '507f1f77bcf86cd799439010',
 *   domain: {
 *     type: 'edifact',
 *     file: { id, name, size },
 *     analysis: { segments: [...], errors: [...] }
 *   },
 *   previousResults: [
 *     { id: 'call_123', result: {...} }
 *   ],
 *   logger: logger,
 *   cache: {}
 * }
 */
export const ToolExecutionContextExample = {
    sessionId: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439010',
    domain: {
        type: 'edifact',
        file: { id: 'file_123', name: 'invoice.txt', size: 2048 },
        analysis: { segments: [], errors: [] }
    },
    previousResults: [],
    logger: {},
    cache: {}
};

/**
 * Tool Execution Function Signature
 * ==================================
 * Every tool must have this function signature.
 *
 * @typedef {function} ToolExecutionFunction
 * @param {object} input - Arguments from UniversalToolCall
 * @param {ToolExecutionContext} context - Execution context
 * @returns {promise<*>} Tool result (any JSON-serializable type)
 * @throws {Error} If tool execution fails (caught and wrapped in ToolResult)
 *
 * @example
 * export async function analyzeSegment(input, context) {
 *   const { segment_id, segment_data } = input;
 *
 *   if (!segment_data) {
 *     throw new Error('segment_data required');
 *   }
 *
 *   const result = {
 *     segment_id,
 *     valid: validateSegment(segment_data),
 *     fields: segment_data.split('+').length
 *   };
 *
 *   return result;
 * }
 */

/**
 * Tool Registry Format
 * ====================
 * How tools are registered and stored.
 *
 * @typedef {object} ToolRegistry
 * @property {string} namespace - Domain namespace (e.g., 'edifact')
 * @property {object} tools - Map of tool name → tool definition + function
 *
 * @example
 * {
 *   namespace: 'edifact',
 *   tools: {
 *     analyze_segment: {
 *       definition: UniversalTool,
 *       execute: analyzeSegmentFunction
 *     },
 *     validate_rule: {
 *       definition: UniversalTool,
 *       execute: validateRuleFunction
 *     }
 *   }
 * }
 */

/**
 * Schema Validation Rules for Universal Contracts
 * ================================================
 * Tools must follow these rules.
 */
export const UniversalToolValidationRules = {
    // Tool name rules
    name: {
        type: 'string',
        pattern: /^[a-z0-9_]+$/, // lowercase, digits, underscores
        minLength: 3,
        maxLength: 50,
        description: 'Tool name must be lowercase alphanumeric with underscores'
    },

    // Tool description rules
    description: {
        type: 'string',
        minLength: 10,
        maxLength: 500,
        description: 'Tool description must be 10-500 characters'
    },

    // Input schema rules
    inputSchema: {
        type: 'object',
        required: true,
        schema: {
            type: 'object',
            properties: {
                type: {
                    const: 'object',
                    description: 'Must be object type (not array, string, etc)'
                },
                properties: {
                    type: 'object',
                    description: 'Define all input parameters'
                },
                required: {
                    type: 'array',
                    description: 'List required parameters'
                }
            },
            required: ['type', 'properties']
        }
    },

    // Tool call rules
    toolCall: {
        id: {
            type: 'string',
            pattern: /^call_[a-zA-Z0-9_]+$/,
            description: 'Must start with call_'
        },
        tool: {
            type: 'string',
            pattern: /^[a-z0-9_]+$/,
            description: 'Must be valid tool name'
        },
        arguments: {
            type: 'object',
            description: 'Must be object, not array or primitive'
        }
    },

    // Tool result rules
    toolResult: {
        id: {
            type: 'string',
            description: 'Must match original toolCall.id'
        },
        tool: {
            type: 'string',
            description: 'Must match original toolCall.tool'
        },
        success: {
            type: 'boolean',
            description: 'Must be true or false'
        },
        duration_ms: {
            type: 'number',
            minimum: 0,
            description: 'Must be >= 0'
        }
    }
};
