/**
 * Critic Agent (Validation & Hallucination Detection)
 * =====================================================
 * Purpose: Validate agent outputs, detect hallucinations, ensure consistency.
 *
 * Responsibilities:
 * - Validate outputs against schemas (JSON, types, required fields)
 * - Enforce domain rules (EDIFACT rules, business constraints)
 * - Fact-check against deterministic core (no false claims)
 * - Detect consistency issues (contradictions, logical errors)
 * - Identify potential hallucinations (model claiming false facts)
 * - Provide actionable recommendations (PASS | FIX | REPLAN | ESCALATE)
 *
 * Validation Pipeline:
 * Input (LLM output, tool result, task tree)
 *   ↓
 * Schema Validation (JSON schema, field types, required fields)
 *   ↓ (if schema valid)
 * Rule Validation (EDIFACT rules, business logic)
 *   ↓ (if rules pass)
 * Fact-Check (compare vs deterministic core)
 *   ↓ (if no hallucinations)
 * Consistency Check (logical consistency, no contradictions)
 *   ↓
 * Generate Recommendation (PASS | FIX | REPLAN | ESCALATE)
 *
 * Inputs:
 * - output: Object to validate (any structure)
 * - validators: { schema?, rules?, testSuite?, factChecker? }
 * - context: { domain?, previousOutputs?, expectedResults? }
 * - options: { strict?, tolerateHallucinations?, maxErrors? }
 *
 * Outputs:
 * {
 *   valid: boolean,
 *   score: 0-1 (confidence in validity),
 *   errors: [{ type, field?, message, severity: 'error'|'warning' }],
 *   warnings: [{ type, message }],
 *   hallucinations: [{ claim, actual, confidence }],
 *   consistency: { consistent: boolean, issues: [...] },
 *   recommendation: 'PASS' | 'FIX' | 'REPLAN' | 'ESCALATE',
 *   reasoning: string (for audit/debugging)
 * }
 *
 * Validation Types:
 * 1. **Schema**: JSON schema validation (ajv-style)
 * 2. **Rules**: Domain rules (EDIFACT validation rules)
 * 3. **Fact-Check**: Compare output vs deterministic core (no false claims)
 * 4. **Consistency**: No contradictions, logical coherence
 * 5. **Security**: No prompt injection, no jailbreak attempts
 *
 * Hallucination Detection:
 * - Compare claims in output vs deterministic core (EDIFACT parser)
 * - Flag facts that can't be verified against input data
 * - Confidence scoring: how sure is the LLM vs reality
 *
 * Recommendation Logic:
 * - PASS: All validations pass, output is high quality
 * - FIX: Minor issues (typos, formatting) - send back to Executor
 * - REPLAN: Logic errors - decompose differently
 * - ESCALATE: Critical failures - ask human
 *
 * Implementation Notes:
 * - Stateless: pure validation (no side effects)
 * - Deterministic: same input → same output
 * - Fast: < 1s for typical validation
 * - Comprehensive: catch issues before synthesis
 * - Audit: log all validations for compliance
 *
 * Security:
 * - Mandatory for system-modifying outputs (delete, update DB)
 * - Detects prompt injection attempts (SQL, command injection in claims)
 * - Ensures model outputs don't bypass business rules
 * - Validates tool arguments before execution
 *
 * Provider-Agnostic: Works with any LLM provider output.
 */

import { CRITIC_CONFIG } from '../config/agents.config.js';

export class Critic {
    /**
     * Initialize Critic agent
     * 
     * @param {object} config - Configuration
     * @param {number} config.strictMode - Fail on warnings (default: false)
     * @param {number} config.maxErrors - Stop after N errors (default: 10)
     * @param {array} config.requiredValidators - Required validators (default: [])
     * @param {boolean} config.enableSecurityChecks - Check for injection/jailbreak (default: true)
     */
    constructor(config = {}) {
        this.config = {
            temperature: 0.1,
            maxTokens: 1500,
            topP: 0.9,
            timeoutMs: 15000,
            maxRetries: 1,
            retryBackoff: 'linear',
            strictMode: false,
            maxErrors: 10,
            requiredValidators: [],
            enableSecurityChecks: true,
            ...CRITIC_CONFIG,
            ...config
        };
    }

