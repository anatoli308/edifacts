/**
 * Agent API Logging & Audit
 * ==========================
 * Purpose: Comprehensive logging for agent invocations.
 *
 * Logs:
 * - Agent name and parameters
 * - User and context information
 * - Execution duration and performance metrics
 * - Tool calls and results
 * - Errors and failures
 *
 * GDPR/Security:
 * - Redact API keys and sensitive data
 * - Allow user data deletion
 * - Audit trail for compliance
 */

/**
 * Log agent invocation
 */
export const logAgentInvocation = async (userId, agentName, context, result, duration_ms) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    agentName,
    context: redactContext(context),
    resultSummary: summarizeResult(result),
    duration_ms,
    success: result.success !== false,
  };

  // TODO: Persist to MongoDB or external logging service
  console.log('[Agent Invocation]', logEntry);
};

/**
 * Log tool execution
 */
export const logToolExecution = async (userId, toolName, args, result, duration_ms) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    toolName,
    argsChecksum: hashArgs(args), // Hash instead of storing args
    resultSummary: summarizeResult(result),
    duration_ms,
    success: result.success !== false,
  };

  // TODO: Persist to MongoDB
  console.log('[Tool Execution]', logEntry);
};

/**
 * Log error
 */
export const logError = async (userId, agentName, error, context) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    agentName,
    error: error.message,
    errorCode: error.code || 'UNKNOWN',
    context: redactContext(context),
    stack: error.stack,
  };

  // TODO: Persist to MongoDB and alerting system
  console.error('[Agent Error]', logEntry);
};

/**
 * Redact sensitive data from context
 * GDPR: Don't store API keys, passwords, etc.
 */
const redactContext = (context) => {
  if (!context) return null;

  const redacted = { ...context };

  // Remove sensitive fields
  delete redacted.apiKey;
  delete redacted.password;
  delete redacted.token;
  delete redacted.secret;

  return redacted;
};

/**
 * Summarize result for logging
 * Don't store full results (too much data)
 */
const summarizeResult = (result) => {
  if (!result) return null;

  return {
    type: typeof result,
    hasAgentPlan: !!result.agentPlan,
    hasToolCalls: !!result.toolCalls,
    toolCallCount: result.toolCalls?.length || 0,
    hasError: !!result.error,
  };
};

/**
 * Hash arguments for logging
 * Store hash instead of actual args to save space
 */
const hashArgs = (args) => {
  // TODO: Implement hash (sha256)
  return 'hash_' + JSON.stringify(args).length;
};

/**
 * Get audit log for user
 */
export const getUserAuditLog = async (userId, limit = 100) => {
  // TODO: Query from MongoDB
  // const logs = await db.collection('agentLogs')
  //   .find({ userId })
  //   .sort({ timestamp: -1 })
  //   .limit(limit)
  //   .toArray();
  // return logs;
};

/**
 * Delete audit log for user (GDPR right to be forgotten)
 */
export const deleteUserAuditLog = async (userId) => {
  // TODO: Delete from MongoDB
  // await db.collection('agentLogs').deleteMany({ userId });
};

export default {
  logAgentInvocation,
  logToolExecution,
  logError,
  getUserAuditLog,
  deleteUserAuditLog,
};
