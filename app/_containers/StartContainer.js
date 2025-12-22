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
import { useRouter } from 'next/navigation';
import { useState } from 'react';

//app imports
import StartSessionFromCustom from '@/app/_components/start/StartSessionFromCustom';
import StartSessionFromUpload from '@/app/_components/start/StartSessionFromUpload';
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
    const [inputFile, setInputFile] = useState(null); // File or Blob provided by child component
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleStartSession = async () => {
        console.log('[Analyze clicked] session starting file size:', inputFile?.size);

        try {
            setIsLoading(true);
            setError(null);

            const formData = new FormData();
            if (!inputFile) throw new Error('Please provide EDIFACT input first.');
            formData.append('file', inputFile);
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
        setInputFile(null);
    };

    const handleInputChange = (fileOrBlob) => {
        setInputFile(fileOrBlob);
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
                            <StartSessionFromUpload onChange={handleInputChange} />
                        ) : (
                            <StartSessionFromCustom onChange={handleInputChange} />
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