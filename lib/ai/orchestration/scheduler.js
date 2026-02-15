/**
 * Coordinator / Task Scheduler
 * ============================
 * Purpose: Execute task trees as DAGs with support for parallel and sequential subtasks.
 *
 * Responsibilities:
 * - Receive task tree from Planner Agent
 * - Parse dependencies (which tasks must run first)
 * - Schedule subtasks respecting dependency graph
 * - Execute subtasks in parallel where possible
 * - Track completion status and handle failures
 * - Coordinate with Executor, Critic, Memory, and Recovery agents
 * - Persist execution state for replay
 * - Report progress and metrics
 *
 * Inputs:
 * - Task tree (from Planner)
 *   {
 *     goal, subtasks: [{ id, name, dependencies }], execution_order
 *   }
 * - Available agents (Planner, Executor, Critic, Memory, Recovery)
 * - Execution config (max_parallel, timeout_per_task, max_iterations)
 *
 * Outputs:
 * - Execution result:
 *   {
 *     goal_completed: boolean,
 *     subtask_results: { [taskId]: result },
 *     execution_trace: [...],
 *     total_duration_ms: number,
 *     metrics: { tasks_run, tools_called, api_cost }
 *   }
 * - Updated task tree (if replanning occurred)
 * - Execution log (persisted for audit/replay)
 *
 * Execution Flow:
 * 1. Load task tree
 * 2. For each subtask:
 *    a. Check dependencies (wait for parent tasks)
 *    b. Invoke Executor for task
 *    c. Collect results
 *    d. Invoke Critic to validate
 *    e. If Critic rejects: invoke Recovery or Planner
 *    f. Persist state
 * 3. Handle parallel subtasks (worker pool or async/await)
 * 4. Return final results
 *
 * Parallelization:
 * - Tasks with no interdependencies run in parallel
 * - Configurable worker pool size
 * - Resource-aware scheduling (don't overload)
 *
 * Implementation Notes:
 * - Stateful: tracks execution progress (stored in DB)
 * - Fault-tolerant: can resume from checkpoint if interrupted
 * - Deterministic: same task tree + seed → reproducible execution
 * - Audit trail: every step logged
 *
 * Metrics:
 * - Tasks completed / total
 * - Tools called (per provider)
 * - API cost (if tracked)
 * - Execution duration per subtask
 * - Replan count
 *
 * Provider-Agnostic: Scheduler doesn't care which LLM is used.
 */
