import { useState } from 'react';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Box,
    Typography,
    Chip,
    Paper,
    Divider,
    Collapse,
    IconButton
} from '@mui/material';
import Iconify from '@/app/_components/utils/Iconify';

/**
 * ChatMessageAgentDebug
 * Displays agent plan and execution progress
 * Shows:
 * 1. Initial agent plan with all subtasks (from agent:plan)
 * 2. Real-time task execution status (task_started, task_completed)
 * 
 * @param {Object} currentAgentState - Live agent state (wird nach completion gelöscht)
 * @param {Object} message - Persistierte Message (bleibt erhalten)
 */
function ChatMessageAgentDebug({ currentAgentState, message }) {
    const [expandedPanel, setExpandedPanel] = useState(false);
    const [reasoningExpanded, setReasoningExpanded] = useState({});

    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpandedPanel(isExpanded ? panel : false);
    };

    const toggleReasoning = (taskId) => {
        setReasoningExpanded(prev => ({
            ...prev,
            [taskId]: !prev[taskId]
        }));
    };

    // Lese Daten aus Message (persistiert) oder currentAgentState (live)
    const plan = message?.content?.agentPlan || currentAgentState?.plan;
    const steps = message?.content?.agentSteps || currentAgentState?.steps || [];
    
    // Task-spezifisches Reasoning
    const taskReasoning = message?.content?.taskReasoning || currentAgentState?.taskReasoning || {};
    
    // Helper to get reasoning for task
    const getTaskReasoning = (taskId) => {
        return taskReasoning[taskId] || '';
    };
    
    // Build task status map from steps
    const taskStatusMap = new Map();
    steps.forEach(step => {
        if (step.step === 'task_started' || step.step === 'task_completed') {
            const taskId = step.taskId;
            if (taskId) {
                const existing = taskStatusMap.get(taskId);
                if (!existing || step.step === 'task_completed') {
                    taskStatusMap.set(taskId, {
                        status: step.step === 'task_completed' ? 'completed' : 'running',
                        taskName: step.taskName,
                        progress: step.progress,
                        timestamp: step.timestamp
                    });
                }
            }
        }
    });

    // Helper to get task status
    const getTaskStatus = (taskId) => {
        return taskStatusMap.get(taskId) || { status: 'pending' };
    };

    // Helper to get effort color
    const getEffortColor = (effort) => {
        switch (effort?.toUpperCase()) {
            case 'LOW': return 'success';
            case 'MEDIUM': return 'warning';
            case 'HIGH': return 'error';
            default: return 'default';
        }
    };

    // Helper to get status icon and color
    const getStatusDisplay = (status) => {
        switch (status) {
            case 'completed':
                return { icon: 'mdi:check-circle', color: 'success.main', label: 'Completed' };
            case 'running':
                return { icon: 'mdi:play-circle', color: 'primary.main', label: 'Running' };
            case 'pending':
            default:
                return { icon: 'mdi:clock-outline', color: 'text.disabled', label: 'Pending' };
        }
    };

    // Don't show if no plan and no task steps
    if (!plan && taskStatusMap.size === 0) return null;

    // Don't show if no plan and no task steps
    if (!plan && taskStatusMap.size === 0) return null;

    return (
        <Box sx={{ mb: 2 }}>
            {/* Main Accordion for Agent Activity */}
            <Accordion
                expanded={expandedPanel === 'agent-debug'}
                onChange={handleAccordionChange('agent-debug')}
                sx={{
                    backgroundColor: 'background.default',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:before': { display: 'none' }
                }}
            >
                <AccordionSummary
                    expandIcon={<Iconify icon="mdi:chevron-down" />}
                    sx={{ minHeight: 48 }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Iconify icon="mdi:robot-outline" sx={{ color: 'primary.main', fontSize: 20 }} />
                        <Typography variant="body2" fontWeight={500}>
                            Agent Execution Plan
                        </Typography>
                        {plan?.subtasks && (
                            <Chip
                                label={`${plan.subtasks.length} tasks`}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                        )}
                        {taskStatusMap.size > 0 && (
                            <Chip
                                label={`${Array.from(taskStatusMap.values()).filter(t => t.status === 'completed').length}/${taskStatusMap.size} completed`}
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                        )}
                    </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {/* Goal & Rationale */}
                        {plan && (
                            <Box>
                                {plan.goal && (
                                    <Box sx={{ mb: 1 }}>
                                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                            Goal:
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                                            {plan.goal}
                                        </Typography>
                                    </Box>
                                )}
                                {plan.rationale && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                            Rationale:
                                        </Typography>
                                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                                            {plan.rationale}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        )}

                        {/* Subtasks */}
                        {plan?.subtasks && plan.subtasks.length > 0 && (
                            <>
                                <Divider />
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                    Tasks:
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {plan.subtasks.map((task, idx) => {
                                        const taskStatus = getTaskStatus(task.id);
                                        const statusDisplay = getStatusDisplay(taskStatus.status);
                                        
                                        return (
                                            <Paper
                                                key={task.id}
                                                variant="outlined"
                                                sx={{ 
                                                    p: 1.5, 
                                                    backgroundColor: 
                                                        taskStatus.status === 'completed' ? 'success.lighter' : 
                                                        taskStatus.status === 'running' ? 'primary.lighter' :
                                                        'background.default',
                                                    borderLeftWidth: 3,
                                                    borderLeftColor: statusDisplay.color,
                                                    opacity: taskStatus.status === 'pending' ? 0.7 : 1
                                                }}
                                            >
                                                {/* Task Header */}
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                    <Iconify 
                                                        icon={statusDisplay.icon} 
                                                        sx={{ 
                                                            color: statusDisplay.color, 
                                                            fontSize: 18,
                                                            ...(taskStatus.status === 'running' && {
                                                                animation: 'spin 2s linear infinite',
                                                                '@keyframes spin': {
                                                                    '0%': { transform: 'rotate(0deg)' },
                                                                    '100%': { transform: 'rotate(360deg)' }
                                                                }
                                                            })
                                                        }} 
                                                    />
                                                    <Typography 
                                                        variant="body2" 
                                                        fontWeight={600}
                                                        sx={{ flex: 1 }}
                                                    >
                                                        {task.name}
                                                    </Typography>
                                                    <Chip
                                                        label={task.id}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ 
                                                            height: 18, 
                                                            fontSize: '0.65rem',
                                                            fontFamily: 'monospace'
                                                        }}
                                                    />
                                                    {task.effort && (
                                                        <Chip
                                                            label={task.effort}
                                                            size="small"
                                                            color={getEffortColor(task.effort)}
                                                            sx={{ height: 18, fontSize: '0.65rem' }}
                                                        />
                                                    )}
                                                </Box>

                                                {/* Task Description */}
                                                <Typography 
                                                    variant="caption" 
                                                    color="text.secondary"
                                                    sx={{ display: 'block', mb: 1 }}
                                                >
                                                    {task.description}
                                                </Typography>

                                                {/* Dependencies */}
                                                {task.dependencies && task.dependencies.length > 0 && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Depends on:
                                                        </Typography>
                                                        {task.dependencies.map(depId => (
                                                            <Chip
                                                                key={depId}
                                                                label={depId}
                                                                size="small"
                                                                variant="outlined"
                                                                sx={{ 
                                                                    height: 16, 
                                                                    fontSize: '0.6rem',
                                                                    fontFamily: 'monospace'
                                                                }}
                                                            />
                                                        ))}
                                                    </Box>
                                                )}

                                                {/* Tools */}
                                                {task.tools && task.tools.length > 0 && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Tools:
                                                        </Typography>
                                                        {task.tools.map(tool => (
                                                            <Chip
                                                                key={tool}
                                                                label={tool}
                                                                size="small"
                                                                icon={<Iconify icon="mdi:wrench" sx={{ fontSize: 12 }} />}
                                                                sx={{ height: 16, fontSize: '0.6rem' }}
                                                            />
                                                        ))}
                                                    </Box>
                                                )}

                                                {/* Reasoning Section */}
                                                {(taskStatus.status === 'running' || taskStatus.status === 'completed') && getTaskReasoning(task.id) && (
                                                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                                                        <Box 
                                                            sx={{ 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                justifyContent: 'space-between',
                                                                cursor: 'pointer',
                                                                mb: reasoningExpanded[task.id] ? 1 : 0
                                                            }}
                                                            onClick={() => toggleReasoning(task.id)}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                <Iconify 
                                                                    icon="mdi:brain" 
                                                                    sx={{ fontSize: 14, color: 'info.main' }} 
                                                                />
                                                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                                                    Reasoning
                                                                </Typography>
                                                                {taskStatus.status === 'running' && (
                                                                    <Chip
                                                                        label="live"
                                                                        size="small"
                                                                        color="info"
                                                                        sx={{ height: 14, fontSize: '0.6rem' }}
                                                                    />
                                                                )}
                                                            </Box>
                                                            <IconButton size="small" sx={{ p: 0 }}>
                                                                <Iconify 
                                                                    icon={reasoningExpanded[task.id] ? 'mdi:chevron-up' : 'mdi:chevron-down'} 
                                                                    sx={{ fontSize: 16 }} 
                                                                />
                                                            </IconButton>
                                                        </Box>
                                                        <Collapse in={reasoningExpanded[task.id]}>
                                                            <Paper
                                                                variant="outlined"
                                                                sx={{
                                                                    p: 1,
                                                                    backgroundColor: 'background.neutral',
                                                                    maxHeight: '200px',
                                                                    overflowY: 'auto'
                                                                }}
                                                            >
                                                                <Typography
                                                                    variant="caption"
                                                                    component="pre"
                                                                    sx={{
                                                                        fontFamily: 'monospace',
                                                                        whiteSpace: 'pre-wrap',
                                                                        wordBreak: 'break-word',
                                                                        fontSize: '0.7rem',
                                                                        lineHeight: 1.5,
                                                                        margin: 0,
                                                                        color: 'text.secondary',
                                                                        fontStyle: taskStatus.status === 'running' ? 'italic' : 'normal'
                                                                    }}
                                                                >
                                                                    {getTaskReasoning(task.id) || 'Agent is thinking...'}
                                                                </Typography>
                                                            </Paper>
                                                        </Collapse>
                                                    </Box>
                                                )}

                                                {/* Progress Info */}
                                                {taskStatus.progress && (
                                                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Progress: {taskStatus.progress.current}/{taskStatus.progress.total}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Paper>
                                        );
                                    })}
                                </Box>
                            </>
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </Box>
    );
}

export default ChatMessageAgentDebug;
