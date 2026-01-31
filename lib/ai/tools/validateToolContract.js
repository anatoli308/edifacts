/**
 * Universal Tool Contract Validation Utilities
 * ============================================
 * Validate that tools follow the universal contract.
 *
 * Purpose:
 * - Ensure tools conform to universal format
 * - Validate tool definitions before registration
 * - Validate tool calls before execution
 * - Validate tool results before returning to caller
 * - Provide clear error messages for debugging
 *
 * Usage:
 * import {
 *   validateToolDefinition,
 *   validateToolCall,
 *   validateToolResult
 * } from 'lib/ai/tools/validateToolContract.js';
 *
 * // At tool registration time
 * validateToolDefinition(myTool);
 *
 * // Before executing tool
 * validateToolCall(toolCall);
 *
 * // After tool execution
 * validateToolResult(result);
 */

/**
 * Validate a tool definition
 *
 * @param {object} tool - Tool definition to validate
 * @param {string} tool.name - Tool name
 * @param {string} tool.description - Tool description
 * @param {object} tool.inputSchema - JSON Schema
 * @returns {object} { valid: boolean, errors: string[] }
 * @throws {Error} If tool is fundamentally invalid
 *
 * Checks:
 * - name: required, lowercase, alphanumeric + underscores, 3-50 chars
 * - description: required, string, 10-500 chars
 * - inputSchema: required, must be valid JSON Schema with type='object'
 *
 * @example
 * const { valid, errors } = validateToolDefinition({
 *   name: 'analyze_segment',
 *   description: 'Analyze segment',
 *   inputSchema: { type: 'object', properties: {...} }
 * });
 *
 * if (!valid) {
 *   console.error('Invalid tool:', errors);
 * }
 */
