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
    // Envelope & Service
    UNA: { color: '#7C3AED', icon: 'mdi:cog-outline', label: 'Service String Advice' },
    UNB: { color: '#7C3AED', icon: 'mdi:email-seal-outline', label: 'Interchange Header' },
    UNZ: { color: '#7C3AED', icon: 'mdi:email-check-outline', label: 'Interchange Trailer' },
    UNG: { color: '#7C3AED', icon: 'mdi:folder-outline', label: 'Group Header' },
    UNE: { color: '#7C3AED', icon: 'mdi:folder-check-outline', label: 'Group Trailer' },
    UNH: { color: '#2563EB', icon: 'mdi:file-document-outline', label: 'Message Header' },
    UNT: { color: '#2563EB', icon: 'mdi:file-check-outline', label: 'Message Trailer' },
    UNS: { color: '#64748B', icon: 'mdi:swap-horizontal', label: 'Section Control' },
    // Document
    BGM: { color: '#0891B2', icon: 'mdi:identifier', label: 'Beginning of Message' },
    DTM: { color: '#059669', icon: 'mdi:calendar-clock', label: 'Date/Time' },
    DOC: { color: '#0891B2', icon: 'mdi:file-document-edit-outline', label: 'Document Details' },
    STS: { color: '#64748B', icon: 'mdi:list-status', label: 'Status' },
    // Parties
    NAD: { color: '#D97706', icon: 'mdi:domain', label: 'Party' },
    CTA: { color: '#F97316', icon: 'mdi:card-account-phone-outline', label: 'Contact' },
    COM: { color: '#F97316', icon: 'mdi:phone-outline', label: 'Communication' },
    // References & Finance
    RFF: { color: '#9333EA', icon: 'mdi:link-variant', label: 'Reference' },
    CUX: { color: '#0D9488', icon: 'mdi:currency-eur', label: 'Currency' },
    PAT: { color: '#6366F1', icon: 'mdi:cash-clock', label: 'Payment Terms' },
    FII: { color: '#6366F1', icon: 'mdi:bank-outline', label: 'Financial Institution' },
    MOA: { color: '#BE185D', icon: 'mdi:cash', label: 'Monetary Amount' },
    TAX: { color: '#7C2D12', icon: 'mdi:percent-outline', label: 'Tax' },
    PCD: { color: '#7C2D12', icon: 'mdi:percent-box-outline', label: 'Percentage Details' },
    ALC: { color: '#F59E0B', icon: 'mdi:sale', label: 'Allowance/Charge' },
    AJT: { color: '#F59E0B', icon: 'mdi:tune-variant', label: 'Adjustment Details' },
    CNT: { color: '#64748B', icon: 'mdi:sigma', label: 'Control Total' },
    // Line Items
    LIN: { color: '#DC2626', icon: 'mdi:package-variant', label: 'Line Item' },
    PIA: { color: '#EA580C', icon: 'mdi:barcode', label: 'Product ID' },
    IMD: { color: '#CA8A04', icon: 'mdi:text-box-outline', label: 'Description' },
    QTY: { color: '#16A34A', icon: 'mdi:counter', label: 'Quantity' },
    PRI: { color: '#E11D48', icon: 'mdi:tag-outline', label: 'Price' },
    ALI: { color: '#D97706', icon: 'mdi:information-outline', label: 'Additional Info' },
    GIN: { color: '#EA580C', icon: 'mdi:numeric', label: 'Goods Identity Number' },
    GIR: { color: '#EA580C', icon: 'mdi:link-box-variant-outline', label: 'Related ID Numbers' },
    MEA: { color: '#16A34A', icon: 'mdi:ruler', label: 'Measurements' },
    FTX: { color: '#8B5CF6', icon: 'mdi:note-text-outline', label: 'Free Text' },
    // Logistics
    TDT: { color: '#0EA5E9', icon: 'mdi:truck-outline', label: 'Transport' },
    TSR: { color: '#0EA5E9', icon: 'mdi:clipboard-list-outline', label: 'Transport Service Req.' },
    LOC: { color: '#10B981', icon: 'mdi:map-marker-outline', label: 'Location' },
    TOD: { color: '#10B981', icon: 'mdi:handshake-outline', label: 'Terms of Delivery' },
    SCC: { color: '#0EA5E9', icon: 'mdi:calendar-sync-outline', label: 'Scheduling Conditions' },
    // Packaging & Goods
    PAC: { color: '#78716C', icon: 'mdi:package-variant-closed', label: 'Package' },
    PCI: { color: '#78716C', icon: 'mdi:package-variant-closed-check', label: 'Package ID' },
    EQD: { color: '#78716C', icon: 'mdi:train-car-container', label: 'Equipment Details' },
    SEL: { color: '#78716C', icon: 'mdi:lock-outline', label: 'Seal Number' },
    DGS: { color: '#EF4444', icon: 'mdi:alert-octagon-outline', label: 'Dangerous Goods' },
    RNG: { color: '#64748B', icon: 'mdi:arrow-expand-horizontal', label: 'Range Details' },
    IDE: { color: '#64748B', icon: 'mdi:card-bulleted-outline', label: 'Identity' },
    // Error & Conditions
    ERP: { color: '#EF4444', icon: 'mdi:alert-circle-outline', label: 'Error Point Details' },
    RCS: { color: '#64748B', icon: 'mdi:clipboard-check-outline', label: 'Requirements & Conditions' },
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
            {parties && parties.filter(p => p.qualifier || p.id || p.name || p.role).length > 0 && (
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                        Parties
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {parties.filter(p => p.qualifier || p.id || p.name || p.role).map((party, index) => {
                            const label = party.role
                                ? `${party.role}${party.name ? `: ${party.name}` : ''}${party.id ? ` (${party.id})` : ''}`
                                : `${party.qualifier || '?'}: ${party.id || party.name || '—'}${party.name && party.id ? ` (${party.name})` : ''}`;
                            return (
                                <Chip
                                    key={index}
                                    size="small"
                                    variant="outlined"
                                    icon={<Iconify icon="mdi:domain" width={14} />}
                                    label={label}
                                />
                            );
                        })}
                    </Box>
                </Box>
            )}

            {/* Interchange */}
            {interchange && (interchange.sender || interchange.receiver) && (
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                        Interchange
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {interchange.sender && (
                            <Chip size="small" variant="outlined" icon={<Iconify icon="mdi:arrow-right-bold" width={14} />} label={`Sender: ${interchange.sender}`} />
                        )}
                        {interchange.receiver && (
                            <Chip size="small" variant="outlined" icon={<Iconify icon="mdi:arrow-left-bold" width={14} />} label={`Receiver: ${interchange.receiver}`} />
                        )}
                        {interchange.controlReference && (
                            <Chip size="small" variant="outlined" label={`Ref: ${interchange.controlReference}`} />
                        )}
                        {interchange.testIndicator && (
                            <Chip size="small" color="warning" label="TEST" />
                        )}
                    </Box>
                </Box>
            )}

            {/* Business Data — Amounts */}
            {businessData && (businessData.totalAmount || businessData.currency || businessData.documentNumber) && (
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                        Business Data
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {businessData.documentNumber && (
                            <_MetricCard icon="mdi:file-document-outline" label="Doc No." value={businessData.documentNumber} color="info.main" />
                        )}
                        {businessData.documentType && (
                            <_MetricCard icon="mdi:file-cog-outline" label="Doc Type" value={businessData.documentType} color="info.main" />
                        )}
                        {businessData.totalAmount !== undefined && businessData.totalAmount !== null && (
                            <_MetricCard icon="mdi:cash" label="Total" value={`${businessData.totalAmount}${businessData.currency ? ` ${businessData.currency}` : ''}`} color="success.main" />
                        )}
                        {businessData.netAmount !== undefined && businessData.netAmount !== null && (
                            <_MetricCard icon="mdi:cash-minus" label="Net" value={`${businessData.netAmount}${businessData.currency ? ` ${businessData.currency}` : ''}`} color="info.main" />
                        )}
                        {businessData.taxAmount !== undefined && businessData.taxAmount !== null && (
                            <_MetricCard icon="mdi:percent-outline" label="Tax" value={`${businessData.taxAmount}${businessData.currency ? ` ${businessData.currency}` : ''}`} color="warning.main" />
                        )}
                    </Box>
                </Box>
            )}

            {/* Dates */}
            {businessData?.dates?.length > 0 && (
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                        Dates
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {businessData.dates.map((d, index) => (
                            <Chip
                                key={index}
                                size="small"
                                variant="outlined"
                                icon={<Iconify icon="mdi:calendar" width={14} />}
                                label={`${d.qualifier}: ${d.date ? new Date(d.date).toLocaleDateString() : '—'}`}
                            />
                        ))}
                    </Box>
                </Box>
            )}

            {/* References */}
            {businessData?.references?.length > 0 && (
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                        References
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {businessData.references.map((ref, index) => (
                            <Chip
                                key={index}
                                size="small"
                                variant="outlined"
                                icon={<Iconify icon="mdi:link-variant" width={14} />}
                                label={`${ref.qualifier}: ${ref.value}`}
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
                    {processing.fileSize ? ` | ${(processing.fileSize / 1024).toFixed(1)} KB` : ''}
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
        ? segmentDetails.map((sd, i) => ({ tag: sd.tag, position: sd.position || i + 1, content: sd.content, fields: sd.fields }))
        : (segments || []).map((tag, i) => ({ tag, position: i + 1, content: '', fields: [] }));

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

                {/* Label + value preview */}
                <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                    {meta.label}
                    {hasChildren && (
                        <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                            ({item.children.length})
                        </Typography>
                    )}
                    {!hasChildren && item.fields?.length > 0 && (
                        <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.5, fontFamily: 'monospace', fontSize: '0.65rem' }}>
                            ({item.fields.filter(Boolean).join(', ')})
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

// ===== Details Tab (Validation + Compliance) =====

function _ValidationRow({ detail }) {
    const severityConfig = {
        error: { color: 'error.main', icon: 'mdi:alert-circle', bgcolor: 'error' },
        warning: { color: 'warning.main', icon: 'mdi:alert', bgcolor: 'warning' },
        info: { color: 'info.main', icon: 'mdi:information', bgcolor: 'info' },
    };
    const config = severityConfig[detail.severity] || severityConfig.info;

    return (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, py: 0.5, px: 0.5, '&:hover': { bgcolor: 'action.hover' }, borderRadius: 0.5 }}>
            <Iconify icon={config.icon} sx={{ fontSize: 16, color: config.color, mt: 0.2, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {detail.segment && (
                        <Chip size="small" label={detail.segment} sx={{ height: 18, fontSize: '0.65rem', fontFamily: 'monospace' }} />
                    )}
                    {detail.code && (
                        <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                            {detail.code}
                        </Typography>
                    )}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
                    {detail.error || detail.warning || '—'}
                </Typography>
                {detail.suggestion && (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', fontStyle: 'italic', fontSize: '0.65rem' }}>
                        {detail.suggestion}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

function _DetailsTab({ analysis }) {
    const { validation, compliance } = analysis;
    const details = validation?.details || [];
    const hasMissingSegments = compliance?.missingSegments?.length > 0;
    const hasUnexpectedSegments = compliance?.unexpectedSegments?.length > 0;
    const hasMandatoryMissing = compliance?.mandatoryFieldsMissing?.length > 0;
    const hasDetails = details.length > 0 || hasMissingSegments || hasUnexpectedSegments || hasMandatoryMissing;

    if (!hasDetails) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 2 }}>
                <Iconify icon="mdi:check-circle" sx={{ color: 'success.main', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">
                    No issues found.
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Validation details */}
            {details.length > 0 && (
                <Box sx={{ maxHeight: 250, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, py: 0.5 }}>
                    {details.map((detail, index) => (
                        <_ValidationRow key={index} detail={detail} />
                    ))}
                </Box>
            )}

            {/* Compliance issues */}
            {hasMissingSegments && (
                <Box>
                    <Typography variant="caption" color="error.main" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                        Missing Required Segments
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {compliance.missingSegments.map((seg, index) => (
                            <Chip key={index} size="small" color="error" variant="outlined" label={seg} sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                        ))}
                    </Box>
                </Box>
            )}

            {hasUnexpectedSegments && (
                <Box>
                    <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                        Unexpected Segments
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {compliance.unexpectedSegments.map((seg, index) => (
                            <Chip key={index} size="small" color="warning" variant="outlined" label={seg} sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                        ))}
                    </Box>
                </Box>
            )}

            {hasMandatoryMissing && (
                <Box>
                    <Typography variant="caption" color="error.main" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                        Missing Mandatory Fields
                    </Typography>
                    <Box sx={{ maxHeight: 150, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, py: 0.5 }}>
                        {compliance.mandatoryFieldsMissing.map((m, index) => (
                            <Box key={index} sx={{ display: 'flex', gap: 0.5, px: 0.5, py: 0.25 }}>
                                <Chip size="small" label={m.segment} sx={{ height: 18, fontFamily: 'monospace', fontSize: '0.65rem' }} />
                                <Typography variant="caption" color="text.secondary">
                                    {m.field} — {m.requirement}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
}

// ===== Segment Tree Tab =====

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
                    EDIFACTS Analysis
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
                        <Tab
                            label="Details"
                            icon={<Iconify icon="mdi:clipboard-text-search-outline" width={16} />}
                            iconPosition="start"
                        />
                    </Tabs>

                    <_TabPanel value={activeTab} index={0}>
                        <_OverviewTab analysis={analysis} />
                    </_TabPanel>

                    <_TabPanel value={activeTab} index={1}>
                        <_SegmentTreeTab analysis={analysis} />
                    </_TabPanel>

                    <_TabPanel value={activeTab} index={2}>
                        <_DetailsTab analysis={analysis} />
                    </_TabPanel>
                </Box>
            </Collapse>
        </Paper>
    );
}

export default EdifactAnalysisPanel;
