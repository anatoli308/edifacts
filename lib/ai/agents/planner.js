/**
 * Planner Agent (Hierarchical Task Network)
 * ==========================================
 * Purpose: Decompose user goals into hierarchical, executable task trees.
 *
 * Responsibilities:
 * - Receive a goal from Router Agent and domain context.
 * - Decompose into subtasks (Hierarchical Task Network / HTN style).
 * - Estimate effort, dependencies, and execution order.
 * - Generate a structured, JSON task plan.
 * - Support dynamic replanning based on Critic feedback.
 *
 * Inputs:
 * - Goal (string, from Router)
 * - Domain context (EDIFACT data, file, rules)
 * - Conversation history
 *
 * Outputs:
 * - Task tree (JSON):
 *   {
 *     goal: string,
 *     subtasks: [
 *       { id, name, description, dependencies: [], tools: [], estimated_effort }
 *     ],
 *     execution_order: [id, id, ...],
 *     rationale: string
 *   }
 * - Plan metadata (timestamp, version, replanning_count)
 *
 * Example:
 * Goal: "Analyze this EDIFACT invoice for errors"
 * Subtasks:
 *   1. Parse segments
 *   2. Validate against rules
 *   3. Identify errors
 *   4. Generate report
 *
 * Implementation Notes:
 * - Persisted in AnalysisChat.agentPlan for replay and debugging.
 * - Can be updated dynamically (replanning) if Critic detects issues.
 * - Stateless: pure function, no side effects.
 * - Must handle multi-goal scenarios (e.g., analyze + compliance check).
 *
 * Provider-Agnostic: Works with any LLM provider.
 */

export class Planner {
    constructor(config = {}) {
        this.config = {
            temperature: 0.3,
            maxRetries: 2,
            timeoutMs: 15000,
            enableLLMFallback: true,
            heuristicThreshold: 0.75,
            ...config
        };

        this._initializeHeuristics();
    }