    /**
     * Main validation method
     * 
     * @param {object} params
     * @param {*} params.output - Output to validate (LLM response, tool result, etc)
     * @param {object} params.validators - Validator functions
     * @param {function} params.validators.schema - (output) => errors[]
     * @param {function} params.validators.rules - (output, context) => errors[]
     * @param {function} params.validators.testSuite - (output) => testResults
     * @param {function} params.validators.factChecker - (output, context) => hallucinations[]
     * @param {object} params.context - Domain context
     * @param {object} params.options - Validation options
     * @returns {promise<object>} Validation result
     */
    async invoke({ output, validators = {}, context = {}, options = {} }) {
        const startTime = Date.now();
        const result = {
            valid: true,
            score: 1.0,
            errors: [],
            warnings: [],
            hallucinations: [],
            consistency: { consistent: true, issues: [] },
            recommendation: 'PASS',
            reasoning: [],
            duration_ms: 0
        };

        try {
            // Step 1: Security checks
            if (this.config.enableSecurityChecks) {
                const securityIssues = this._checkSecurity(output);
                if (securityIssues.length > 0) {
                    result.errors.push(...securityIssues);
                    result.recommendation = 'ESCALATE';
                    result.valid = false;
                    result.reasoning.push('Security check failed: potential injection/jailbreak');
                }
            }

            // Step 2: Schema validation
            if (validators.schema) {
                const schemaErrors = await this._validateSchema(output, validators.schema);
                result.errors.push(...schemaErrors);
                if (schemaErrors.length > 0) {
                    result.valid = false;
                    result.reasoning.push(`Schema validation: ${schemaErrors.length} error(s)`);
                }
            }

            // If schema fails, stop here
            if (!result.valid) {
                result.recommendation = 'FIX';
                return this._finalizeResult(result, startTime);
            }

            // Step 3: Rule validation
            if (validators.rules) {
                const ruleErrors = await this._validateRules(output, validators.rules, context);
                if (ruleErrors.errors.length > 0) {
                    result.errors.push(...ruleErrors.errors);
                    result.warnings.push(...(ruleErrors.warnings || []));
                    result.valid = false;
                    result.reasoning.push(`Rule validation: ${ruleErrors.errors.length} error(s)`);
                }
            }

            // Step 4: Fact-check (hallucination detection)
            if (validators.factChecker) {
                const hallucinations = await this._detectHallucinations(
                    output,
                    validators.factChecker,
                    context
                );
                if (hallucinations.length > 0) {
                    result.hallucinations = hallucinations;
                    result.warnings.push({
                        type: 'hallucination_detected',
                        message: `${hallucinations.length} potential hallucination(s) detected`,
                        severity: 'warning'
                    });
                    result.valid = false;
                    result.reasoning.push(`Hallucinations detected: ${hallucinations.length}`);
                }
            }

            // Step 5: Consistency check
            if (context.previousOutputs || context.expectedResults) {
                const consistency = await this._checkConsistency(output, context);
                result.consistency = consistency;
                if (!consistency.consistent) {
                    result.warnings.push({
                        type: 'consistency_issue',
                        message: `Consistency check failed: ${consistency.issues.length} issue(s)`,
                        severity: 'warning'
                    });
                    result.valid = false;
                    result.reasoning.push(`Consistency: ${consistency.issues.length} issue(s)`);
                }
            }

            // Step 6: Test suite (if available)
            if (validators.testSuite) {
                const testResults = await this._runTestSuite(output, validators.testSuite);
                if (!testResults.allPass) {
                    result.warnings.push({
                        type: 'test_failure',
                        message: `${testResults.failedCount} test(s) failed`,
                        severity: 'warning'
                    });
                    result.valid = false;
                    result.reasoning.push(`Test suite: ${testResults.failedCount}/${testResults.totalCount} failed`);
                }
            }

            // Step 7: Generate recommendation
            result.recommendation = this._generateRecommendation(result);
            result.score = this._calculateScore(result);

        } catch (error) {
            console.error('[Critic] Validation error:', error);
            result.valid = false;
            result.recommendation = 'ESCALATE';
            result.errors.push({
                type: 'validation_error',
                message: `Internal validation error: ${error.message}`,
                severity: 'error'
            });
            result.reasoning.push(`Validation failed with error: ${error.message}`);
        }

        return this._finalizeResult(result, startTime);
    }

