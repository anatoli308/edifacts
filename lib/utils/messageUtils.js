/**
 * Message Utilities für Agent-Handler
 * ====================================
 * Hilfsfunktionen für Message-Preparation und Context-Building
 */

/**
 * Filter conversation messages for LLM context
 * Removes tool-related messages and keeps only last N conversation turns
 * 
 * @param {Array} messages - Full message history
 * @param {number} maxMessages - Maximum messages to keep 
 * @returns {Array} Filtered messages suitable for LLM context
 */
function _filterContextMessages(messages, maxMessages) {
  if (!messages || !Array.isArray(messages)) return [];

  // Filter: keep user messages and assistant messages (exclude tool-only messages)
  const filtered = messages.filter(m => {
    if (m.role === 'user') return true;
    if (m.role === 'assistant' && m.content) {
      // Include assistant messages that have text content (not just tool calls)
      return typeof m.content === 'string' || (m.content.text && m.content.text.trim());
    }
    return false;
  });

  // Keep only last N messages to avoid context explosion
  return filtered.slice(-maxMessages);
}

/**
 * Bereite Conversationsmessages für Agent vor
 * 
 * @param {Array} messages - Chat history
 * @param {number} maxMessages - Max messages to keep
 * @returns {Array} Prepared messages
 */
export function prepareConversation(messages, maxMessages = 5) {
  if (messages && Array.isArray(messages) && messages.length > 0) {
    // Filter messages to avoid token explosion (max 5 turns, frontend sends full history)
    const conversationMessages = _filterContextMessages(messages, maxMessages);
    console.log(
      `[Agent Handler] Final message count for agent: ${conversationMessages.length} (max 5, excluding tool-only)`
    );
    return conversationMessages;
  }
  return [];
}