    /**
     * Initialize decomposition heuristics for common scenarios
     */
    _initializeHeuristics() {
        this.decompositionPatterns = {
            ANALYZE: {
                keywords: ['analyze', 'analysiere', 'check', 'überprüfe', 'examine', 'review', 'untersuche'],
                decompose: () => [
                    { id: 'parse', name: 'Parse segments', description: 'Extract and parse all segments from EDIFACT message', tools: ['parseSegments'], effort: 'LOW', dependencies: [] },
                    { id: 'validate', name: 'Validate against rules', description: 'Check segments against EDIFACT rules and constraints', tools: ['validateRules'], effort: 'MEDIUM', dependencies: ['parse'] },
                    { id: 'identify_errors', name: 'Identify errors', description: 'Find and categorize validation errors', tools: ['identifyErrors'], effort: 'MEDIUM', dependencies: ['validate'] },
                    { id: 'generate_report', name: 'Generate report', description: 'Synthesize findings into readable report', tools: ['generateReport'], effort: 'LOW', dependencies: ['identify_errors'] }
                ]
            },
            DEBUG: {
                keywords: ['why', 'warum', 'reason', 'cause', 'error', 'problem', 'issue', 'fix', 'behebe'],
                decompose: () => [
                    { id: 'locate_issue', name: 'Locate issue', description: 'Find the segment or rule causing the error', tools: ['locateSegment', 'locateRule'], effort: 'MEDIUM', dependencies: [] },
                    { id: 'analyze_cause', name: 'Analyze root cause', description: 'Understand why the rule was violated', tools: ['analyzeConstraint'], effort: 'MEDIUM', dependencies: ['locate_issue'] },
                    { id: 'suggest_fix', name: 'Suggest fix', description: 'Propose correction or workaround', tools: ['suggestFix'], effort: 'MEDIUM', dependencies: ['analyze_cause'] },
                    { id: 'validate_fix', name: 'Validate fix', description: 'Check that proposed fix resolves issue', tools: ['validateRules'], effort: 'LOW', dependencies: ['suggest_fix'] }
                ]
            },
            COMPLIANCE: {
                keywords: ['compliance', 'compliant', 'standard', 'norm', 'rule', 'subset', 'version', 'conform'],
                decompose: () => [
                    { id: 'detect_subset', name: 'Detect message subset', description: 'Identify EDIFACT subset and version', tools: ['detectSubset'], effort: 'LOW', dependencies: [] },
                    { id: 'check_compliance', name: 'Check compliance', description: 'Verify message complies with detected subset rules', tools: ['validateRules', 'checkCompliance'], effort: 'MEDIUM', dependencies: ['detect_subset'] },
                    { id: 'list_violations', name: 'List violations', description: 'Enumerate all non-compliant segments or fields', tools: ['listViolations'], effort: 'LOW', dependencies: ['check_compliance'] },
                    { id: 'suggest_remediation', name: 'Suggest remediation', description: 'Provide corrective actions for each violation', tools: ['suggestFix'], effort: 'MEDIUM', dependencies: ['list_violations'] }
                ]
            },
            EXPLAIN: {
                keywords: ['explain', 'erkläre', 'what', 'what is', 'what does', 'meaning', 'bedeutung', 'describe', 'tell'],
                decompose: () => [
                    { id: 'identify_segment', name: 'Identify segment', description: 'Locate the segment or field being asked about', tools: ['locateSegment'], effort: 'LOW', dependencies: [] },
                    { id: 'extract_context', name: 'Extract context', description: 'Gather related segments and business context', tools: ['extractContext'], effort: 'LOW', dependencies: ['identify_segment'] },
                    { id: 'format_explanation', name: 'Format explanation', description: 'Generate clear, structured explanation', tools: ['formatExplanation'], effort: 'LOW', dependencies: ['extract_context'] }
                ]
            },
            COMPARE: {
                keywords: ['compare', 'vergleiche', 'difference', 'unterschied', 'vs', 'versus', 'contrast'],
                decompose: () => [
                    { id: 'extract_both', name: 'Extract both messages', description: 'Parse and prepare both messages for comparison', tools: ['parseSegments'], effort: 'LOW', dependencies: [] },
                    { id: 'identify_diffs', name: 'Identify differences', description: 'Find segments, fields, or values that differ', tools: ['compareSets'], effort: 'MEDIUM', dependencies: ['extract_both'] },
                    { id: 'categorize_diffs', name: 'Categorize differences', description: 'Group by type (structural, semantic, validation)', tools: ['categorizeDifferences'], effort: 'LOW', dependencies: ['identify_diffs'] },
                    { id: 'explain_impact', name: 'Explain impact', description: 'Describe business/technical implications', tools: ['explainImpact'], effort: 'MEDIUM', dependencies: ['categorize_diffs'] }
                ]
            }
            ,
            // Utility: Weather lookup using utility tools
            UTILITY_WEATHER: {
                keywords: ['weather', 'wetter', 'temperature', 'temperatur', 'forecast', 'vorhersage'],
                decompose: () => [
                    { id: 'search_city', name: 'Find location info', description: 'Resolve city/locale from user query', tools: ['webSearch'], effort: 'LOW', dependencies: [] },
                    { id: 'get_weather', name: 'Get current weather', description: 'Retrieve current weather data for the location', tools: ['getWeather'], effort: 'LOW', dependencies: ['search_city'] },
                    { id: 'summarize', name: 'Summarize weather', description: 'Summarize and present weather results', tools: [], effort: 'LOW', dependencies: ['get_weather'] }
                ]
            },
            // Utility: General web search
            UTILITY_SEARCH: {
                keywords: ['search', 'suche', 'web', 'google', 'find', 'finden', 'lookup'],
                decompose: () => [
                    { id: 'web_search', name: 'Web search', description: 'Perform a web search for the requested topic', tools: ['webSearch'], effort: 'LOW', dependencies: [] },
                    { id: 'summarize', name: 'Summarize results', description: 'Summarize and present search results', tools: [], effort: 'LOW', dependencies: ['web_search'] }
                ]
            }
        };
    }

    /**
     * Main invoke method - decompose goal into task tree
     * @param {object} params - Invocation parameters
     * @param {string} params.goal - User goal or intention
     * @param {object} params.context - Domain context (EDIFACT data, history, etc)
     * @param {object} params.provider - Optional LLM provider for fallback
     * @returns {Promise<object>} Task plan with subtasks and execution order
     */
    async invoke({ goal, context = {}, provider = null }) {
        const startTime = Date.now();

        try {
            // Extract structured goal from user message
            const structuredGoal = this._extractGoal(goal);

            // Try heuristic-based decomposition first (fast path)
            const heuristicResult = this._decomposeWithHeuristics(structuredGoal.type, structuredGoal.message);

            if (heuristicResult.confidence >= this.config.heuristicThreshold) {
                const taskPlan = this._buildTaskGraph(heuristicResult.subtasks, structuredGoal);
                return this._finalizeResult(taskPlan, structuredGoal, 'HEURISTIC', startTime);
            }

            // Fall back to LLM if confidence is low and provider is available
            if (this.config.enableLLMFallback && provider) {
                const llmResult = await this._decomposeWithLLM(
                    structuredGoal.message,
                    context,
                    provider,
                    heuristicResult
                );
                const taskPlan = this._buildTaskGraph(llmResult.subtasks, structuredGoal);
                return this._finalizeResult(taskPlan, structuredGoal, 'LLM', startTime);
            }

            // Fall back to heuristic result if LLM not available
            const taskPlan = this._buildTaskGraph(heuristicResult.subtasks, structuredGoal);
            return this._finalizeResult(taskPlan, structuredGoal, 'HEURISTIC', startTime);
        } catch (error) {
            return this._defaultResult(goal, error, startTime);
        }
    }

