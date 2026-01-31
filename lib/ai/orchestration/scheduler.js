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
 * - Available agents (Router, Planner, Executor, Critic, Memory, Recovery)
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

export class Scheduler {
    constructor(config = {}) {
        this.config = {
            maxParallel: 3,
            timeoutPerTaskMs: 30000,
            maxReplanAttempts: 2,
            enableMetrics: true,
            ...config
        };
    }

    /**
     * Execute task tree (DAG of subtasks)
     *
     * @param {object} params
     * @param {object} params.taskTree - Task tree from Planner
     * @param {object} params.agents - Available agents { executor, critic, recovery, planner, memory }
     * @param {object} params.context - Execution context (domain, analysis, socket, etc)
     * @param {object} params.messages - Chat messages
     * @returns {promise<object>} Execution result
     */
    async execute({ taskTree, agents, context = {}, messages = [] }) {
        const startTime = Date.now();
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
                replans: 0,
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
            let replanCount = 0;

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
                const socket = context?.socket;
                if (socket && typeof socket.emit === 'function') {
                    console.log(`[Scheduler] Emitting task_started: ${task.name} (${completedTasks.size + 1}/${depGraph.tasks.length})`);
                    socket.emit('agent:step', {
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
                }

                try {
                    // Step 4: Execute task via Executor with dependency results
                    const taskResult = await this._executeTask(
                        task,
                        agents,
                        context,
                        messages,
                        dependencyResults // Pass previous task results
                    );

                    // Step 5: Validate via Critic
                    const validation = await this._validateTask(
                        taskResult,
                        agents,
                        task,
                        context
                    );

                    if (!validation.valid) {
                        // Recovery: retry or replan
                        if (replanCount < this.config.maxReplanAttempts) {
                            console.warn(`[Scheduler] Task ${taskId} validation failed. Replanning...`);
                            replanCount++;
                            result.metrics.replans++;

                            // Stream validation failure
                            if (socket && typeof socket.emit === 'function') {
                                socket.emit('agent:step', {
                                    step: 'task_validation_failed',
                                    taskId: taskId,
                                    taskName: task.name,
                                    message: `Validierung fehlgeschlagen: ${task.name}`,
                                    timestamp: Date.now()
                                });
                            }

                            // TODO: Invoke Planner to redecompose
                            // For now, just mark as failed
                            result.subtaskResults[taskId] = {
                                success: false,
                                error: validation.errors.join(', '),
                                retried: true
                            };
                            result.metrics.tasksFailed++;
                        } else {
                            result.subtaskResults[taskId] = {
                                success: false,
                                error: 'Max replan attempts exceeded'
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
                            toolsCalled: taskResult.toolCalls?.length || 0
                        };
                        result.metrics.toolsCalled += taskResult.toolCalls?.length || 0;
                        result.metrics.tasksCompleted++;
                        completedTasks.add(taskId);
                        
                        // Stream task completion
                        if (socket && typeof socket.emit === 'function') {
                            console.log(`[Scheduler] Emitting task_completed: ${task.name} (${completedTasks.size}/${depGraph.tasks.length})`);
                            socket.emit('agent:step', {
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
                    }

                } catch (taskError) {
                    console.error(`[Scheduler] Task ${taskId} execution failed:`, taskError);
                    
                    // Try recovery
                    if (agents.recovery) {
                        const recovery = await agents.recovery.invoke({
                            error: taskError,
                            currentProvider: context.provider,
                            executionState: { startTime }
                        });

                        result.subtaskResults[taskId] = {
                            success: false,
                            error: taskError.message,
                            recovery: recovery.action
                        };
                    } else {
                        result.subtaskResults[taskId] = {
                            success: false,
                            error: taskError.message
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
     * Execute a single task via Executor
     * @private
     */
    async _executeTask(task, agents, context, messages, dependencyResults = {}) {
        if (!agents.executor) {
            throw new Error('Executor agent required');
        }

        try {
            // Build task context with previous results
            let taskDescription = task.description;
            
            // Add previous task results to context if available
            if (Object.keys(dependencyResults).length > 0) {
                taskDescription += '\n\n**Previous Task Results:**\n';
                for (const [depId, depResult] of Object.entries(dependencyResults)) {
                    if (depResult.toolResults && depResult.toolResults.length > 0) {
                        taskDescription += '\n**Tool Results:**\n';
                        for (const tr of depResult.toolResults) {
                            taskDescription += `- ${tr.tool}: ${JSON.stringify(tr.result, null, 2)}\n`;
                        }
                    }
                    if (depResult.assistantMessage) {
                        taskDescription += `\n**Analysis:**\n${depResult.assistantMessage}\n`;
                    }
                }
                taskDescription += '\n**Use the above information to complete your task.**';
            }
            
            // Call Executor with task and previous results
            const invokeParams = {
                messages: [...messages, { role: 'user', content: taskDescription }],
                context: { 
                    ...context, 
                    currentTask: task,
                    previousResults: dependencyResults // Also pass as structured data
                },
                provider: context.provider
            };
            
            // Only pass toolNames if task specifies tools
            if (task.tools && task.tools.length > 0) {
                invokeParams.toolNames = task.tools;
            }
            
            const result = await agents.executor.invoke(invokeParams);

            return {
                taskId: task.id,
                success: result.success,
                result: result,
                toolCalls: result.toolCalls || [],
                toolResults: result.toolResults || [],
                assistantMessage: result.assistantMessage
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
    async _validateTask(taskResult, agents, task, context) {
        if (!agents.critic) {
            // No critic, assume valid
            return { valid: true, errors: [] };
        }

        try {
            const validation = await agents.critic.invoke({
                output: taskResult.result,
                context: { ...context, task }
            });

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

    /**
     * Get execution metrics
     */
    getMetrics() {
        return this.config.enableMetrics ? { ...this.metrics } : null;
    }
}
