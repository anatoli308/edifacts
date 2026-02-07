/**
 * Memory Agent (Context Management & Retrieval)
 * ===============================================
 * Status: 🚧 Planned (v1.x Late - Q2 2026)
 * Human Analog: Hippocampus (Short-term & Long-term Memory)
 * 
 * Purpose: Manage short-term and long-term agent memory for context-aware reasoning.
 * 
 * ⚠️ IMPORTANT: Memory Agent ≠ Learning Agent
 * - **Memory Agent:** Session-specific conversational context
 *   - "What did user say 5 minutes ago in THIS chat?"
 *   - "User prefers German explanations"
 *   - Scope: Single session/user
 * 
 * - **Learning Agent (v2.x):** Global problem-solving experience (RAG)
 *   - "How did we solve 'explain BGM' 100 times before?"
 *   - "Which tools work best for parsing?"
 *   - Scope: All sessions, all users, persistent
 *
 * Responsibilities:
 * - Store and retrieve conversational context (chat history).
 * - Manage short-term memory (current task, recent observations).
 * - Integrate long-term memory (vector DB, persisted chat state, user preferences).
 * - Provide LLM-friendly context window (summaries, excerpts).
 * - Support replay and debugging (restore agent state from history).
 * - Enforce privacy and data retention policies.
 *
 * Inputs:
 * - New message or observation to store
 * - Query (retrieve context for agent reasoning)
 * - Chat history (AnalysisMessage[])
 * - User preferences (retention policy, privacy settings)
 *
 * Outputs:
 * - Stored memory (persisted in DB)
 * - Retrieved context (for agent reasoning)
 * - Context summary (for LLM prompt assembly)
 * - Replay state (for debugging and compliance export)
 *
 * Memory Layers:
 * 1. Working Memory: Current task, recent observations (in-process)
 * 2. Episodic Memory: Chat history, agent decisions (MongoDB)
 * 3. Semantic Memory: Embeddings, entity relationships (optional: vector DB)
 * 4. User Preferences: Theme, retention policy, GDPR consent
 *
 * Implementation Notes:
 * - Chat history is immutable (append-only log).
 * - Summaries for long chats to fit LLM context window.
 * - Vector embeddings optional; start with text-based retrieval.
 * - GDPR: user can delete/export their memory.
 * - Data retention: configurable per user.
 * - Replay: full state serializable for debugging and audit.
 *
 * Privacy & Security:
 * - No sensitive data in embeddings (or redact before embedding).
 * - Respect user consent for long-term storage.
 * - Data residency: on-prem, managed, or air-gapped options.
 *
 * Provider-Agnostic: Memory is independent of LLM provider.
 */

/**
 * Memory Agent Configuration
 * - No LLM calls needed (pure retrieval)
 * - Fast memory access
 * - Configurable retention
 */
const MEMORY_CONFIG = {
    maxHistoryTokens: 8000, // Context window budget
    summaryThreshold: 3000, // Summarize when exceeds this
    retentionDays: 30, // Keep conversations for 30 days
    embeddingsEnabled: false, // Start without vector DB
    cacheEnabled: true, // Cache frequently accessed contexts
    //
    temperature: 0,
    maxRetries: 1,
    timeoutMs: 3000,
    contextWindowPercent: 0.7, // Use 70% of available tokens
};

export class Memory {
    constructor(config = {}) {
        this.config = {
            maxHistoryTokens: 8000,
            summaryThreshold: 3000,
            retentionDays: 30,
            embeddingsEnabled: false,
            cacheEnabled: true,
            maxContextRetrievalItems: 10,
            ...MEMORY_CONFIG,
            ...config
        };

        // Working memory (in-process)
        this.workingMemory = {
            currentTask: null,
            recentObservations: [],
            toolResults: []
        };

        // Cache for frequently accessed contexts
        this.contextCache = new Map();
    }

    /**
     * Store new message or observation in memory
     *
     * @param {object} params
     * @param {object} params.message - Message to store
     * @param {string} params.sessionId - Chat session ID
     * @param {object} params.metadata - Optional metadata (agentPlan, toolCalls, etc)
     * @returns {promise<object>} Stored memory entry
     */
    async store({ message, sessionId, metadata = {} }) {
        const startTime = Date.now();

        try {
            // Store message in working memory temporarily
            this.workingMemory.recentObservations.push({
                message,
                timestamp: new Date().toISOString(),
                metadata
            });

            // Keep only recent observations (last 10)
            if (this.workingMemory.recentObservations.length > 10) {
                this.workingMemory.recentObservations.shift();
            }

            // TODO: Persist to MongoDB (AnalysisMessage collection)
            // In real implementation, save message, metadata to DB

            return {
                success: true,
                stored: true,
                memoryType: 'episodic',
                sessionId,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime
            };
        } catch (error) {
            console.error('[Memory.store] Error:', error);
            return {
                success: false,
                error: error.message,
                duration_ms: Date.now() - startTime
            };
        }
    }