    /**
     * Extract structured goal from user message
     */
    _extractGoal(message) {
        if (!message || typeof message !== 'string') {
            return { type: 'GENERIC', message: message || '', noun: 'task' };
        }

        const lower = message.toLowerCase();
        let type = 'GENERIC';
        let noun = 'task';

        // Detect goal type based on verbs and patterns
        if (/analyze|analysiere|check|überprüfe|examine|review|untersuche/.test(lower)) {
            type = 'ANALYZE';
            noun = 'analysis';
        } else if (/why|warum|reason|cause|error|problem|issue|behebe/.test(lower)) {
            type = 'DEBUG';
            noun = 'debugging';
        } else if (/compli|standard|norm|rule|subset|version|conform/.test(lower)) {
            type = 'COMPLIANCE';
            noun = 'compliance check';
        } else if (/explain|erkläre|what|meaning|bedeutung|describe|tell/.test(lower)) {
            type = 'EXPLAIN';
            noun = 'explanation';
        } else if (/compare|vergleiche|difference|unterschied|vs|versus|contrast/.test(lower)) {
            type = 'COMPARE';
            noun = 'comparison';
        } else if (/weather|wetter|temperature|temperatur|forecast|vorhersage/.test(lower)) {
            type = 'UTILITY_WEATHER';
            noun = 'weather information';
        } else if (/\b(search|suche|web|google|finden|lookup)\b/.test(lower)) {
            type = 'UTILITY_SEARCH';
            noun = 'web search';
        }

        return {
            type,
            message,
            noun,
            originalLength: message.length,
            isComplex: message.length > 150
        };
    }

    /**
     * Heuristic-based decomposition (fast path)
     */
    _decomposeWithHeuristics(goalType, message) {
        const pattern = this.decompositionPatterns[goalType];

        if (!pattern) {
            return {
                confidence: 0.0,
                reason: `No heuristic pattern for ${goalType}`,
                subtasks: []
            };
        }

        // Calculate confidence based on keyword matches
        const keywords = pattern.keywords;
        const matchCount = keywords.filter(kw => message.toLowerCase().includes(kw)).length;
        let confidence = Math.min(1.0, matchCount / Math.max(1, keywords.length * 0.5));
        // Boost confidence for utility patterns when keyword present
        if (goalType && goalType.startsWith('UTILITY') && matchCount > 0) {
            confidence = Math.max(confidence, 0.9);
        }

        return {
            confidence,
            reason: `Heuristic match for ${goalType} (${(confidence * 100).toFixed(0)}%)`,
            subtasks: pattern.decompose(),
            goalType
        };
    }

    /**
     * LLM-based decomposition (fallback for complex goals)
     */
    async _decomposeWithLLM(goal, context, provider, heuristicHint) {
        try {
            const systemPrompt = this._buildSystemPrompt(context);
            const userPrompt = this._buildUserPrompt(goal, heuristicHint);

            const messages = [
                { role: 'user', content: userPrompt }
            ];

            // Call LLM with timeout
            const response = await Promise.race([
                provider.complete({ messages, systemPrompt, options: { temperature: this.config.temperature } }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Planner LLM timeout')), this.config.timeoutMs)
                )
            ]);

            // Parse task plan from LLM response
            const parsed = this._parseLLMResponse(response?.content || response);
            if (!parsed || !parsed.subtasks || parsed.subtasks.length === 0) {
                throw new Error('LLM response could not be parsed into valid task plan');
            }

            return {
                confidence: 0.85,
                reason: 'LLM decomposition',
                subtasks: parsed.subtasks,
                rationale: parsed.rationale
            };
        } catch (error) {
            throw new Error(`LLM decomposition failed: ${error.message}`);
        }
    }

