"use client";

import {
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    Container,
    Tab,
    Tabs,
    Typography
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

//app imports
import StartSessionFromCustom from '@/app/_components/start/StartSessionFromCustom';
import StartSessionFromUpload from '@/app/_components/start/StartSessionFromUpload';
import StandardFamilySelector from '@/app/_components/start/StandardFamilySelector';
import SubsetSelector from '@/app/_components/start/SubsetSelector';
import VersionReleaseSelector from '@/app/_components/start/VersionReleaseSelector';
import MessageTypeSelector from '@/app/_components/start/MessageTypeSelector';
import { useUser } from '@/app/_contexts/UserContext';
import { useThemeConfig } from "@/app/_contexts/ThemeContext";
import { useSnackbar } from '@/app/_contexts/SnackbarContext';

function StartContainer() {
    const { user} = useUser();
    const { themeBackground, reconnectUser } = useThemeConfig();
    const router = useRouter();
    const [selectedStandardFamily, setSelectedStandardFamily] = useState(null);
    const [selectedSubset, setSelectedSubset] = useState(null);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [selectedMessageType, setSelectedMessageType] = useState(null);
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
            if (selectedStandardFamily?.value) {
                formData.append('standardFamily', selectedStandardFamily.value);
            }
            if (selectedSubset?.value) {
                formData.append('subset', selectedSubset.value);
            }
            if (selectedVersion?.value) {
                formData.append('releaseVersion', selectedVersion.value);
            }
            if (selectedMessageType?.value) {
                formData.append('messageType', selectedMessageType.value);
            }

            //transfer theme background setting to session for consistent theming in case user starts as guest and later logs in
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
                    // Falls JSON Parsing fehlschlägt, nutze Status und Text (e.g Status 500 Internal Server Error)
                    console.log('[Parse Error]', jsonError);
                    errorData = { error: `Server error: ${res.status} ${res.statusText}` };
                }
                throw new Error(errorData?.error || 'Failed to start analysis session.');
            }
            const data = await res.json();

            // Got jobId, subscribe to updates
            const jobId = data.jobId;
            console.log('[Job started]', jobId);
            //TODO: anatoli - session cookie refresh besser handhaben, die bedingung(user) ist dogshit?!
            //user kann null sein, wenn guest user eine session startet (browsercache cleared, cookie expired, ...)
            await reconnectUser(data.token);
            router.push(`/a/${jobId}`);
            console.log('[Navigation] Redirecting to session page:', `/a/${jobId}`);
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
                    Upload a file or enter custom EDIFACT data below.
                </Typography>

                <Box sx={{ my: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                    <StandardFamilySelector
                        value={selectedStandardFamily}
                        onChange={(newValue) => {
                            setSelectedStandardFamily(newValue);
                            // Reset dependent fields when standard family changes
                            setSelectedVersion(null);
                        }}
                    />
                    <VersionReleaseSelector
                        value={selectedVersion}
                        onChange={setSelectedVersion}
                        standardFamily={selectedStandardFamily}
                    />
                    <SubsetSelector
                        value={selectedSubset}
                        onChange={setSelectedSubset}
                        standardFamily={selectedStandardFamily}
                    />
                    <MessageTypeSelector
                        value={selectedMessageType}
                        onChange={setSelectedMessageType}
                    />
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
            </Box >
        </Container >
    );
}

export default StartContainer;