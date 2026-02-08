import {
    Box,
    Chip,
    Collapse,
    Divider,
    IconButton,
    Paper,
    Tab,
    Tabs,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';

// app imports
import Iconify from '@/app/_components/utils/Iconify';

// ===== Segment color + icon mapping =====

const SEGMENT_META = {
    UNB: { color: '#7C3AED', icon: 'mdi:email-seal-outline', label: 'Interchange Header' },
    UNZ: { color: '#7C3AED', icon: 'mdi:email-check-outline', label: 'Interchange Trailer' },
    UNH: { color: '#2563EB', icon: 'mdi:file-document-outline', label: 'Message Header' },
    UNT: { color: '#2563EB', icon: 'mdi:file-check-outline', label: 'Message Trailer' },
    BGM: { color: '#0891B2', icon: 'mdi:identifier', label: 'Beginning of Message' },
    DTM: { color: '#059669', icon: 'mdi:calendar-clock', label: 'Date/Time' },
    NAD: { color: '#D97706', icon: 'mdi:domain', label: 'Party' },
    RFF: { color: '#9333EA', icon: 'mdi:link-variant', label: 'Reference' },
    CUX: { color: '#0D9488', icon: 'mdi:currency-eur', label: 'Currency' },
    PAT: { color: '#6366F1', icon: 'mdi:cash-clock', label: 'Payment Terms' },
    LIN: { color: '#DC2626', icon: 'mdi:package-variant', label: 'Line Item' },
    PIA: { color: '#EA580C', icon: 'mdi:barcode', label: 'Product ID' },
    IMD: { color: '#CA8A04', icon: 'mdi:text-box-outline', label: 'Description' },
    QTY: { color: '#16A34A', icon: 'mdi:counter', label: 'Quantity' },
    PRI: { color: '#E11D48', icon: 'mdi:tag-outline', label: 'Price' },
    MOA: { color: '#BE185D', icon: 'mdi:cash', label: 'Monetary Amount' },
    TAX: { color: '#7C2D12', icon: 'mdi:percent-outline', label: 'Tax' },
    UNS: { color: '#64748B', icon: 'mdi:swap-horizontal', label: 'Section Control' },
    CNT: { color: '#64748B', icon: 'mdi:sigma', label: 'Control Total' },
    FTX: { color: '#8B5CF6', icon: 'mdi:note-text-outline', label: 'Free Text' },
    ALC: { color: '#F59E0B', icon: 'mdi:sale', label: 'Allowance/Charge' },
    TDT: { color: '#0EA5E9', icon: 'mdi:truck-outline', label: 'Transport' },
    LOC: { color: '#10B981', icon: 'mdi:map-marker-outline', label: 'Location' },
    CTA: { color: '#F97316', icon: 'mdi:card-account-phone-outline', label: 'Contact' },
    COM: { color: '#F97316', icon: 'mdi:phone-outline', label: 'Communication' },
};

const DEFAULT_SEGMENT_META = { color: '#94A3B8', icon: 'mdi:code-tags', label: 'Segment' };

function _getSegmentMeta(tag) {
    return SEGMENT_META[tag] || DEFAULT_SEGMENT_META;
}

// ===== Status badge =====

function _StatusChip({ status, errorCount, warningCount }) {
    if (status === 'error') {
        return <Chip size="small" label="Error" color="error" icon={<Iconify icon="mdi:alert-circle" width={14} />} />;
    }
    if (errorCount > 0) {
        return <Chip size="small" label={`${errorCount} Errors`} color="error" icon={<Iconify icon="mdi:alert-circle" width={14} />} />;
    }
    if (warningCount > 0) {
        return <Chip size="small" label={`${warningCount} Warnings`} color="warning" icon={<Iconify icon="mdi:alert" width={14} />} />;
    }
    return <Chip size="small" label="Valid" color="success" icon={<Iconify icon="mdi:check-circle" width={14} />} />;
}

// ===== Tab Panel =====

function _TabPanel({ children, value, index }) {
    return (
        <Box role="tabpanel" hidden={value !== index} sx={{ pt: 1.5 }}>
            {value === index && children}
        </Box>
    );
}

// ===== Metric Card =====

function _MetricCard({ icon, label, value, color = 'primary.main' }) {
    return (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1,
            borderRadius: 1,
            bgcolor: 'action.hover',
            minWidth: 110,
        }}>
            <Iconify icon={icon} sx={{ fontSize: 20, color }} />
            <Box>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>
                    {label}
                </Typography>
                <Typography variant="subtitle2" sx={{ lineHeight: 1.3 }}>
                    {value}
                </Typography>
            </Box>
        </Box>
    );
}

// ===== Overview Tab =====