    /**
     * Build system prompt for LLM
     */
    _buildSystemPrompt(context) {
        const domainInfo = context.domain || 'EDIFACT analysis';
        const fileInfo = context.fileInfo ? `\nFile: ${context.fileInfo}` : '';

        return `You are an expert task planning agent for ${domainInfo}.

Your job is to decompose user goals into hierarchical, executable task trees (HTN style).

Each task must be:
- Specific and actionable
- Have clear dependencies
- Have estimated effort (LOW/MEDIUM/HIGH)
- Specify required tools (or empty array if none)
- Have unique ID and clear description

Format your response as JSON:
{
  "subtasks": [
    {
      "id": "unique_id",
      "name": "Task Name",
      "description": "Clear description of what to do",
      "tools": ["tool1", "tool2"],
      "effort": "LOW|MEDIUM|HIGH",
      "dependencies": ["id1", "id2"] or []
    }
  ],
  "rationale": "Why this decomposition?"
}${fileInfo}`;
    }

    /**
     * Build user prompt for LLM
     */
    _buildUserPrompt(goal, heuristicHint) {
        let prompt = `Decompose this goal into a task plan:\n"${goal}"\n`;

        if (heuristicHint && heuristicHint.reason) {
            prompt += `\nHint: ${heuristicHint.reason}`;
            if (heuristicHint.subtasks && heuristicHint.subtasks.length > 0) {
                prompt += '\nSuggested subtasks:\n';
                heuristicHint.subtasks.forEach((task, idx) => {
                    prompt += `${idx + 1}. ${task.name} (${task.effort})\n`;
                });
                prompt += '\nUse these as starting point and refine if needed.';
            }
        }

        prompt += '\n\nRespond with JSON only, no markdown or explanation.';
        return prompt;
    }

