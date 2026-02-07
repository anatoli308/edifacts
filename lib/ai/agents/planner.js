/**
 * Planner Agent (Hierarchical Task Network)
 * ==========================================
 * Status: ✅ Implemented (v1.x Early) + 🚧 Enhancements Planned (v1.x Late)
 * Human Analog: Prefrontal Cortex (Planning, Strategic Thinking)
 * 
 * Purpose: Decompose user goals into hierarchical, executable task trees using LLM intelligence.
 *
 * Responsibilities:
 * - Receive a goal from request and agent context
 * - Decompose into subtasks using LLM-based planning (HTN style)
 * - Estimate effort, dependencies, and execution order
 * - Generate a structured, JSON task plan
 * - Support dynamic replanning based on Critic feedback
 *
 * Inputs:
 * - Goal (string)
 * - agent context (EDIFACT data, sessionId, userId, etc)
 * - Provider (LLM provider for task decomposition)
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
 *   1. Parse segments → [parseSegments]
 *   2. Validate rules → [validateRules]
 *   3. Identify errors → [identifyErrors]
 *   4. Generate report → [formatReport]
 *
 * Implementation Notes:
 * - Persisted in AnalysisChat.agentPlan for replay and debugging
 * - Can be updated dynamically (replanning) if Critic detects issues
 * - Stateless: pure function, no side effects
 * - LLM-based decomposition for intelligent, context-aware planning
 * - Provider-Agnostic: Works with any LLM provider (OpenAI, Anthropic, vLLM, etc)
 */
import { EventEmitter } from 'events';
import { getPrompt } from '../prompts/index.js';

/**
 * Planner Agent Configuration
 * - Moderate temperature (creative task decomposition)
 * - Structured output
 * - Medium response length
 */
const PLANNER_CONFIG = {
    temperature: 0.3, // Low temperature for consistent planning
    maxTokens: 1500, // Detailed task tree
    topP: 0.95,
    timeoutMs: 15000,
    maxRetries: 2,
    retryBackoff: 'exponential',
};

