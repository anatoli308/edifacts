"use client";

import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    Chip,
    CircularProgress,
    Container,
    Tab,
    Tabs,
    TextField,
    Typography
} from '@mui/material';
import Dropzone from 'dropzone';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

//app imports
import { useSocket } from '@/app/_contexts/SocketContext';
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
    const { socket, isConnected } = useSocket();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [edifactContent, setEdifactContent] = useState('');
    const [selectedSubset, setSelectedSubset] = useState(null);
    const [showVisualization, setShowVisualization] = useState(false);
    const [inputTab, setInputTab] = useState(0); // 0 = Upload, 1 = Custom
    const [uploadedFile, setUploadedFile] = useState(null);
    const MAX_CUSTOM_CHARS = 500000; // (~500 KB)
    const customContentRef = useRef('');
    const [customCount, setCustomCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [visualizationData, setVisualizationData] = useState(null);
    const dropzoneRef = useRef(null);
    const dropzoneInstance = useRef(null);
    const [currentJobId, setCurrentJobId] = useState(null);
    const [progress, setProgress] = useState({ percent: 0, message: '' });
    const [messages, setMessages] = useState([]);
    const [userMessage, setUserMessage] = useState('');
    const [isAssistantTyping, setIsAssistantTyping] = useState(false);
    const messagesEndRef = useRef(null);

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

    // Socket event listeners for job progress
    useEffect(() => {
        if (!socket || !isConnected || !currentJobId) return;

        const handleProgress = (data) => {
            if (data.jobId === currentJobId) {
                console.log('[Progress]', data);
                setProgress({ percent: data.percent, message: data.message });
            }
        };

        const handleComplete = (data) => {
            if (data.jobId === currentJobId) {
                console.log('[Complete]', data);
                setVisualizationData(data.result);
                setShowVisualization(true);
                setIsLoading(false);
                setProgress({ percent: 100, message: 'Complete!' });

                // Initialize chat with welcome message
                const welcomeMessage = {
                    role: 'assistant',
                    content: `Hi! I'm your EDIFACT AI Assistant. I've analyzed your file "${data.result?.file?.name || 'your file'}". I can help you understand the data, answer questions about segments, or export it in different formats. What would you like to know?`,
                    timestamp: new Date().toISOString()
                };
                setMessages([welcomeMessage]);
            }
        };

        const handleError = (data) => {
            if (data.jobId === currentJobId) {
                console.error('[Error]', data);
                setError(data.error);
                setIsLoading(false);
                setProgress({ percent: 0, message: '' });
            }
        };

        socket.on('progress', handleProgress);
        socket.on('complete', handleComplete);
        socket.on('error', handleError);

        return () => {
            socket.off('progress', handleProgress);
            socket.off('complete', handleComplete);
            socket.off('error', handleError);
        };
    }, [socket, isConnected, currentJobId]);

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleAnalyze = async () => {
        const currentContent = inputTab === 0 ? edifactContent : customContentRef.current;
        if (!currentContent.trim()) return;
        if (!isConnected) {
            setError('Socket not connected. Please wait and try again.');
            return;
        }
        try {
            setIsLoading(true);
            setError(null);
            setVisualizationData(null);
            setProgress({ percent: 0, message: 'Starting...' });

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
                throw new Error(data?.error || 'Failed to analyze EDIFACT data.');
            }

            // Got jobId, subscribe to updates
            const jobId = data.jobId;
            setCurrentJobId(jobId);
            console.log('[Job started]', jobId);
            socket.emit('subscribe', { jobId });

        } catch (e) {
            setError(e.message);
            setIsLoading(false);
        }
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

    const handleSendMessage = async () => {
        if (!userMessage.trim()) return;

        const newUserMessage = {
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newUserMessage]);
        setUserMessage('');
        setIsAssistantTyping(true);

        // Simulate AI response (replace with actual API call later)
        setTimeout(() => {
            const assistantMessage = {
                role: 'assistant',
                content: `I received your message: "${userMessage}". This is a placeholder response. In production, I'll analyze your EDIFACT data and provide detailed answers.`,
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, assistantMessage]);
            setIsAssistantTyping(false);
        }, 1500);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const currentContent = inputTab === 0 ? edifactContent : customContentRef.current;

    return (
        <Container maxWidth="xxl">
            <Box>
                <Typography variant="h4" gutterBottom>
                    Welcome, {user ? user.name : 'Guest'}!
                </Typography>

                <Typography variant="body2">
                    Select an EDIFACT file to get started. After clicking <strong>Analyze</strong>,
                    you'll get an interactive AI Assistant to help you explore and understand your EDIFACT data.
                </Typography>

                <Box sx={{ my: 1, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Box>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                            Select a subset for better results
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

                <Card sx={{ mt: 2 }}>
                    <CardHeader title={
                        <Typography variant="h6">📤 Select your EDIFACT File</Typography>
                    } />
                    <CardContent>
                        <Tabs value={inputTab} onChange={handleInputTabChange}
                            sx={{ mb: 0, borderBottom: 1, borderColor: 'divider' }}
                        >
                            <Tab label="Upload" />
                            <Tab label="Custom" />
                        </Tabs>

                        {inputTab === 0 ? (
                            <Box sx={{
                                p: 1, '& .dz-default.dz-message': {
                                    display: 'none'
                                }
                            }}><Box
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
                            </Box>
                        ) : (
                            <Box sx={{
                                width: '100%',
                                p:1,
                                '& .dz-default.dz-message': {
                                    display: 'none'
                                }
                            }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={14}
                                    defaultValue={customContentRef.current}
                                    onChange={handleCustomChange}
                                    placeholder="Paste your EDIFACT content (max. ~500 KB) here..."
                                    helperText={`${customCount}/${MAX_CUSTOM_CHARS} characters`}
                                    variant="outlined"
                                />
                            </Box>
                        )}

                        <Box sx={{ display: 'flex', gap: 1, mt: 2, p: 1 }}>
                            <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={handleAnalyze}
                                disabled={!currentContent.trim() || isLoading || !isConnected}
                            >
                                {isLoading ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <CircularProgress size={20} color="inherit" />
                                        {progress.percent > 0 ? `${progress.percent}%` : 'Parsing...'}
                                    </Box>
                                ) : (
                                    'Analyze'
                                )}
                            </Button>
                            {isLoading && progress.message && (
                                <Chip
                                    label={progress.message}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                />
                            )}
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        </Container>
    );
}

export default StartContainer;