    /**
     * Parse LLM response into task plan
     */
    _parseLLMResponse(responseText) {
        if (!responseText || typeof responseText !== 'string') {
            return null;
        }

        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return null;
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Validate structure
            if (!Array.isArray(parsed.subtasks)) {
                return null;
            }

            // Ensure all subtasks have required fields
            parsed.subtasks = parsed.subtasks.map((task, idx) => ({
                id: task.id || `task_${idx}`,
                name: task.name || `Task ${idx + 1}`,
                description: task.description || '',
                tools: Array.isArray(task.tools) ? task.tools : [],
                effort: ['LOW', 'MEDIUM', 'HIGH'].includes(task.effort) ? task.effort : 'MEDIUM',
                dependencies: Array.isArray(task.dependencies) ? task.dependencies : []
            }));

            return parsed;
        } catch {
            return null;
        }
    }

    /**
     * Build task graph (determine execution order and dependencies)
     */
    _buildTaskGraph(subtasks, structuredGoal) {
        if (!subtasks || subtasks.length === 0) {
            return {
                goal: structuredGoal.message,
                goalType: structuredGoal.type,
                subtasks: [],
                execution_order: [],
                rationale: 'No decomposition available',
                task_count: 0,
                critical_path_length: 0,
                parallelizable_groups: []
            };
        }

        // Validate and normalize subtasks
        const normalizedTasks = subtasks.map((task, idx) => ({
            id: task.id || `task_${idx}`,
            name: task.name || `Task ${idx + 1}`,
            description: task.description || '',
            tools: Array.isArray(task.tools) ? task.tools : [],
            effort: task.effort || 'MEDIUM',
            dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
            estimated_duration_ms: this._estimateDuration(task.effort)
        }));

        // Calculate execution order using topological sort
        const executionOrder = this._topologicalSort(normalizedTasks);

        // Identify parallelizable groups
        const parallelGroups = this._identifyParallelGroups(normalizedTasks, executionOrder);

        // Calculate critical path
        const criticalPath = this._calculateCriticalPath(normalizedTasks, executionOrder);

        return {
            goal: structuredGoal.message,
            goalType: structuredGoal.type,
            subtasks: normalizedTasks,
            execution_order: executionOrder,
            parallelizable_groups: parallelGroups,
            critical_path: criticalPath,
            critical_path_length: criticalPath.length,
            total_estimated_duration_ms: this._calculateTotalDuration(normalizedTasks, executionOrder),
            task_count: normalizedTasks.length,
            rationale: `Decomposed into ${normalizedTasks.length} task(s) with ${executionOrder.length} sequential steps`
        };
    }

    /**
     * Topological sort for task dependencies
     */
    _topologicalSort(tasks) {
        const visited = new Set();
        const order = [];
        const temp = new Set();

        const visit = (taskId) => {
            if (visited.has(taskId)) return;
            if (temp.has(taskId)) {
                throw new Error(`Circular dependency detected: ${taskId}`);
            }

            temp.add(taskId);
            const task = tasks.find(t => t.id === taskId);
            if (task && task.dependencies) {
                task.dependencies.forEach(depId => visit(depId));
            }
            temp.delete(taskId);
            visited.add(taskId);
            order.push(taskId);
        };

        tasks.forEach(task => {
            try {
                visit(task.id);
            } catch (error) {
                console.warn(`Dependency warning for ${task.id}: ${error.message}`);
            }
        });

        return order;
    }

    /**
     * Identify tasks that can run in parallel
     */
    _identifyParallelGroups(tasks, executionOrder) {
        const groups = [];
        const processed = new Set();

        for (const taskId of executionOrder) {
            if (processed.has(taskId)) continue;

            const task = tasks.find(t => t.id === taskId);
            const parallelGroup = [taskId];
            processed.add(taskId);

            // Find other tasks that have same dependencies
            for (const otherTask of tasks) {
                if (processed.has(otherTask.id)) continue;

                const sameDepends = JSON.stringify(task.dependencies) === JSON.stringify(otherTask.dependencies);
                if (sameDepends && otherTask.dependencies.length > 0) {
                    // Check if all dependencies are satisfied
                    const depsInOrder = otherTask.dependencies.every(dep => processed.has(dep));
                    if (depsInOrder) {
                        parallelGroup.push(otherTask.id);
                        processed.add(otherTask.id);
                    }
                }
            }

            if (parallelGroup.length > 0) {
                groups.push(parallelGroup);
            }
        }

        return groups.filter(g => g.length > 0);
    }

    /**
     * Calculate critical path (longest dependency chain)
     */
    _calculateCriticalPath(tasks, executionOrder) {
        const paths = {};

        for (const taskId of executionOrder) {
            const task = tasks.find(t => t.id === taskId);
            const duration = this._estimateDuration(task.effort);

            if (!task.dependencies || task.dependencies.length === 0) {
                paths[taskId] = { distance: duration, path: [taskId] };
            } else {
                let maxDist = 0;
                let maxPath = [];
                for (const depId of task.dependencies) {
                    if (paths[depId]) {
                        if (paths[depId].distance > maxDist) {
                            maxDist = paths[depId].distance;
                            maxPath = [...paths[depId].path];
                        }
                    }
                }
                paths[taskId] = { distance: maxDist + duration, path: [...maxPath, taskId] };
            }
        }

        // Find longest path
        let longestPath = [];
        let maxLength = 0;
        for (const [_, value] of Object.entries(paths)) {
            if (value.distance > maxLength) {
                maxLength = value.distance;
                longestPath = value.path;
            }
        }

        return longestPath;
    }

    /**
     * Estimate task duration in milliseconds
     */
    _estimateDuration(effort) {
        const durations = {
            LOW: 500,
            MEDIUM: 1500,
            HIGH: 3000
        };
        return durations[effort] || 1500;
    }

    /**
     * Calculate total estimated duration
     */
    _calculateTotalDuration(tasks, executionOrder) {
        if (executionOrder.length === 0) return 0;

        const criticalPath = this._calculateCriticalPath(tasks, executionOrder);
        return criticalPath.reduce((sum, taskId) => {
            const task = tasks.find(t => t.id === taskId);
            return sum + (task ? this._estimateDuration(task.effort) : 0);
        }, 0);
    }

    /**
     * Finalize result with metadata
     */
    _finalizeResult(taskPlan, structuredGoal, source, startTime) {
        return {
            ...taskPlan,
            metadata: {
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                source,
                version: '1.0',
                replanning_count: 0
            },
            status: 'READY'
        };
    }

    /**
     * Default result (on error)
     */
    _defaultResult(goal, error, startTime) {
        console.error('Planner error:', error);

        return {
            goal,
            goalType: 'GENERIC',
            subtasks: [
                {
                    id: 'fallback_task',
                    name: 'Manual analysis',
                    description: 'Unable to automatically decompose. Please proceed with manual analysis.',
                    tools: [],
                    effort: 'HIGH',
                    dependencies: [],
                    estimated_duration_ms: 3000
                }
            ],
            execution_order: ['fallback_task'],
            critical_path: ['fallback_task'],
            critical_path_length: 1,
            total_estimated_duration_ms: 3000,
            task_count: 1,
            parallelizable_groups: [],
            rationale: `Auto-decomposition failed: ${error.message}`,
            metadata: {
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                source: 'ERROR_FALLBACK',
                version: '1.0',
                replanning_count: 0
            },
            status: 'FALLBACK',
            error: error.message
        };
    }
}
