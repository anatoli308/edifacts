"use client";

import {
    Container, Box, Typography, TextField, Badge,
    Button, Autocomplete, Tabs, Tab, Accordion, AccordionSummary,
    AccordionDetails, Alert, CircularProgress, Chip, Tooltip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useEffect, useRef, useState } from 'react';
import Dropzone from 'dropzone';
//import 'dropzone/dist/dropzone.css';

//app imports
import { useUser } from '@/app/_contexts/UserContext';

// Disable autoDiscover
if (typeof window !== 'undefined') {
    Dropzone.autoDiscover = false;
}

const STANDARD_SUBSETS = [
    { label: 'ANSI ASC X12', value: 'ansi-asc-x12' },
    { label: 'EANCOM', value: 'eancom' },
    { label: 'HIPAA', value: 'hipaa' },
    { label: 'ODETTE Automotive', value: 'odette' },
    { label: 'Oracle-Gateway', value: 'oracle-gateway' },
    { label: 'RosettaNet', value: 'rosettanet' },
    { label: 'SAP', value: 'sap' },
    { label: 'SWIFT', value: 'swift' },
    { label: 'TRADACOMS', value: 'tradacoms' },
    { label: 'UN/EDIFACT', value: 'un-edifact' },
    { label: 'VDA', value: 'vda' },
    { label: 'VICS', value: 'vics' },
];