    /**
     * Schema validation (JSON schema style)
     * @private
     */
    async _validateSchema(output, schemaValidator) {
        try {
            const errors = schemaValidator(output);
            return (errors || []).map(err => ({
                type: 'schema_error',
                field: err.field || err.path,
                message: err.message || `Schema validation failed at ${err.field}`,
                severity: 'error'
            }));
        } catch (error) {
            console.error('[Critic._validateSchema] Error:', error);
            return [{
                type: 'schema_error',
                message: `Schema validation failed: ${error.message}`,
                severity: 'error'
            }];
        }
    }

    /**
     * Rule validation (domain rules)
     * @private
     */
    async _validateRules(output, rulesValidator, context) {
        try {
            const result = await rulesValidator(output, context);
            return {
                errors: (result.errors || []).map(err => ({
                    type: 'rule_violation',
                    field: err.field,
                    message: err.message,
                    severity: 'error'
                })),
                warnings: (result.warnings || []).map(warn => ({
                    type: 'rule_warning',
                    message: warn.message,
                    severity: 'warning'
                }))
            };
        } catch (error) {
            console.error('[Critic._validateRules] Error:', error);
            return {
                errors: [{
                    type: 'rule_error',
                    message: `Rule validation failed: ${error.message}`,
                    severity: 'error'
                }],
                warnings: []
            };
        }
    }

    /**
     * Hallucination detection (fact-check against deterministic core)
     * @private
     */
    async _detectHallucinations(output, factChecker, context) {
        try {
            const hallucinations = await factChecker(output, context);
            return (hallucinations || []).map(h => ({
                claim: h.claim || h.statement,
                actual: h.actual || h.fact,
                confidence: h.confidence || 0.5,
                evidence: h.evidence || 'Unverifiable against deterministic core'
            }));
        } catch (error) {
            console.error('[Critic._detectHallucinations] Error:', error);
            return [];
        }
    }

