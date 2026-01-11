"use client";

import {
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
import { useSocket } from '@/app/_contexts/SocketContext';
import { useThemeConfig } from "@/app/_contexts/ThemeContext";
import { useSnackbar } from '@/app/_contexts/SnackbarContext';

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

function StartContainer() {
    const { user, updateGuestCookie, loadUser } = useUser();
    const { disconnect, reconnect } = useSocket();
    const { themeBackground } = useThemeConfig();
    const router = useRouter();
    const [selectedSubset, setSelectedSubset] = useState(null);
    const [inputTab, setInputTab] = useState(0); // 0 = Upload, 1 = Custom
    const [inputFile, setInputFile] = useState(null); // File or Blob provided by child component
    const [isLoading, setIsLoading] = useState(false);

    const { pushSnackbarMessage } = useSnackbar();

    const handleStartSession = async () => {
        console.log('[Analyze clicked] session starting file size:', inputFile?.size);

        try {
            setIsLoading(true);

            const formData = new FormData();
            if (!inputFile) throw new Error('Please provide a EDIFACT input first.');
            formData.append('file', inputFile);
            if (selectedSubset?.value) {
                formData.append('subset', selectedSubset.value);
            }

            formData.append('backgroundMode', themeBackground);
            const res = await fetch('/api/generate/session', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            if (!res.ok) {
                let errorData = {};
                try {
                    errorData = await res.json();
                } catch (jsonError) {
                    // Falls JSON Parsing fehlschlägt, nutze Status und Text
                    console.log('[Parse Error]', jsonError);
                    errorData = { error: `Server error: ${res.status} ${res.statusText}` };
                }
                throw new Error(errorData?.error || 'Failed to start analysis session.');
            }
            const data = await res.json();

            // Got jobId, subscribe to updates
            const jobId = data.jobId;
            console.log('[Job started]', jobId);
            if (data.token !== null && user == null) {
                updateGuestCookie(data.token);
                await loadUser();
                disconnect();
                reconnect();
            }
            router.push(`/a/${jobId}`);

        } catch (e) {
            pushSnackbarMessage(e.message || 'Failed to start analysis session.', 'error');
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
                    Welcome, {user && user.role === "USER" ? user.name : 'Guest'}!
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
                        <Typography variant="h6">📤 Select your EDIFACT Input</Typography>
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