export function validateToolDefinition(tool) {
    const errors = [];

    // Check tool object exists
    if (!tool || typeof tool !== 'object') {
        throw new Error('Tool must be an object');
    }

    // Validate name
    if (!tool.name) {
        errors.push('name is required');
    } else if (typeof tool.name !== 'string') {
        errors.push('name must be string');
    } else if (!/^[a-z][a-zA-Z0-9_]+$/.test(tool.name)) {
        errors.push('name must start lowercase and contain only letters, numbers, or underscores');
    } else if (tool.name.length < 3 || tool.name.length > 50) {
        errors.push('name must be 3-50 characters');
    }

    // Validate description
    if (!tool.description) {
        errors.push('description is required');
    } else if (typeof tool.description !== 'string') {
        errors.push('description must be string');
    } else if (tool.description.length < 10 || tool.description.length > 500) {
        errors.push('description must be 10-500 characters');
    }

    // Validate inputSchema
    if (!tool.inputSchema) {
        errors.push('inputSchema is required');
    } else if (typeof tool.inputSchema !== 'object') {
        errors.push('inputSchema must be object');
    } else {
        const schemaErrors = validateJSONSchema(tool.inputSchema);
        errors.push(...schemaErrors);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate a tool call
 *
 * @param {object} call - Tool call to validate
 * @param {string} call.id - Call ID
 * @param {string} call.tool - Tool name
 * @param {object} call.arguments - Tool arguments
 * @returns {object} { valid: boolean, errors: string[] }
 *
 * Checks:
 * - id: required, must start with 'call_'
 * - tool: required, lowercase alphanumeric + underscores
 * - arguments: required, must be object
 *
 * @example
 * const { valid, errors } = validateToolCall({
 *   id: 'call_abc123',
 *   tool: 'analyze_segment',
 *   arguments: { segment_id: 'UNH' }
 * });
 *
 * if (!valid) {
 *   console.error('Invalid tool call:', errors);
 * }
 */
export function validateToolCall(call) {
    const errors = [];

    // Check call object exists
    if (!call || typeof call !== 'object') {
        throw new Error('Tool call must be an object');
    }

    // Validate id
    if (!call.id) {
        errors.push('id is required');
    } else if (typeof call.id !== 'string') {
        errors.push('id must be string');
    } else if (!/^call_[a-zA-Z0-9_]+$/.test(call.id)) {
        errors.push('id must start with call_ followed by alphanumeric');
    }

    // Validate tool
    if (!call.tool) {
        errors.push('tool is required');
    } else if (typeof call.tool !== 'string') {
        errors.push('tool must be string');
    } else if (!/^[a-z][a-zA-Z0-9_]+$/.test(call.tool)) {
        errors.push('tool must start lowercase and contain only letters, numbers, or underscores');
    }

    // Validate arguments
    if (!('arguments' in call)) {
        errors.push('arguments is required');
    } else if (typeof call.arguments !== 'object' || Array.isArray(call.arguments)) {
        errors.push('arguments must be object (not array or primitive)');
    } else if (call.arguments === null) {
        errors.push('arguments cannot be null');
    }

    // Optional: validate timestamp if present
    if (call.timestamp !== undefined) {
        if (typeof call.timestamp !== 'number' || call.timestamp < 0) {
            errors.push('timestamp must be positive number');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate a tool result
 *
 * @param {object} result - Tool result to validate
 * @param {string} result.id - Result ID (must match tool call)
 * @param {string} result.tool - Tool name
 * @param {*} result.result - Tool execution result
 * @param {boolean} result.success - Success flag
 * @param {number} result.duration_ms - Execution time
 * @param {string} [result.error] - Error message (if success=false)
 * @returns {object} { valid: boolean, errors: string[] }
 *
 * Checks:
 * - id: required, must start with 'call_'
 * - tool: required, valid tool name format
 * - success: required, must be boolean
 * - duration_ms: required, must be >= 0
 * - error: if success=false, error message should be present
 * - result: JSON-serializable if success=true
 *
 * @example
 * const { valid, errors } = validateToolResult({
 *   id: 'call_abc123',
 *   tool: 'analyze_segment',
 *   result: { valid: true },
 *   success: true,
 *   duration_ms: 45
 * });
 *
 * if (!valid) {
 *   console.error('Invalid tool result:', errors);
 * }
 */
export function validateToolResult(result) {
    const errors = [];

    // Check result object exists
    if (!result || typeof result !== 'object') {
        throw new Error('Tool result must be an object');
    }

    // Validate id
    if (!result.id) {
        errors.push('id is required');
    } else if (typeof result.id !== 'string') {
        errors.push('id must be string');
    } else if (!/^call_[a-zA-Z0-9_]+$/.test(result.id)) {
        errors.push('id must start with call_');
    }

    // Validate tool
    if (!result.tool) {
        errors.push('tool is required');
    } else if (typeof result.tool !== 'string') {
        errors.push('tool must be string');
    }

    // Validate success
    if (result.success === undefined) {
        errors.push('success is required');
    } else if (typeof result.success !== 'boolean') {
        errors.push('success must be boolean');
    }

    // Validate duration_ms
    if (result.duration_ms === undefined) {
        errors.push('duration_ms is required');
    } else if (typeof result.duration_ms !== 'number') {
        errors.push('duration_ms must be number');
    } else if (result.duration_ms < 0) {
        errors.push('duration_ms must be >= 0');
    }

    // Validate error message
    if (result.success === false && !result.error) {
        errors.push('error message required when success=false');
    }
    if (result.error && typeof result.error !== 'string') {
        errors.push('error must be string');
    }

    // Validate result is JSON-serializable
    if (result.success === true) {
        try {
            JSON.stringify(result.result);
        } catch (e) {
            errors.push(`result is not JSON-serializable: ${e.message}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate JSON Schema structure
 *
 * @private
 * @param {object} schema - JSON Schema to validate
 * @returns {string[]} Array of error messages
 */
function validateJSONSchema(schema) {
    const errors = [];

    if (typeof schema !== 'object' || schema === null) {
        errors.push('inputSchema must be an object');
        return errors;
    }

    // Must have type property
    if (!('type' in schema)) {
        errors.push('inputSchema must have type property');
    } else if (schema.type !== 'object') {
        errors.push('inputSchema type must be "object" (not array, string, etc)');
    }

    // Should have properties if type=object
    if (schema.type === 'object' && !schema.properties) {
        errors.push('inputSchema with type=object should have properties');
    }

    // If has properties, should be object
    if (schema.properties && typeof schema.properties !== 'object') {
        errors.push('inputSchema.properties must be object');
    }

    // If has required, should be array of strings
    if (schema.required && !Array.isArray(schema.required)) {
        errors.push('inputSchema.required must be array');
    }

    return errors;
}

/**
 * Validate tool arguments against schema
 *
 * @param {object} arguments - Arguments to validate
 * @param {object} schema - inputSchema from tool definition
 * @returns {object} { valid: boolean, errors: string[] }
 *
 * Checks:
 * - All required fields present
 * - No extra fields (optional, can be strict or lenient)
 * - Field types match schema (basic check)
 *
 * Note: This is a basic validation. For production, use AJV or similar.
 *
 * @example
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     segment_id: { type: 'string' },
 *     count: { type: 'number' }
 *   },
 *   required: ['segment_id']
 * };
 *
 * const { valid, errors } = validateToolArguments(
 *   { segment_id: 'UNH' },
 *   schema
 * );
 */
export function validateToolArguments(arguments_, schema) {
    const errors = [];

    if (typeof arguments_ !== 'object' || arguments_ === null) {
        return {
            valid: false,
            errors: ['arguments must be object']
        };
    }

    if (!schema || typeof schema !== 'object') {
        return {
            valid: false,
            errors: ['schema must be object']
        };
    }

    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
        for (const field of schema.required) {
            if (!(field in arguments_)) {
                errors.push(`required field missing: ${field}`);
            }
        }
    }

    // Check field types (basic)
    if (schema.properties && typeof schema.properties === 'object') {
        for (const [field, fieldSchema] of Object.entries(schema.properties)) {
            if (field in arguments_) {
                const value = arguments_[field];
                if (fieldSchema.type) {
                    const actualType = Array.isArray(value) ? 'array' : typeof value;
                    if (actualType !== fieldSchema.type && value !== null) {
                        errors.push(
                            `field ${field}: expected ${fieldSchema.type}, got ${actualType}`
                        );
                    }
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate complete tool execution workflow
 * Useful for integration testing
 *
 * @param {object} tool - Tool definition
 * @param {object} call - Tool call
 * @param {object} result - Tool result
 * @returns {object} { valid: boolean, toolDefErrors: [], callErrors: [], resultErrors: [] }
 *
 * @example
 * const validation = validateCompleteToolWorkflow(tool, call, result);
 * if (!validation.valid) {
 *   console.error('Workflow invalid:', validation);
 * }
 */
export function validateCompleteToolWorkflow(tool, call, result) {
    const toolDefValidation = validateToolDefinition(tool);
    const callValidation = validateToolCall(call);
    const resultValidation = validateToolResult(result);

    // Additional cross-validations
    const crossErrors = [];
    if (call.tool !== tool.name) {
        crossErrors.push(`tool call references ${call.tool} but definition is ${tool.name}`);
    }
    if (result.tool !== call.tool) {
        crossErrors.push(`result references ${result.tool} but call is ${call.tool}`);
    }
    if (result.id !== call.id) {
        crossErrors.push(`result id ${result.id} doesn't match call id ${call.id}`);
    }

    return {
        valid: toolDefValidation.valid && 
               callValidation.valid && 
               resultValidation.valid &&
               crossErrors.length === 0,
        toolDefErrors: toolDefValidation.errors,
        callErrors: callValidation.errors,
        resultErrors: resultValidation.errors,
        crossErrors
    };
}