import { EventEmitter } from 'events';
import { validate as edifactValidate } from '../../../_modules/edifact/validators/edifactValidator.js';
import { registry } from '../tools/index.js';
export class Scheduler extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            maxParallel: 3,
            timeoutPerTaskMs: 30000,
            enableMetrics: true,
            ...config
        };
        this.currentExecution = null;
    }

    /**
     * Reset scheduler state for next execution
     */
    reset() {
        this.currentExecution = null;
        console.log('[Scheduler] State reset');
    }

    /**
     * Execute task tree (DAG of subtasks)
     *
     * @param {object} params
     * @param {object} params.taskTree - Task tree from Planner
     * @param {object} params.agents - Available agents { executor, critic, recovery, planner, memory }
     * @param {object} params.executionContext - Execution context (domain, provider, sessionId, etc)
     * @param {object} params.messages - Chat messages
     * @returns {promise<object>} Execution result
     */
    async execute({ taskTree, agents, executionContext = {}, messages = [] }) {
        const startTime = Date.now();
        
        // Validate provider in executionContext
        const provider = executionContext.provider;
        if (!provider) {
            throw new Error('Provider required in executionContext for Scheduler');
        }
        
        const result = {
            goal: taskTree.goal || 'Unknown goal',
            goalCompleted: false,
            subtaskResults: {},
            executionTrace: [],
            metrics: {
                tasksRun: 0,
                tasksCompleted: 0,
                tasksFailed: 0,
                toolsCalled: 0,
                duration_ms: 0
            },
            duration_ms: 0
        };

        try {
            // Step 1: Build dependency graph
            const depGraph = this._buildDependencyGraph(taskTree.subtasks || []);
            console.log(`[Scheduler] Loaded ${depGraph.tasks.length} subtasks`);

            // Step 2: Topologically sort tasks (respecting dependencies)
            const executionOrder = this._topologicalSort(depGraph);

            // Step 3: Execute tasks respecting dependencies
            const completedTasks = new Set();

            for (const taskId of executionOrder) {
                const task = depGraph.taskMap.get(taskId);
                if (!task) continue;

                result.metrics.tasksRun++;

                // Check if dependencies are met
                const dependencies = depGraph.dependencies.get(taskId) || [];
                const depsComplete = dependencies.every(d => completedTasks.has(d));

                if (!depsComplete) {
                    console.warn(`[Scheduler] Skipping task ${taskId}: dependencies not met`);
                    continue;
                }

                // Collect results from dependencies for context
                const dependencyResults = {};
                for (const depId of dependencies) {
                    if (result.subtaskResults[depId]) {
                        dependencyResults[depId] = result.subtaskResults[depId];
                    }
                }

                // Stream task start to client
                console.log(`[Scheduler] Emitting task_started: ${task.name} (${completedTasks.size + 1}/${depGraph.tasks.length})`);
                this.emit('agent_scheduler:step', {
                    step: 'task_started',
                    taskId: taskId,
                    taskName: task.name,
                    message: `Führe Task aus: ${task.name}`,
                    progress: {
                        current: completedTasks.size + 1,
                        total: depGraph.tasks.length
                    },
                    timestamp: Date.now()
                });

                try {
                    // Check if this is the last task
                    const isLastTask = (completedTasks.size + 1) === depGraph.tasks.length;

                    // Step 4: Execute task via Executor with dependency results
                    const taskResult = await this._executeTask(
                        task,
                        agents,
                        executionContext,
                        messages,
                        dependencyResults, // Pass previous task results
                        isLastTask // Tell Executor if this is the final task
                    );

                    // Step 4b: Check if replanning is needed (tool returned failure suggesting wrong approach)
                    const replanSignal = this._checkForReplanSignal(taskResult, task);
                    if (replanSignal) {
                        console.log(`[Scheduler] Replanning signal detected for task ${taskId}: ${replanSignal.reason}`);

                        result.subtaskResults[taskId] = {
                            success: false,
                            error: replanSignal.reason,
                            toolCalls: taskResult.toolCalls || [],
                            toolResults: taskResult.toolResults || [],
                            assistantMessage: taskResult.assistantMessage || '',
                            usage: taskResult.usage || null
                        };
                        result.metrics.tasksFailed++;

                        this.emit('agent_scheduler:step', {
                            step: 'task_replan_requested',
                            taskId: taskId,
                            taskName: task.name,
                            message: `Replanning: ${replanSignal.reason}`,
                            timestamp: Date.now()
                        });

                        // Return early with replanning signal
                        result.duration_ms = Date.now() - startTime;
                        result.metrics.duration_ms = result.duration_ms;
                        result.needsReplanning = true;
                        result.replanFeedback = {
                            source: 'scheduler',
                            reason: replanSignal.reason,
                            failedTaskId: taskId,
                            failedTaskName: task.name,
                            failedTools: replanSignal.failedTools,
                            suggestion: replanSignal.suggestion,
                            originalPlan: taskTree
                        };
                        return result;
                    }

                    // Step 4c: Check if Executor reported incomplete execution (e.g. uncalled mandatory tools)
                    if (!taskResult.success && taskResult.uncalledTools?.length > 0) {
                        console.warn(`[Scheduler] Task ${taskId} incomplete: uncalled tools: ${taskResult.uncalledTools.join(', ')}`);

                        this.emit('agent_scheduler:step', {
                            step: 'task_incomplete',
                            taskId: taskId,
                            taskName: task.name,
                            message: `⚠️ Task unvollstaendig: Tools nicht aufgerufen: ${taskResult.uncalledTools.join(', ')}`,
                            uncalledTools: taskResult.uncalledTools,
                            timestamp: Date.now()
                        });

                        // Still store partial results so dependent tasks can attempt to run
                        result.subtaskResults[taskId] = {
                            success: true, // Allow pipeline to continue with partial data
                            partial: true,
                            result: taskResult.result,
                            toolCalls: taskResult.toolCalls || [],
                            toolResults: taskResult.toolResults || [],
                            assistantMessage: taskResult.assistantMessage || '',
                            toolsCalled: taskResult.toolCalls?.length || 0,
                            uncalledTools: taskResult.uncalledTools,
                            usage: taskResult.usage || null
                        };
                        result.metrics.toolsCalled += taskResult.toolCalls?.length || 0;
                        result.metrics.tasksCompleted++;
                        completedTasks.add(taskId);

                        this.emit('agent_scheduler:step', {
                            step: 'task_completed',
                            taskId: taskId,
                            taskName: task.name,
                            message: `Task teilweise abgeschlossen: ${task.name}`,
                            partial: true,
                            uncalledTools: taskResult.uncalledTools,
                            progress: {
                                current: completedTasks.size,
                                total: depGraph.tasks.length
                            },
                            timestamp: Date.now()
                        });
                        continue; // Skip critic for incomplete tasks
                    }

                    // Step 5: Validate via Critic
                    const validation = await this._validateTask(
                        taskResult,
                        agents,
                        task,
                        executionContext,
                        result.subtaskResults
                    );

                    // Step 5b: Check if Critic recommends REPLAN (hallucinations, contradictions)
                    if (validation.recommendation === 'REPLAN') {
                        console.log(`[Scheduler] Critic recommends REPLAN for task ${taskId}: ${validation.errors.join(', ')}`);

                        result.subtaskResults[taskId] = {
                            success: false,
                            error: `Critic REPLAN: ${validation.errors.join(', ')}`,
                            toolCalls: taskResult.toolCalls || [],
                            toolResults: taskResult.toolResults || [],
                            assistantMessage: taskResult.assistantMessage || '',
                            usage: taskResult.usage || null
                        };
                        result.metrics.tasksFailed++;

                        this.emit('agent_scheduler:step', {
                            step: 'task_replan_requested',
                            taskId: taskId,
                            taskName: task.name,
                            message: `Replanning (Critic): ${validation.errors.join(', ')}`,
                            timestamp: Date.now()
                        });

                        result.duration_ms = Date.now() - startTime;
                        result.metrics.duration_ms = result.duration_ms;
                        result.needsReplanning = true;
                        result.replanFeedback = {
                            source: 'critic',
                            reason: `Critic REPLAN: ${validation.errors.join(', ')}`,
                            failedTaskId: taskId,
                            failedTaskName: task.name,
                            failedTools: task.tools || [],
                            suggestion: 'Replan to avoid hallucinations or inconsistencies',
                            originalPlan: taskTree
                        };
                        return result;
                    }

                    if (!validation.valid) {
                        // PRAGMATIC: Treat as partial success if we have an assistantMessage
                        // This prevents blocking the entire pipeline on lenient validation (FIX-level)
                        if (taskResult.assistantMessage && taskResult.assistantMessage.length > 0) {
                            console.warn(`[Scheduler] Task ${taskId} validation failed, but has output. Treating as partial success.`);

                            // Mark as success with warnings
                            result.subtaskResults[taskId] = {
                                success: true, // Allow dependent tasks to run
                                result: taskResult.result,
                                toolCalls: taskResult.toolCalls || [],
                                toolResults: taskResult.toolResults || [],
                                assistantMessage: taskResult.assistantMessage,
                                toolsCalled: taskResult.toolCalls?.length || 0,
                                validationWarnings: validation.errors, // Keep warnings for audit
                                usage: taskResult.usage || null  // Include usage from executor
                            };
                            result.metrics.toolsCalled += taskResult.toolCalls?.length || 0;
                            result.metrics.tasksCompleted++;
                            completedTasks.add(taskId);

                            // Emit task_completed with validation warnings (NOT task_validation_failed)
                            // task_validation_failed is reserved for hard failures (no output)
                            console.log(`[Scheduler] Emitting task_completed (with warnings): ${task.name} (${completedTasks.size}/${depGraph.tasks.length})`);
                            this.emit('agent_scheduler:step', {
                                step: 'task_completed',
                                taskId: taskId,
                                taskName: task.name,
                                message: `Task abgeschlossen (mit Warnungen): ${task.name}`,
                                validationWarnings: validation.errors,
                                progress: {
                                    current: completedTasks.size,
                                    total: depGraph.tasks.length
                                },
                                timestamp: Date.now()
                            });
                        } else {
                            // No output - treat as hard failure
                            console.error(`[Scheduler] Task ${taskId} validation failed with no output. Hard failure.`);

                            this.emit('agent_scheduler:step', {
                                step: 'task_validation_failed',
                                taskId: taskId,
                                taskName: task.name,
                                message: `❌ Validierung fehlgeschlagen: ${validation.errors.join(', ')}`,
                                timestamp: Date.now()
                            });

                            result.subtaskResults[taskId] = {
                                success: false,
                                usage: taskResult.usage || null,  // Include usage even on failure
                                error: validation.errors.join(', '),
                                assistantMessage: taskResult.assistantMessage || ''
                            };
                            result.metrics.tasksFailed++;
                        }
                    } else {
                        // Task successful
                        result.subtaskResults[taskId] = {
                            success: true,
                            result: taskResult.result,
                            toolCalls: taskResult.toolCalls || [],
                            toolResults: taskResult.toolResults || [],
                            assistantMessage: taskResult.assistantMessage,
                            toolsCalled: taskResult.toolCalls?.length || 0,
                            usage: taskResult.usage || null  // Include usage from executor
                        };
                        result.metrics.toolsCalled += taskResult.toolCalls?.length || 0;
                        result.metrics.tasksCompleted++;
                        completedTasks.add(taskId);

                        // Stream task completion
                        console.log(`[Scheduler] Emitting task_completed: ${task.name} (${completedTasks.size}/${depGraph.tasks.length})`);
                        this.emit('agent_scheduler:step', {
                            step: 'task_completed',
                            taskId: taskId,
                            taskName: task.name,
                            message: `Task abgeschlossen: ${task.name}`,
                            progress: {
                                current: completedTasks.size,
                                total: depGraph.tasks.length
                            },
                            timestamp: Date.now()
                        });
                    }

                } catch (taskError) {
                    console.error(`[Scheduler] Task ${taskId} execution failed:`, taskError);

                    // Try recovery
                    if (agents.recovery) {
                        const recovery = await agents.recovery.invoke({
                            error: taskError,
                            currentProvider: executionContext.provider,
                            executionState: { startTime }
                        });

                        result.subtaskResults[taskId] = {
                            success: false,
                            error: taskError.message,
                            recovery: recovery.action,
                            usage: null  // No usage on error (execution didn't complete)
                        };
                    } else {
                        result.subtaskResults[taskId] = {
                            success: false,
                            error: taskError.message,
                            usage: null  // No usage on error
                        };
                    }

                    result.metrics.tasksFailed++;
                }

                // Log execution step
                result.executionTrace.push({
                    taskId,
                    name: task.name,
                    status: result.subtaskResults[taskId]?.success ? 'completed' : 'failed',
                    timestamp: new Date().toISOString()
                });
            }

            // Step 6: Determine if goal is completed
            result.goalCompleted = result.metrics.tasksFailed === 0 &&
                result.metrics.tasksCompleted > 0;

            console.log(`[Scheduler] Execution complete: ${result.metrics.tasksCompleted}/${result.metrics.tasksRun} tasks successful`);

        } catch (error) {
            console.error('[Scheduler] Execution error:', error);
            result.goalCompleted = false;
            result.executionTrace.push({
                type: 'ERROR',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }

        result.duration_ms = Date.now() - startTime;
        result.metrics.duration_ms = result.duration_ms;
        result.timestamp = new Date().toISOString();

        return result;
    }

    /**
     * Check if task uses EDIFACT tools (resolved dynamically from registry)
     * @private
     */
    _taskHasEdifactTools(task) {
        if (!task.tools || task.tools.length === 0) return false;
        const edifactTools = registry.listTools({ module: 'edifact' }).map(t => t.name);
        return task.tools.some(t => edifactTools.includes(t));
    }

    /**
     * Build dependency graph from task list
     * @private
     */
    _buildDependencyGraph(subtasks) {
        const taskMap = new Map();
        const dependencies = new Map();

        for (const task of subtasks) {
            taskMap.set(task.id, task);
            dependencies.set(task.id, task.dependencies || []);
        }

        return { tasks: subtasks, taskMap, dependencies };
    }

    /**
     * Check if a task result contains signals that require replanning.
     * E.g. a tool fails because the format is not supported → replan with alternative tools.
     * @private
     * @param {object} taskResult - Result from _executeTask
     * @param {object} task - The task definition
     * @returns {object|null} Replan signal or null
     */
    _checkForReplanSignal(taskResult, task) {
        if (!taskResult.toolResults || taskResult.toolResults.length === 0) return null;

        // Check for tool-level failures that indicate wrong approach
        for (const tr of taskResult.toolResults) {
            if (tr.success) continue;

            const errorMsg = tr.result?.error || tr.error || '';

            // Generic pattern: any analysis tool returns a "not supported" or "unknown format" error
            if (errorMsg.match(/not supported|unknown format|cannot parse|unrecognized/i)) {
                return {
                    reason: `Tool "${tr.tool}" cannot handle this format: ${errorMsg}`,
                    failedTools: [tr.tool],
                    suggestion: `Try alternative tools or LLM-based analysis (createEdiAnalysis) for this format`
                };
            }
        }

        return null;
    }

    /**
     * Topological sort: order tasks respecting dependencies
     * @private
     */
    _topologicalSort(depGraph) {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();

        const visit = (taskId) => {
            if (visited.has(taskId)) return;
            if (visiting.has(taskId)) {
                console.warn(`[Scheduler] Circular dependency detected at ${taskId}`);
                return;
            }

            visiting.add(taskId);

            // Visit dependencies first
            const deps = depGraph.dependencies.get(taskId) || [];
            for (const dep of deps) {
                visit(dep);
            }

            visiting.delete(taskId);
            visited.add(taskId);
            sorted.push(taskId);
        };

        // Visit all tasks
        for (const task of depGraph.tasks) {
            visit(task.id);
        }

        return sorted;
    }

    /**
     * Compare LLM-generated text against actual tool results to detect
     * severity overrides, fabricated metrics, or contradictions.
     * Returns hallucination objects for the Critic.
     * @private
     */
    _checkToolResultConsistency(output, priorResults) {
        const hallucinations = [];
        const assistantText = typeof output === 'string'
            ? output
            : output?.assistantMessage || output?.result || '';

        if (!assistantText) return hallucinations;

        // Collect actual metrics from all tool results
        const actualMetrics = { errors: 0, warnings: 0, info: 0 };
        const toolSeverities = []; // Track individual findings and their severities

        for (const [taskId, taskData] of Object.entries(priorResults)) {
            if (!taskData.toolResults) continue;

            for (const tr of taskData.toolResults) {
                if (!tr.result || !tr.success) continue;
                const r = tr.result;

                // validateRules
                if (r.violations) {
                    for (const v of r.violations) {
                        const sev = (v.severity || 'info').toLowerCase();
                        if (sev === 'error') actualMetrics.errors++;
                        else if (sev === 'warning') actualMetrics.warnings++;
                        else actualMetrics.info++;
                        toolSeverities.push({ tool: tr.tool, severity: sev, message: v.message || v.rule });
                    }
                }

                // checkCompliance
                if (r.issues) {
                    for (const issue of r.issues) {
                        const sev = (issue.severity || 'info').toLowerCase();
                        if (sev === 'error') actualMetrics.errors++;
                        else if (sev === 'warning') actualMetrics.warnings++;
                        else actualMetrics.info++;
                        toolSeverities.push({ tool: tr.tool, severity: sev, message: issue.message });
                    }
                }

                // detectAnomalies
                if (r.anomalies) {
                    for (const a of r.anomalies) {
                        const sev = (a.severity || 'info').toLowerCase();
                        if (sev === 'error') actualMetrics.errors++;
                        else if (sev === 'warning') actualMetrics.warnings++;
                        else actualMetrics.info++;
                        toolSeverities.push({ tool: tr.tool, severity: sev, message: a.message });
                    }
                }
            }
        }

        // Extract claimed metrics from LLM text ([[metric:N|Errors:error]] pattern)
        const metricPattern = /\[\[metric:(\d+)\|(\w+)(?::(\w+))?\]\]/gi;
        let metricMatch;
        while ((metricMatch = metricPattern.exec(assistantText)) !== null) {
            const claimedCount = parseInt(metricMatch[1], 10);
            const label = metricMatch[2].toLowerCase();

            let actualCount = null;
            if (label === 'errors' || label === 'error') actualCount = actualMetrics.errors;
            else if (label === 'warnings' || label === 'warning') actualCount = actualMetrics.warnings;
            else if (label === 'info') actualCount = actualMetrics.info;

            if (actualCount !== null && claimedCount !== actualCount) {
                hallucinations.push({
                    claim: `LLM claims ${claimedCount} ${label}`,
                    fact_check: `Tool results show ${actualCount} ${label}`,
                    confidence: 0.95,
                    severity: 'error'
                });
                console.error(`[Scheduler] Metric mismatch: LLM claims ${claimedCount} ${label}, tools reported ${actualCount}`);
            }
        }

        // Extract claimed metrics from badge pattern ([[badge:N Label:color]])
        const badgePattern = /\[\[badge:(\d+)\s+(errors?|warnings?|info|anomal(?:y|ies))(?:\s+items?)?:(\w+)\]\]/gi;
        let badgeMatch;
        while ((badgeMatch = badgePattern.exec(assistantText)) !== null) {
            const claimedCount = parseInt(badgeMatch[1], 10);
            const label = badgeMatch[2].toLowerCase();

            let actualCount = null;
            if (label === 'errors' || label === 'error') actualCount = actualMetrics.errors;
            else if (label === 'warnings' || label === 'warning') actualCount = actualMetrics.warnings;
            else if (label.startsWith('info') || label.startsWith('anomal')) actualCount = actualMetrics.info;

            if (actualCount !== null && claimedCount !== actualCount) {
                hallucinations.push({
                    claim: `LLM badge claims ${claimedCount} ${label}`,
                    fact_check: `Tool results show ${actualCount} ${label}`,
                    confidence: 0.95,
                    severity: 'error'
                });
                console.error(`[Scheduler] Badge metric mismatch: LLM claims ${claimedCount} ${label}, tools reported ${actualCount}`);
            }
        }

        // Check for severity upgrades in text (e.g., "treated as error" for info-level items)
        const severityUpgradePatterns = [
            /treated\s+as\s+(an?\s+)?error/gi,
            /should\s+be\s+(considered|classified|treated)\s+(as\s+)?(an?\s+)?error/gi,
            /elevated?\s+to\s+error/gi,
            /escalat(e|ed|ing)\s+to\s+error/gi
        ];

        for (const pattern of severityUpgradePatterns) {
            if (pattern.test(assistantText)) {
                hallucinations.push({
                    claim: 'LLM upgraded severity of a tool finding',
                    fact_check: 'Tool severities are authoritative and must not be overridden by the LLM',
                    confidence: 0.8,
                    severity: 'warning'
                });
                console.warn('[Scheduler] Detected severity upgrade language in LLM output');
                break;
            }
        }

        return hallucinations;
    }

    /**
     * Execute a single task via Executor
     * @private
     */
    async _executeTask(task, agents, executionContext, messages, dependencyResults = {}, isLastTask = false) {
        if (!agents.executor) {
            throw new Error('Executor agent required');
        }

        try {
            // Build task context with previous results
            let taskDescription = task.description;

            // Add mandatory tool instruction so the LLM calls ALL assigned tools
            if (task.tools && task.tools.length > 0) {
                taskDescription += '\n\n**MANDATORY Tools for this task:** ' + task.tools.join(', ') + '\n';
                taskDescription += 'You MUST call each of these tools. Do NOT skip any tool, even if previous results suggest no issues. Each tool provides unique analysis that is required.';
            }

            // Only inject raw EDIFACT for tasks that actually have EDIFACT tools
            const taskNeedsRawEdifact = this._taskHasEdifactTools(task);

            if (executionContext.rawEdifact && taskNeedsRawEdifact) {
                taskDescription += '\n\n**Available EDIFACT Data:**\n';
                taskDescription += 'The following raw EDIFACT message is available for analysis. ';
                taskDescription += 'Pass it as the `raw` parameter when calling EDIFACT tools.\n\n';
                taskDescription += '```\n' + executionContext.rawEdifact + '\n```';
            }

            // Add previous task results to context (compact, truncated)
            if (Object.keys(dependencyResults).length > 0) {
                taskDescription += '\n\n**Previous Task Results:**\n';
                for (const [depId, depResult] of Object.entries(dependencyResults)) {
                    if (depResult.toolResults && depResult.toolResults.length > 0) {
                        taskDescription += '\n**Tool Results:**\n';
                        for (const tr of depResult.toolResults) {
                            const resultStr = JSON.stringify(tr.result);
                            const truncated = resultStr.length > 800
                                ? resultStr.substring(0, 800) + '...[truncated]'
                                : resultStr;
                            taskDescription += `- ${tr.tool}: ${truncated}\n`;
                        }
                    }
                    if (depResult.assistantMessage) {
                        const msg = depResult.assistantMessage;
                        const truncMsg = msg.length > 500
                            ? msg.substring(0, 500) + '...[truncated]'
                            : msg;
                        taskDescription += `\n**Analysis:**\n${truncMsg}\n`;
                    }
                }
                taskDescription += '\n**Use the above information to complete your task.**';
            }

            // Call Executor with task and previous results (provider from context)
            const invokeParams = {
                messages: [...messages, { role: 'user', content: taskDescription }],
                context: {
                    ...executionContext,
                    currentTask: task,
                    previousResults: dependencyResults, // Also pass as structured data
                    isLastTask: isLastTask // Tell Executor to stream as response:chunk if last
                }
            };

            // Pass toolNames: explicit list if task has tools, empty array if not.
            // NEVER leave undefined (executor would load ALL tools as fallback).
            invokeParams.toolNames = (task.tools && task.tools.length > 0) ? task.tools : [];

            const result = await agents.executor.invoke(invokeParams);

            return {
                taskId: task.id,
                success: result.success,
                result: result,
                toolCalls: result.toolCalls || [],
                toolResults: result.toolResults || [],
                assistantMessage: result.assistantMessage,
                uncalledTools: result.uncalledTools || [],  // Forward to scheduler for Step 4b
                usage: result.usage || null  // ✨ Include usage from executor
            };
        } catch (error) {
            console.error(`[Scheduler._executeTask] Failed:`, error);
            throw error;
        }
    }

    /**
     * Validate task result via Critic
     * @private
     */
    async _validateTask(taskResult, agents, task, executionContext, priorResults = {}) {
        if (!agents.critic) {
            // No critic, assume valid
            return { valid: true, errors: [] };
        }

        try {
            // Build validators object for EDIFACT tasks
            const validators = {};

            // Wire the rules validator when raw EDIFACT data is available
            // and the task involves EDIFACT tools (resolved from registry, not hardcoded)
            const taskHasEdifactTools = this._taskHasEdifactTools(task);

            if (taskHasEdifactTools && executionContext.rawEdifact) {
                validators.rules = async (output, context) => {
                    try {
                        const validationResult = edifactValidate(executionContext.rawEdifact);

                        // Adapt edifactValidator output to Critic's expected format
                        const errors = validationResult.failures
                            .filter(f => f.severity === 'error')
                            .map(f => ({ field: f.ruleId, message: f.message }));
                        const warnings = validationResult.failures
                            .filter(f => f.severity === 'warning' || f.severity === 'info')
                            .map(f => ({ message: `[${f.ruleId}] ${f.message}` }));

                        return { errors, warnings };
                    } catch (err) {
                        console.error('[Scheduler._validateTask] EDIFACT validation error:', err.message);
                        return { errors: [], warnings: [{ message: `Validator unavailable: ${err.message}` }] };
                    }
                };
            }

            // Wire fact-checker for text-generation tasks (final report)
            // Compares LLM-claimed metrics against actual tool results
            const isTextTask = !task.tools || task.tools.length === 0;
            if (isTextTask && Object.keys(priorResults).length > 0) {
                validators.factChecker = (output) => {
                    return this._checkToolResultConsistency(output, priorResults);
                };
            }

            const validation = await agents.critic.invoke({
                output: taskResult.result,
                validators,
                context: { ...executionContext, task },
                provider: executionContext.provider
            });

            // PRAGMATIC FIX: If task has no schema validators and just generates text,
            // be more lenient - treat warnings as non-fatal
            const hasOnlyWarnings = validation.errors.length === 0 && validation.warnings.length > 0;

            if (isTextTask && hasOnlyWarnings) {
                console.log(`[Scheduler._validateTask] Task ${task.id} has warnings but no errors. Treating as valid for text generation.`);
                return {
                    valid: true,
                    errors: [],
                    warnings: validation.warnings.map(w => w.message || w),
                    recommendation: validation.recommendation
                };
            }

            return {
                valid: validation.valid,
                errors: validation.errors.map(e => e.message),
                recommendation: validation.recommendation
            };
        } catch (error) {
            console.error(`[Scheduler._validateTask] Validation error:`, error);
            return {
                valid: false,
                errors: [error.message]
            };
        }
    }

}