    /**
     * Retrieve context for agent reasoning (short-term or long-term)
     *
     * @param {object} params
     * @param {string} params.sessionId - Chat session ID
     * @param {number} params.limit - Max messages to retrieve
     * @param {string} params.query - Optional query for semantic search
     * @param {object} params.filters - Optional filters (role, type, etc)
     * @returns {promise<object>} Retrieved context
     */
    async retrieve({ sessionId, limit = 10, query, filters = {} }) {
        const startTime = Date.now();

        try {
            // Check cache first
            const cacheKey = `${sessionId}:${limit}:${query || ''}`;
            if (this.config.cacheEnabled && this.contextCache.has(cacheKey)) {
                console.log('[Memory] Cache hit for context retrieval');
                return {
                    success: true,
                    messages: this.contextCache.get(cacheKey),
                    source: 'cache',
                    duration_ms: Date.now() - startTime
                };
            }

            // Retrieve from working memory first
            let messages = [...this.workingMemory.recentObservations];

            // Apply filters
            if (filters.role) {
                messages = messages.filter(m => m.message?.role === filters.role);
            }
            if (filters.type) {
                messages = messages.filter(m => m.metadata?.type === filters.type);
            }

            // Limit results
            messages = messages.slice(-limit);

            // TODO: Retrieve from MongoDB if needed (for longer history)
            // In real implementation, query AnalysisMessage collection

            // Cache result
            if (this.config.cacheEnabled) {
                this.contextCache.set(cacheKey, messages);
                // Auto-expire cache after 5 minutes
                setTimeout(() => this.contextCache.delete(cacheKey), 5 * 60 * 1000);
            }

            return {
                success: true,
                messages,
                count: messages.length,
                source: 'working-memory',
                duration_ms: Date.now() - startTime
            };
        } catch (error) {
            console.error('[Memory.retrieve] Error:', error);
            return {
                success: false,
                error: error.message,
                messages: [],
                duration_ms: Date.now() - startTime
            };
        }
    }

    /**
     * Build LLM-friendly context summary from chat history
     * Summarizes long histories to fit context window
     *
     * @param {object} params
     * @param {array} params.messages - Full message history
     * @param {number} params.maxTokens - Max tokens for summary
     * @returns {promise<object>} Context summary
     */
    async buildContextSummary({ messages, maxTokens = 2000 }) {
        const startTime = Date.now();

        try {
            if (!messages || messages.length === 0) {
                return {
                    success: true,
                    summary: 'No chat history',
                    messageCount: 0,
                    tokenEstimate: 0,
                    duration_ms: Date.now() - startTime
                };
            }

            // Simple tokenization (estimate: ~4 chars per token)
            const estimateTokens = (text) => Math.ceil(text.length / 4);

            // Build summary: keep recent messages, summarize older ones
            const summary = {
                totalMessages: messages.length,
                recentMessages: [],
                summary: ''
            };

            let tokenCount = 0;

            // Add recent messages in reverse order (newest first)
            for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i];
                const msgTokens = estimateTokens(JSON.stringify(msg));

                if (tokenCount + msgTokens <= maxTokens * 0.8) {
                    summary.recentMessages.unshift(msg);
                    tokenCount += msgTokens;
                } else {
                    break;
                }
            }

            // Build summary of skipped messages
            const skippedCount = messages.length - summary.recentMessages.length;
            if (skippedCount > 0) {
                summary.summary = `[${skippedCount} earlier messages summarized: `;

                // Extract key intents from skipped messages
                const intents = messages
                    .slice(0, messages.length - summary.recentMessages.length)
                    .filter(m => m.metadata?.intent)
                    .map(m => m.metadata.intent);

                if (intents.length > 0) {
                    summary.summary += `Key intents: ${[...new Set(intents)].join(', ')}]`;
                } else {
                    summary.summary += 'General conversation]';
                }
            }

            return {
                success: true,
                summary,
                tokenEstimate: tokenCount,
                maxTokens,
                duration_ms: Date.now() - startTime
            };
        } catch (error) {
            console.error('[Memory.buildContextSummary] Error:', error);
            return {
                success: false,
                error: error.message,
                summary: { totalMessages: messages?.length || 0, recentMessages: [] },
                duration_ms: Date.now() - startTime
            };
        }
    }

    /**
     * Restore agent execution state (for replay/debugging)
     *
     * @param {object} params
     * @param {string} params.sessionId - Chat session ID
     * @param {number} params.messageIndex - Message index to restore to
     * @returns {promise<object>} Restored state
     */
    async restoreState({ sessionId, messageIndex }) {
        const startTime = Date.now();

        try {
            // TODO: Retrieve messages up to messageIndex from DB
            // Reconstruct agent state from message metadata (agentPlan, toolCalls, etc)

            return {
                success: true,
                restored: true,
                sessionId,
                messageIndex,
                state: {
                    messages: [],
                    agentPlan: null,
                    toolCalls: [],
                    toolResults: []
                },
                duration_ms: Date.now() - startTime
            };
        } catch (error) {
            console.error('[Memory.restoreState] Error:', error);
            return {
                success: false,
                error: error.message,
                duration_ms: Date.now() - startTime
            };
        }
    }

    /**
     * Set current task in working memory
     *
     * @param {object} task - Task object
     */
    setCurrentTask(task) {
        this.workingMemory.currentTask = task;
    }

    /**
     * Get current task from working memory
     *
     * @returns {object} Current task or null
     */
    getCurrentTask() {
        return this.workingMemory.currentTask;
    }

    /**
     * Clear working memory (after task complete)
     */
    clearWorkingMemory() {
        this.workingMemory = {
            currentTask: null,
            recentObservations: [],
            toolResults: []
        };
    }
}
