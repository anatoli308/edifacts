/**
 * Critic Agent (Validation & Hallucination Detection)
 * =====================================================
 * Purpose: Validate agent outputs, detect hallucinations, and request fixes/replanning.
 *
 * Responsibilities:
 * - Receive Executor output, LLM synthesis, or Planner task tree.
 * - Validate against:
 *   - JSON schemas (for structured outputs)
 *   - EDIFACT rules and domain constraints
 *   - Test suites (unit tests, regression tests)
 *   - Fact-checks against deterministic core
 * - Detect hallucinations (LLM claiming false facts).
 * - Identify consistency issues or contradictions.
 * - Request fixes, replanning, or escalation.
 *
 * Inputs:
 * - Output to validate (Executor results, LLM synthesis, task tree)
 * - Validation context (rules, schemas, expected outputs)
 * - Domain context (EDIFACT data, metadata)
 *
 * Outputs:
 * - Validation result:
 *   {
 *     valid: boolean,
 *     errors: [{ type, message, severity }],
 *     warnings: [...],
 *     hallucinations: [{ claim, fact_check_result }],
 *     recommendation: "PASS" | "FIX" | "REPLAN" | "ESCALATE"
 *   }
 *
 * Validation Types:
 * 1. Schema validation: JSON schema, field types, required fields
 * 2. Rule validation: EDIFACT rules, business logic constraints
 * 3. Fact-check: Does output match deterministic core results?
 * 4. Consistency: Are claims consistent with previous statements?
 *
 * Implementation Notes:
 * - Stateless: pure validation function.
 * - Deterministic: same input → same validation result.
 * - Fast: validation should not introduce significant latency.
 * - Comprehensive: catch issues before synthesis.
 * - Audit trail: all validations logged.
 *
 * Security:
 * - Mandatory for system-modifying tools (e.g., delete, update DB).
 * - Detects and flags prompt injections or jailbreak attempts.
 * - Ensures model outputs don't bypass business rules.
 *
 * Provider-Agnostic: Validation is independent of LLM provider.
 */

// TODO: Implement critic agent logic
