"use client";

import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    Container,
    Tab,
    Tabs,
    TextField,
    Typography
} from '@mui/material';
import Dropzone from 'dropzone';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

//app imports
import { useSocket } from '@/app/_contexts/SocketContext';
import { useUser } from '@/app/_contexts/UserContext';

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
    const router = useRouter();
    const [selectedSubset, setSelectedSubset] = useState(null);
    const [inputTab, setInputTab] = useState(0); // 0 = Upload, 1 = Custom
    const [uploadedFile, setUploadedFile] = useState(null);
    const MAX_CUSTOM_CHARS = 500000; // (~500 KB)
    const customContentRef = useRef('');
    const [customCount, setCustomCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const dropzoneRef = useRef(null);
    const dropzoneInstance = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (dropzoneRef.current && !dropzoneInstance.current) {
            dropzoneInstance.current = new Dropzone(dropzoneRef.current, {
                url: '/', // We won't actually upload via Dropzone
                autoProcessQueue: false,
                acceptedFiles: '.edi,.edifact,.txt',
                maxFiles: 1,
                dictDefaultMessage: '',
                previewsContainer: false,
                clickable: true
            });

            dropzoneInstance.current.on('addedfile', async (file) => {
                console.log(`File added: ${file.name}`);
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

    const handleFileInputChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            console.log(`File selected: ${file.name}`);
            setUploadedFile(file);
        }
    };

    const handleStartSession = async () => {
        console.log('[Analyze clicked] session starting file size:', uploadedFile?.size);

        try {
            setIsLoading(true);
            setError(null);

            const formData = new FormData();
            if (inputTab === 0) {
                formData.append('file', uploadedFile);
            } else {
                const blob = new Blob([customContentRef.current], { type: 'text/plain' });
                formData.append('file', blob, 'custom_text.edi');
            }
            if (selectedSubset?.value) {
                formData.append('subset', selectedSubset.value);
            }

            const res = await fetch('/api/generate/session', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data?.error || 'Failed to analyze EDIFACT data.');
            }

            // Got jobId, subscribe to updates
            const jobId = data.jobId;
            console.log('[Job started]', jobId);
            router.push(`/a/${jobId}`);

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

    return (
        <Container maxWidth="md">
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                minHeight: '100vh',
                flexDirection: 'column',
            }}>
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
                            }}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileInputChange}
                                    accept=".edi,.edifact,.txt"
                                    style={{ display: 'none' }}
                                />
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
                                p: 1,
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

                        <Box sx={{ display: 'flex', gap: 1, mt: 0, p: 1 }}>
                            <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={handleStartSession}
                                disabled={isLoading}
                            >
                                Analyze
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        </Container>
    );
}

export default StartContainer;