function _OverviewTab({ analysis }) {
    const {
        segmentCount,
        messageHeader,
        interchange,
        validation,
        compliance,
        parties,
        businessData,
        processing,
    } = analysis;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Key Metrics */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <_MetricCard
                    icon="mdi:format-list-numbered"
                    label="Segments"
                    value={segmentCount || 0}
                    color="info.main"
                />
                <_MetricCard
                    icon="mdi:file-document-multiple-outline"
                    label="Type"
                    value={messageHeader?.messageType || '—'}
                    color="primary.main"
                />
                <_MetricCard
                    icon="mdi:tag-outline"
                    label="Version"
                    value={messageHeader?.messageRelease ? `${messageHeader.messageVersion}${messageHeader.messageRelease}` : '—'}
                    color="secondary.main"
                />
                <_MetricCard
                    icon="mdi:certificate-outline"
                    label="Standard"
                    value={compliance?.standard || interchange?.syntaxIdentifier || '—'}
                    color="warning.main"
                />
                {compliance?.subset && (
                    <_MetricCard
                        icon="mdi:layers-outline"
                        label="Subset"
                        value={compliance.subset}
                        color="info.main"
                    />
                )}
                {businessData?.lineItemCount > 0 && (
                    <_MetricCard
                        icon="mdi:package-variant"
                        label="Line Items"
                        value={businessData.lineItemCount}
                        color="success.main"
                    />
                )}
            </Box>

            {/* Parties */}
            {parties && parties.length > 0 && (
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                        Parties
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {parties.map((party, index) => (
                            <Chip
                                key={index}
                                size="small"
                                variant="outlined"
                                icon={<Iconify icon="mdi:domain" width={14} />}
                                label={`${party.qualifier}: ${party.id}${party.name ? ` (${party.name})` : ''}`}
                            />
                        ))}
                    </Box>
                </Box>
            )}

            {/* Validation */}
            {validation && (
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                        Validation
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <_StatusChip
                            status={analysis.status}
                            errorCount={validation.errorCount}
                            warningCount={validation.warningCount}
                        />
                        {compliance?.isCompliant !== undefined && (
                            <Chip
                                size="small"
                                variant="outlined"
                                color={compliance.isCompliant ? 'success' : 'error'}
                                icon={<Iconify icon={compliance.isCompliant ? 'mdi:shield-check' : 'mdi:shield-alert'} width={14} />}
                                label={compliance.isCompliant ? 'Compliant' : 'Non-Compliant'}
                            />
                        )}
                    </Box>
                </Box>
            )}

            {/* Processing info */}
            {processing?.parsingDuration !== undefined && (
                <Typography variant="caption" color="text.disabled">
                    Parsed in {processing.parsingDuration || processing.totalDuration || 0}ms
                    {processing.tokenCount ? ` | ~${processing.tokenCount} tokens` : ''}
                </Typography>
            )}
        </Box>
    );
}

// ===== Segment Tree Tab =====

/**
 * Builds a hierarchical tree from flat segment list:
 * UNB → [UNH → [body segments...] → UNT] → UNZ
 * @private
 */
function _buildSegmentTree(segmentDetails, segments) {
    // Use segmentDetails if available, otherwise fall back to tag array
    const items = segmentDetails?.length > 0
        ? segmentDetails.map((sd, i) => ({ tag: sd.tag, position: sd.position || i + 1, content: sd.content }))
        : (segments || []).map((tag, i) => ({ tag, position: i + 1, content: '' }));

    if (items.length === 0) return [];

    const tree = [];
    let currentEnvelope = null;
    let currentMessage = null;

    for (const item of items) {
        if (item.tag === 'UNB') {
            currentEnvelope = { ...item, children: [] };
            tree.push(currentEnvelope);
        } else if (item.tag === 'UNZ') {
            if (currentEnvelope) {
                currentEnvelope.children.push(item);
                currentEnvelope = null;
            } else {
                tree.push(item);
            }
        } else if (item.tag === 'UNH') {
            currentMessage = { ...item, children: [] };
            if (currentEnvelope) {
                currentEnvelope.children.push(currentMessage);
            } else {
                tree.push(currentMessage);
            }
        } else if (item.tag === 'UNT') {
            if (currentMessage) {
                currentMessage.children.push(item);
                currentMessage = null;
            } else if (currentEnvelope) {
                currentEnvelope.children.push(item);
            } else {
                tree.push(item);
            }
        } else {
            if (currentMessage) {
                currentMessage.children.push(item);
            } else if (currentEnvelope) {
                currentEnvelope.children.push(item);
            } else {
                tree.push(item);
            }
        }
    }

    return tree;
}