function StartContainer(props) {
    const { user } = useUser();
    const [edifactContent, setEdifactContent] = useState('');
    const [selectedSubset, setSelectedSubset] = useState(null);
    const [showVisualization, setShowVisualization] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [inputTab, setInputTab] = useState(0); // 0 = Upload, 1 = Custom
    const [expandedAccordion, setExpandedAccordion] = useState('input');
    const [uploadedFile, setUploadedFile] = useState(null);
    const MAX_CUSTOM_CHARS = 500000; // (~500 KB)
    const customContentRef = useRef('');
    const [customCount, setCustomCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [visualizationData, setVisualizationData] = useState(null);
    const dropzoneRef = useRef(null);
    const dropzoneInstance = useRef(null);

    useEffect(() => {
        if (dropzoneRef.current && !dropzoneInstance.current) {
            dropzoneInstance.current = new Dropzone(dropzoneRef.current, {
                url: '/api/generate/visualization',
                autoProcessQueue: false,
                acceptedFiles: '.edi,.edifact,.txt',
                maxFiles: 1,
                dictDefaultMessage: '',
                previewsContainer: false,
                clickable: false
            });

            dropzoneInstance.current.on('addedfile', async (file) => {
                console.log(`File added: ${file.name}`);
                const text = await file.text();
                setEdifactContent(text);
                setUploadedFile(file);
                dropzoneInstance.current.removeFile(file);
            });
        }

        return () => {
            if (dropzoneInstance.current) {
                dropzoneInstance.current.destroy();
                dropzoneInstance.current = null;
            }
        };
    }, []);

    const handleVisualize = async () => {
        const currentContent = inputTab === 0 ? edifactContent : customContentRef.current;
        if (!currentContent.trim()) return;
        try {
            setIsLoading(true);
            setError(null);
            setVisualizationData(null);

            const formData = new FormData();
            if (inputTab === 0) {
                if (uploadedFile) {
                    formData.append('file', uploadedFile);
                } else {
                    const blob = new Blob([currentContent], { type: 'text/plain' });
                    formData.append('file', blob, 'input.edi');
                }
            } else {
                const blob = new Blob([currentContent], { type: 'text/plain' });
                formData.append('file', blob, 'custom.edi');
            }
            if (selectedSubset?.value) {
                formData.append('subset', selectedSubset.value);
            }

            const res = await fetch('/api/generate/visualization', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data?.error || 'Failed to visualize');
            }
            setVisualizationData(data);
            setShowVisualization(true);
            setExpandedAccordion('results');
            setActiveTab(0);
        } catch (e) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpandedAccordion(isExpanded ? panel : false);
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleInputTabChange = (event, newValue) => {
        setInputTab(newValue);
    };

    const handleCustomChange = (e) => {
        const next = e.target.value.slice(0, MAX_CUSTOM_CHARS);
        if (next !== e.target.value) {
            e.target.value = next;
        }
        customContentRef.current = next;
        setCustomCount(next.length);
    };

    const currentContent = inputTab === 0 ? edifactContent : customContentRef.current;

    return (
        <Container maxWidth="xxl">
            <Box>
                <Typography variant="h4" gutterBottom>
                    Welcome, {user ? user.name : 'Guest'}!
                </Typography>

                <Typography variant="body2">
                    Upload an EDIFACT file to get started. After clicking <strong>Visualize</strong>,
                    you'll get an interactive view with multiple perspectives of your data:
                </Typography>

                <Typography variant="caption" component="div">
                    <Box component="p" >
                        📊 <strong>Segment Tree</strong> — technical view for EDI experts
                    </Box>
                    <Box component="p" >
                        💼 <strong>Business View</strong> — for non-technical stakeholders
                    </Box>
                    <Box component="p" >
                        📄 <strong>JSON/XML View</strong> — for developers & integration
                    </Box>
                    <Box component="p" >
                        ⚙️ <strong>Rule Editor</strong> — to define custom validation rules
                    </Box>
                </Typography>

                <Box sx={{ my: 2, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Box>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                            Select a subset for better visualization results
                        </Typography>
                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}
                        <Autocomplete
                            options={STANDARD_SUBSETS}
                            getOptionLabel={(option) => option.label}
                            value={selectedSubset}
                            onChange={(event, newValue) => setSelectedSubset(newValue)}
                            sx={{ minWidth: 300 }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Standard Subset (optional)"
                                    placeholder="Search subsets..."
                                />
                            )}
                        />
                    </Box>
                </Box>

                <Accordion
                    expanded={expandedAccordion === 'input'}
                    onChange={handleAccordionChange('input')}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6">📤 Upload EDIFACT File</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Tabs value={inputTab} onChange={handleInputTabChange}
                            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                        >
                            <Tab label="Upload" />
                            <Tab label="Custom" />
                        </Tabs>

                        {inputTab === 0 ? (
                            <Box
                                ref={dropzoneRef}
                                className="dropzone"
                                sx={{
                                    width: '100%',
                                    minHeight: '300px',
                                    border: '2px dashed #ccc',
                                    borderRadius: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'background.default',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s',
                                    '&:hover': {
                                        backgroundColor: 'background.paper',
                                        borderColor: '#999'
                                    },
                                    '& .dz-default.dz-message': {
                                        display: 'none'
                                    }
                                }}
                            >
                                <Box sx={{ textAlign: 'center', p: 3 }}>
                                    <Typography variant="h6" color="textSecondary" gutterBottom>
                                        📁 Drag & Drop EDIFACT File
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Supported formats: .edi, .edifact, .txt
                                    </Typography>
                                    {uploadedFile && (
                                        <Typography variant="body2" color="primary" sx={{ mt: 2 }}>
                                            ✓ {uploadedFile.name}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        ) : (
                            <Box sx={{
                                width: '100%',
                                '& .dz-default.dz-message': {
                                    display: 'none'
                                }
                            }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={15}
                                    defaultValue={customContentRef.current}
                                    onChange={handleCustomChange}
                                    placeholder="Paste your EDIFACT content (max. ~500 KB) here..."
                                    helperText={`${customCount}/${MAX_CUSTOM_CHARS} characters`}
                                    variant="outlined"
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            fontFamily: 'monospace',
                                            fontSize: '0.875rem'
                                        }
                                    }}
                                />
                            </Box>
                        )}

                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                            <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={handleVisualize}
                                disabled={!currentContent.trim() || isLoading}
                            >
                                {isLoading ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <CircularProgress size={20} color="inherit" />
                                        Parsing...
                                    </Box>
                                ) : (
                                    'Visualize'
                                )}
                            </Button>
                        </Box>
                    </AccordionDetails>
                </Accordion>

                {/* Results Accordion */}
                {showVisualization && (
                    <Accordion
                        expanded={expandedAccordion === 'results'}
                        onChange={handleAccordionChange('results')}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="h6">📊 Visualization Results</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box sx={{ width: '100%' }}>
                                {visualizationData && (
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="body2" color="textSecondary">
                                            File: <strong>{visualizationData.file?.name}</strong> • {visualizationData.file?.size} bytes
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Message Type: <strong>{visualizationData.detected?.messageType || 'Unknown'}</strong>
                                        </Typography>
                                        {visualizationData.subset && (
                                            <Typography variant="body2" color="textSecondary">
                                                Subset: <strong>{visualizationData.subset?.label}</strong>
                                            </Typography>
                                        )}
                                    </Box>
                                )}
                                <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
                                    <Tab label="Segments" />
                                    <Tab label="Business" />
                                    <Tab label="JSON/XML" />
                                    <Tab label="Rules" />
                                </Tabs>

                                <Box sx={{ p: 2, backgroundColor: 'background.default', borderRadius: 1, minHeight: '400px' }}>
                                    {activeTab === 0 && (
                                        <Box>
                                            <Typography variant="h6">Segment Tree View</Typography>
                                            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                                Hierarchical view of EDIFACT segments (coming soon)
                                            </Typography>
                                        </Box>
                                    )}

                                    {activeTab === 1 && (
                                        <Box>
                                            <Typography variant="h6">Business View</Typography>
                                            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                                User-friendly view for stakeholders (coming soon)
                                            </Typography>
                                        </Box>
                                    )}

                                    {activeTab === 2 && (
                                        <Box>
                                            <Typography variant="h6">JSON/XML View</Typography>
                                            {visualizationData ? (
                                                <TextField
                                                    fullWidth
                                                    multiline
                                                    rows={16}
                                                    value={visualizationData.preview || ''}
                                                    InputProps={{ readOnly: true }}
                                                    sx={{
                                                        mt: 1,
                                                        '& .MuiOutlinedInput-root': {
                                                            fontFamily: 'monospace',
                                                            fontSize: '0.85rem'
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                                    Machine-readable format for developers (coming soon)
                                                </Typography>
                                            )}
                                        </Box>
                                    )}

                                    {activeTab === 3 && (
                                        <Box>
                                            <Typography variant="h6">Rule Editor</Typography>
                                            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                                Define custom validation and transformation rules (coming soon)
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </AccordionDetails>
                    </Accordion>
                )}
            </Box>
        </Container>
    );
}

export default StartContainer;