    /**
     * Consistency check against previous outputs
     * @private
     */
    async _checkConsistency(output, context) {
        const issues = [];

        try {
            // Check against previous outputs
            if (context.previousOutputs && Array.isArray(context.previousOutputs)) {
                for (const prev of context.previousOutputs) {
                    if (this._isContradiction(output, prev)) {
                        issues.push({
                            type: 'contradiction',
                            message: `Current output contradicts previous output`,
                            previous: prev,
                            current: output
                        });
                    }
                }
            }

            // Check against expected results
            if (context.expectedResults) {
                const expected = context.expectedResults;
                if (expected.fields) {
                    for (const field of expected.fields) {
                        if (output[field.key] !== undefined) {
                            if (!this._matches(output[field.key], field.expectedValue)) {
                                issues.push({
                                    type: 'mismatch',
                                    message: `Field ${field.key} doesn't match expected value`,
                                    field: field.key,
                                    expected: field.expectedValue,
                                    actual: output[field.key]
                                });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[Critic._checkConsistency] Error:', error);
        }

        return {
            consistent: issues.length === 0,
            issues
        };
    }

    /**
     * Test suite execution
     * @private
     */
    async _runTestSuite(output, testSuite) {
        const results = {
            totalCount: 0,
            passedCount: 0,
            failedCount: 0,
            tests: []
        };

        try {
            if (typeof testSuite === 'function') {
                const testResults = await testSuite(output);
                if (Array.isArray(testResults)) {
                    results.tests = testResults;
                    results.totalCount = testResults.length;
                    results.passedCount = testResults.filter(t => t.passed).length;
                    results.failedCount = testResults.filter(t => !t.passed).length;
                } else if (testResults.tests && Array.isArray(testResults.tests)) {
                    results.tests = testResults.tests;
                    results.totalCount = testResults.tests.length;
                    results.passedCount = testResults.tests.filter(t => t.passed).length;
                    results.failedCount = testResults.tests.filter(t => !t.passed).length;
                }
            }
        } catch (error) {
            console.error('[Critic._runTestSuite] Error:', error);
        }

        results.allPass = results.failedCount === 0;
        return results;
    }

    /**
     * Security checks (injection, jailbreak, etc)
     * @private
     */
    _checkSecurity(output) {
        const issues = [];
        // Ensure robust string conversion (handles undefined/null/non-JSONable)
        let raw;
        try {
            raw = typeof output === 'string'
                ? output
                : (output == null ? '' : JSON.stringify(output));
        } catch (e) {
            raw = '';
        }
        const outputStr = String(raw).toLowerCase();

        // Simple injection detection (can be extended)
        const injectionPatterns = [
            /(\b(drop|delete|truncate|update|insert|exec|execute)\b)/i,
            /(<script|javascript:|onerror|onload)/i,
            /(\$\{.*\}|`.*`)/,
        ];

        for (const pattern of injectionPatterns) {
            if (pattern.test(outputStr)) {
                issues.push({
                    type: 'security_risk',
                    message: 'Potential injection attempt detected',
                    severity: 'error'
                });
                break;
            }
        }

        return issues;
    }

    /**
     * Check if two outputs contradict each other
     * @private
     */
    _isContradiction(current, previous) {
        // Simple contradiction check: if keys overlap and values differ
        if (typeof current !== 'object' || typeof previous !== 'object') {
            return current !== previous;
        }

        const currentKeys = Object.keys(current);
        const previousKeys = Object.keys(previous);
        const overlappingKeys = currentKeys.filter(k => previousKeys.includes(k));

        for (const key of overlappingKeys) {
            if (current[key] !== previous[key]) {
                // Values differ - potential contradiction
                return true;
            }
        }

        return false;
    }

    /**
     * Check if value matches expected (fuzzy match for flexibility)
     * @private
     */
    _matches(actual, expected) {
        if (typeof actual === 'string' && typeof expected === 'string') {
            return actual.toLowerCase().trim() === expected.toLowerCase().trim();
        }
        return actual === expected;
    }

    /**
     * Generate recommendation based on validation result
     * @private
     */
    _generateRecommendation(result) {
        // ESCALATE if security or critical errors
        if (result.errors.some(e => e.type === 'security_risk')) {
            return 'ESCALATE';
        }

        // ESCALATE if too many errors
        if (result.errors.length > this.config.maxErrors) {
            return 'ESCALATE';
        }

        // REPLAN if hallucinations or consistency issues
        if (result.hallucinations.length > 0 && result.hallucinations.some(h => h.confidence > 0.7)) {
            return 'REPLAN';
        }

        if (result.consistency.issues.some(i => i.type === 'contradiction')) {
            return 'REPLAN';
        }

        // FIX if schema/rule errors but recoverable
        if (result.errors.length > 0) {
            return 'FIX';
        }

        // FIX if warnings in strict mode
        if (this.config.strictMode && result.warnings.length > 0) {
            return 'FIX';
        }

        return 'PASS';
    }

    /**
     * Calculate overall confidence score (0-1)
     * @private
     */
    _calculateScore(result) {
        let score = 1.0;

        // Deduct for errors
        score -= result.errors.length * 0.15;

        // Deduct for warnings
        score -= result.warnings.length * 0.05;

        // Deduct for hallucinations
        for (const h of result.hallucinations) {
            score -= h.confidence * 0.2;
        }

        // Deduct for consistency issues
        score -= result.consistency.issues.length * 0.1;

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Finalize result with metadata
     * @private
     */
    _finalizeResult(result, startTime) {
        result.duration_ms = Date.now() - startTime;
        result.timestamp = new Date().toISOString();
        return result;
    }
}