export class Planner extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            ...PLANNER_CONFIG,
            ...config // Allow override
        };
    }

    /**
     * Reset planner state for next execution
     */
    reset() {
        console.log('[Planner] State reset');
        //clean event listeners if any
    }

    /**
     * Main invoke method - decompose goal into task tree using LLM
     * @param {object} params - Invocation parameters
     * @param {string} params.userMessage - User goal or intention
     * @param {array} params.messages - Chat conversation history
     * @param {object} params.executionContext - agent context (session, user, provider, domain, etc)
     * @returns {Promise<object>} Task plan with subtasks and execution order
     */
    async invoke({ userMessage, messages, executionContext = {} }) {
        const startTime = Date.now();

        try {
            if (!executionContext.provider) {
                throw new Error('Provider is required in executionContext for Planner agent');
            }

            // Validate userMessage
            if (!userMessage || typeof userMessage !== 'string') {
                throw new Error('User message must be a non-empty string');
            }

            console.log(`[Planner] Decomposing user message: ${userMessage.substring(0, 100)}`);

            // Emit planning started
            this.emit('agent_planner:started', {
                status: 'planner_started',
                subtasks: [],
                rationale: '',
                goal: userMessage,
                timestamp: Date.now(),
            });

            // Use LLM to decompose user message into task plan
            const llmResult = await this._decomposeWithLLM(userMessage, messages, executionContext);

            // Build task graph with dependencies and execution order
            const taskPlan = this._buildTaskGraph(llmResult.subtasks, userMessage, llmResult.rationale);

            // Finalize result with metadata
            const finalResult = this._finalizeResult(taskPlan, userMessage, 'LLM', startTime);

            // Emit planning completed with full result
            this.emit('agent_planner:completed', finalResult);

            return finalResult;
        } catch (error) {
            console.error(`[Planner] Error: ${error.message}`);
            return this._defaultResult(userMessage, error, startTime);
        }
    }

    /**
     * LLM-based decomposition with retry logic
     * @param {string} userMessage - User message to decompose
     * @param {array} messages - Conversation history
     * @param {object} executionContext - agent context (session, user, provider, domain, etc)
     * @returns {Promise<object>} Decomposed subtasks and rationale
     * @private
     */
    async _decomposeWithLLM(userMessage, messages, executionContext) {
        let lastError = null;
        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                const systemPrompt = this._buildSystemPrompt();
                const userPrompt = this._buildUserPrompt(userMessage, executionContext);

                console.log(`[Planner] Decomposition attempt ${attempt + 1}/${this.config.maxRetries + 1}`);

                // Get available tools from registry
                const availableTools = await this._getAvailableTools();

                const response = await Promise.race([
                    executionContext.provider.complete({
                        messages: [...messages, { role: 'user', content: userPrompt }],
                        systemPrompt,
                        tools: availableTools, // Pass tools as structured data
                        options: {
                            temperature: this.config.temperature,
                            maxTokens: this.config.maxTokens,
                            topP: this.config.topP
                        }
                    }),
                    this._createTimeout(this.config.timeoutMs)
                ]);

                const parsed = this._parseLLMResponse(response?.content || response);
                if (!parsed || !parsed.subtasks || parsed.subtasks.length === 0) {
                    throw new Error('Invalid task plan');
                }

                console.log(`[Planner] Successfully parsed and streaming plan to client with ${parsed.subtasks.length} subtasks`);

                return {
                    status: 'planner_completed',
                    subtasks: parsed.subtasks,
                    rationale: parsed.rationale,
                    goal: userMessage,
                    timestamp: Date.now()
                };
            } catch (error) {
                lastError = error;
                console.warn(`[Planner] Attempt ${attempt + 1} failed: ${error.message}`);

                if (attempt === this.config.maxRetries) {
                    throw new Error(`Decomposition failed: ${lastError.message}`);
                }

                const delay = this._calculateBackoff(attempt, this.config.retryBackoff);
                await this._sleep(delay);
            }
        }
    }

    /**
     * Calculate backoff delay
     * @private
     */
    _calculateBackoff(attempt, strategy) {
        const base = 500;
        return strategy === 'exponential' ? base * Math.pow(2, attempt) : base * (attempt + 1);
    }

    /**
     * Sleep helper
     * @private
     */
    _sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    /**
     * Timeout helper
     * @private
     */
    _createTimeout(ms) {
        return new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms));
    }

    /**
     * Get available tools from registry
     * @private
     */
    async _getAvailableTools() {
        // Import registry dynamically to avoid circular dependencies
        try {
            const { registry } = await import('../tools/index.js');

            const tools = [];
            const allTools = registry.listTools();

            // Filter by module if specified
            for (const tool of allTools) {
                tools.push({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: registry.getSchema(tool.name)
                });
            }

            console.log(`[Planner] Loaded ${tools.length} tools from registry`);
            return tools;
        } catch (error) {
            console.warn(`[Planner] Could not load tools from registry: ${error.message}`);
            return [];
        }
    }

    /**
     * Build system prompt for LLM
     */
    _buildSystemPrompt() {
        return getPrompt('planner');
    }

    /**
     * Build user prompt for LLM
     * @private
     */
    _buildUserPrompt(userMessage, executionContext) {
        let prompt = `Decompose the following goal into a hierarchical task plan:\n\n**Goal:** "${userMessage}"\n`;

        // Add EDIFACT analysis context if available
        const analysis = executionContext.analysisChat?.domainContext?.edifact?._analysis;
        if (analysis) {
            prompt += `\n**Context:** User has EDIFACT analysis data available:`;
            prompt += `\n- Message Type: ${analysis.messageHeader?.messageType || 'Unknown'}`;
            prompt += `\n- Standard: ${analysis.compliance?.standard || 'UN/EDIFACT'} ${analysis.compliance?.version || ''}`;
            prompt += `\n- Segments: ${analysis.segmentCount || 0}`;
            prompt += `\n- Errors: ${analysis.validation?.errorCount || 0}`;
            prompt += `\n- Warnings: ${analysis.validation?.warningCount || 0}`;
            prompt += `\n- Line Items: ${analysis.businessData?.lineItemCount || 0}`;
            prompt += `\n- Parties: ${analysis.parties?.length || 0}`;
            if (analysis.summary) {
                prompt += `\n- Summary: ${analysis.summary}`;
            }
        }

        prompt += `\n\nProvide the task plan in JSON format as specified.`;
        return prompt;
    }

    /**
     * Parse LLM response into task plan with robust JSON extraction
     * @private
     */
    _parseLLMResponse(responseText) {
        if (!responseText || typeof responseText !== 'string') {
            console.error(`[Planner._parseLLMResponse] Invalid input: not a string`);
            return null;
        }

        let jsonStr = null;

        try {
            // Strategy 1: Try to extract JSON from markdown code block
            const markdownMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (markdownMatch) {
                jsonStr = markdownMatch[1].trim();
                console.log(`[Planner._parseLLMResponse] Found JSON in markdown block`);
            }

            // Strategy 2: Try to extract raw JSON object
            if (!jsonStr) {
                // Find the first { and match it with the last }
                const openBrace = responseText.indexOf('{');
                if (openBrace !== -1) {
                    // Count braces to find matching closing brace
                    let braceCount = 0;
                    let closeBrace = -1;
                    for (let i = openBrace; i < responseText.length; i++) {
                        if (responseText[i] === '{') braceCount++;
                        if (responseText[i] === '}') braceCount--;
                        if (braceCount === 0) {
                            closeBrace = i;
                            break;
                        }
                    }

                    if (closeBrace > openBrace) {
                        jsonStr = responseText.substring(openBrace, closeBrace + 1);
                        console.log(`[Planner._parseLLMResponse] Extracted JSON from raw text`);
                    }
                }
            }

            // Strategy 3: Try to extract any JSON array or object (fallback)
            if (!jsonStr) {
                const anyJsonMatch = responseText.match(/[\{\[][\s\S]*[\}\]]/);
                if (anyJsonMatch) {
                    jsonStr = anyJsonMatch[0];
                    console.log(`[Planner._parseLLMResponse] Using fallback JSON extraction`);
                }
            }

            if (!jsonStr) {
                console.error(`[Planner._parseLLMResponse] Could not extract JSON from response`);
                console.error(`[Planner._parseLLMResponse] Response preview: ${responseText.substring(0, 200)}`);
                return null;
            }

            // Parse JSON
            const parsed = JSON.parse(jsonStr);

            // Validate structure
            if (!Array.isArray(parsed.subtasks)) {
                console.error(`[Planner._parseLLMResponse] Missing or invalid subtasks array`);
                return null;
            }

            if (parsed.subtasks.length === 0) {
                console.error(`[Planner._parseLLMResponse] Subtasks array is empty`);
                return null;
            }

            // Ensure all subtasks have required fields
            parsed.subtasks = parsed.subtasks.map((task, idx) => {
                if (!task.name) {
                    console.warn(`[Planner._parseLLMResponse] Task ${idx} missing name, using default`);
                }

                return {
                    id: task.id || `task_${idx}`,
                    name: task.name || `Task ${idx + 1}`,
                    description: task.description || '',
                    tools: Array.isArray(task.tools) ? task.tools : [],
                    effort: ['LOW', 'MEDIUM', 'HIGH'].includes(task.effort) ? task.effort : 'MEDIUM',
                    dependencies: Array.isArray(task.dependencies) ? task.dependencies : []
                };
            });

            console.log(`[Planner._parseLLMResponse] Successfully parsed ${parsed.subtasks.length} subtasks`);
            return parsed;

        } catch (error) {
            console.error(`[Planner._parseLLMResponse] JSON parsing failed: ${error.message}`);
            if (jsonStr) {
                console.error(`[Planner._parseLLMResponse] Failed JSON: ${jsonStr.substring(0, 300)}`);
            }
            return null;
        }
    }

    /**
     * Build task graph (determine execution order and dependencies)
     * @private
     */
    _buildTaskGraph(subtasks, goal, rationale) {
        if (!subtasks || subtasks.length === 0) {
            return {
                goal,
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
            goal,
            subtasks: normalizedTasks,
            execution_order: executionOrder,
            parallelizable_groups: parallelGroups,
            critical_path: criticalPath,
            critical_path_length: criticalPath.length,
            total_estimated_duration_ms: this._calculateTotalDuration(normalizedTasks, executionOrder),
            task_count: normalizedTasks.length,
            rationale: rationale || `Decomposed into ${normalizedTasks.length} task(s) with ${executionOrder.length} sequential steps`
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
     * @private
     */
    _finalizeResult(taskPlan, goal, source, startTime) {
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
     * @private
     */
    _defaultResult(goal, error, startTime) {
        console.error(`[Planner._defaultResult] Error: ${error}`);

        return {
            goal,
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