function _SegmentNode({ item, depth = 0 }) {
    const hasChildren = item.children?.length > 0;
    const [expanded, setExpanded] = useState(depth < 2);
    const meta = _getSegmentMeta(item.tag);

    const isEnvelope = item.tag === 'UNB' || item.tag === 'UNZ';
    const isMessage = item.tag === 'UNH' || item.tag === 'UNT';

    return (
        <Box>
            <Box
                onClick={hasChildren ? () => setExpanded(prev => !prev) : undefined}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    py: 0.3,
                    px: 0.5,
                    pl: depth * 2 + 0.5,
                    borderRadius: 0.5,
                    cursor: hasChildren ? 'pointer' : 'default',
                    '&:hover': { bgcolor: 'action.hover' },
                    transition: 'background-color 0.15s',
                }}
            >
                {/* Expand/collapse or bullet */}
                {hasChildren ? (
                    <Iconify
                        icon={expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'}
                        sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }}
                    />
                ) : (
                    <Box sx={{ width: 16, flexShrink: 0 }} />
                )}

                {/* Segment icon */}
                <Iconify
                    icon={meta.icon}
                    sx={{ fontSize: 16, color: meta.color, flexShrink: 0 }}
                />

                {/* Tag badge */}
                <Box sx={{
                    px: 0.7,
                    py: 0.1,
                    borderRadius: 0.5,
                    bgcolor: alpha(meta.color, 0.12),
                    minWidth: 36,
                    textAlign: 'center',
                    flexShrink: 0,
                }}>
                    <Typography variant="caption" sx={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        color: meta.color,
                    }}>
                        {item.tag}
                    </Typography>
                </Box>

                {/* Label */}
                <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                    {meta.label}
                    {hasChildren && (
                        <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                            ({item.children.length})
                        </Typography>
                    )}
                </Typography>

                {/* Position */}
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', flexShrink: 0 }}>
                    #{item.position}
                </Typography>
            </Box>

            {/* Children */}
            {hasChildren && (
                <Collapse in={expanded}>
                    {item.children.map((child, index) => (
                        <_SegmentNode key={index} item={child} depth={depth + 1} />
                    ))}
                </Collapse>
            )}
        </Box>
    );
}

function _SegmentTreeTab({ analysis }) {
    const tree = _buildSegmentTree(analysis.segmentDetails, analysis.segments);

    if (tree.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No segment data available.
            </Typography>
        );
    }

    return (
        <Box sx={{
            maxHeight: 400,
            overflowY: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            py: 0.5,
        }}>
            {tree.map((item, index) => (
                <_SegmentNode key={index} item={item} depth={0} />
            ))}
        </Box>
    );
}

// ===== Main Panel =====

function EdifactAnalysisPanel({ analysis }) {
    const [activeTab, setActiveTab] = useState(0);
    const [collapsed, setCollapsed] = useState(true);

    if (!analysis || analysis.status === 'pending') return null;

    return (
        <Paper
            variant="outlined"
            sx={{
                mt: 0.5,
                borderRadius: 1.5,
                overflow: 'hidden',
                borderColor: 'divider',
            }}
        >
            {/* Header — always visible */}
            <Box
                onClick={() => setCollapsed(prev => !prev)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 0.75,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    transition: 'background-color 0.15s',
                }}
            >
                <Iconify
                    icon={collapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'}
                    sx={{ fontSize: 18, color: 'text.secondary' }}
                />
                <Iconify icon="mdi:file-search-outline" sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography variant="subtitle2" sx={{ flex: 1 }}>
                    EDIFACT Analysis
                </Typography>

                {/* Quick badges */}
                <Chip
                    size="small"
                    variant="outlined"
                    label={`${analysis.segmentCount || 0} Seg`}
                    sx={{ height: 20, fontSize: '0.7rem' }}
                />
                {analysis.messageHeader?.messageType && (
                    <Chip
                        size="small"
                        variant="outlined"
                        color="primary"
                        label={analysis.messageHeader.messageType}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                )}
                <_StatusChip
                    status={analysis.status}
                    errorCount={analysis.validation?.errorCount}
                    warningCount={analysis.validation?.warningCount}
                />
            </Box>

            {/* Collapsible body */}
            <Collapse in={!collapsed}>
                <Divider />
                <Box sx={{ px: 1.5, pb: 1.5 }}>
                    <Tabs
                        value={activeTab}
                        onChange={(_, v) => setActiveTab(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            minHeight: 32,
                            '& .MuiTab-root': { minHeight: 32, py: 0.5, textTransform: 'none', fontSize: '0.8rem' },
                        }}
                    >
                        <Tab
                            label="Overview"
                            icon={<Iconify icon="mdi:view-dashboard-outline" width={16} />}
                            iconPosition="start"
                        />
                        <Tab
                            label="Segments"
                            icon={<Iconify icon="mdi:file-tree-outline" width={16} />}
                            iconPosition="start"
                        />
                    </Tabs>

                    <_TabPanel value={activeTab} index={0}>
                        <_OverviewTab analysis={analysis} />
                    </_TabPanel>

                    <_TabPanel value={activeTab} index={1}>
                        <_SegmentTreeTab analysis={analysis} />
                    </_TabPanel>
                </Box>
            </Collapse>
        </Paper>
    );
}

export default EdifactAnalysisPanel;
