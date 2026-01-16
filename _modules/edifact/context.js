/**
 * EDIFACT Context Builder
 * =======================
 * Purpose: Convert parsed EDIFACT data into LLM-friendly context (llmContext).
 *
 * Responsibilities:
 * - Take raw EDIFACT analysis (segments, errors, summary)
 * - Summarize for LLM consumption (respecting context window limits)
 * - Extract key information (message type, errors, statistics)
 * - Format for readability and token efficiency
 * - Preserve domain semantics for accurate AI reasoning
 * - Support multiple detail levels (compact, normal, detailed)
 *
 * Inputs:
 * - Parsed EDIFACT data:
 *   { segments: [], errors: [], summary: {...}, metadata: {...} }
 * - User preferences (detail level, language)
 * - Optional filters (show only errors, specific segments, etc.)
 *
 * Outputs:
 * - llmContext (string or structured JSON):
 *   {
 *     message_type: string,
 *     summary: string,
 *     key_segments: [...],
 *     identified_errors: [...],
 *     statistics: { segment_count, error_count, ... },
 *     recommendations: []
 *   }
 * - Metadata about context (token estimate, compression ratio)
 *
 * Context Levels:
 * - Compact: ~500 tokens, essential info only
 * - Normal: ~1500 tokens, detailed but concise
 * - Detailed: ~3000 tokens, all context for complex analysis
 *
 * Optimization:
 * - Remove redundant information
 * - Abbreviate long segment values
 * - Focus on errors and anomalies
 * - Use structured format (JSON) for clarity
 * - Token counting to stay within budget
 *
 * Implementation Notes:
 * - Deterministic: same input → same output
 * - Fast: should complete in < 100ms
 * - LLM-aware: formats output for maximum clarity
 * - Reusable: used by all agents needing EDIFACT context
 *
 * Example Output (compact):
 * {
 *   message_type: "INVOIC (D96A)",
 *   segment_count: 45,
 *   errors: [
 *     { segment: "DTM+137:20240101:102", issue: "Invalid date format" },
 *     { segment: "MOA+9:1000:EUR", issue: "Amount exceeds limit" }
 *   ],
 *   summary: "2 errors found in invoice..."
 * }
 */

// TODO: Implement context builder
