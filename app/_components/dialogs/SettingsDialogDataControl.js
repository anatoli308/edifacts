import { Box, Divider, Typography, Card, CardContent, TextField, IconButton, MenuItem, Select, Button, Collapse } from '@mui/material';
import { useState, useEffect } from 'react';
import Iconify from '@/app/_components/utils/Iconify';
import SectionRow from '@/app/_components/dialogs/personalization/SectionRow';
// TODO: i will add later manually
//{ value: 'system', label: 'System', caption: 'Use our System AI services' },
//{ value: 'anthropic', label: 'Anthropic', caption: 'Use Anthropic AI services' },
//{ value: 'azure', label: 'Azure', caption: 'Use Azure AI services' },
//{ value: 'google', label: 'Google', caption: 'Use Google AI services' },
//{ value: 'openrouter', label: 'OpenRouter', caption: 'Use OpenRouter AI services' },
const providerOptions = [
    { value: 'openai', label: 'OpenAI', caption: 'Use OpenAI services' },
    { value: 'custom', label: 'Custom', caption: 'Use your own hosted AI services' }
];

function SettingsDialogDataControl() {
    const [savedProviders, setSavedProviders] = useState([]);
    const [draftProvider, setDraftProvider] = useState(null);
    const [selectOpen, setSelectOpen] = useState(false);
    const [editingProviderId, setEditingProviderId] = useState(null);
    const [editProvider, setEditProvider] = useState(null);

    const handleSelectProvider = (selectedProvider) => {
        if (selectedProvider) {
            setDraftProvider({
                id: Date.now(),
                provider: selectedProvider,
                name: '',
                apiKey: '',
                baseUrl: ''
            });
        }
    };

    useEffect(() => {
        async function loadProviders() {
            try {
                const response = await fetch('/api/provider/loadProviders', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                });
                const data = await response.json();
                if (response.ok) {
                    setSavedProviders(data.providers);
                } else {
                    console.error('Error loading providers:', data.error);
                }
            } catch (error) {
                console.error('Error loading providers:', error);
            }
        }
        loadProviders();
    }, []);

    const handleSaveProvider = async () => {
        if (draftProvider && draftProvider.apiKey.trim()) {
            try {
                const response = await fetch('/api/provider/addProvider', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include', // Send cookies with request
                    body: JSON.stringify({
                        provider: draftProvider.provider,
                        name: draftProvider.name,
                        apiKey: draftProvider.apiKey,
                        baseUrl: draftProvider.baseUrl
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    console.error('Error saving provider:', data.error);
                    // TODO: Show error message to user
                    return;
                }

                // Add to saved providers list
                setSavedProviders([...savedProviders, { ...draftProvider, id: data.apiKeyId }]);
                setDraftProvider(null);
            } catch (error) {
                console.error('Error saving provider:', error);
                // TODO: Show error message to user
            }
        }
    };

    const handleSubmitForm = (e) => {
        e.preventDefault();
        handleSaveProvider();
    };

    const handleCancelDraft = () => {
        setDraftProvider(null);
    };

    const handleRemoveProvider = (id) => {
        setSavedProviders(savedProviders.filter(p => p.id !== id));
    };

    const handleUpdateDraft = (field, value) => {
        if (draftProvider) {
            setDraftProvider({ ...draftProvider, [field]: value });
        }
    };

    const getProviderLabel = (value) => {
        return providerOptions.find(opt => opt.value === value)?.label || value;
    };

    const getAvailableProviders = () => {
        return providerOptions;
    };

    const handleOpenSelect = () => {
        setSelectOpen(true);
    };

    const handleEditProvider = (provider) => {
        if (editingProviderId === provider.id) {
            setEditingProviderId(null);
            setEditProvider(null);
        } else {
            setEditingProviderId(provider.id);
            setEditProvider({ ...provider });
        }
    };

    const handleUpdateEdit = (field, value) => {
        if (editProvider) {
            setEditProvider({ ...editProvider, [field]: value });
        }
    };

    const handleSaveEdit = (e) => {
        e.preventDefault();
        if (editProvider && editProvider.apiKey.trim()) {
            setSavedProviders(savedProviders.map(p =>
                p.id === editProvider.id ? editProvider : p
            ));
            setEditingProviderId(null);
            setEditProvider(null);
        }
    };

    const handleCancelEdit = () => {
        setEditingProviderId(null);
        setEditProvider(null);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Data Control
            </Typography>
            <Divider sx={{ my: 2 }} />

            <SectionRow sx={{ mb: 3 }}>
                <Box>
                    <Typography variant="body2">AI Model Provider</Typography>
                    <Typography variant="caption" color="textSecondary">
                        Add your preferred AI model provider
                    </Typography>
                </Box>
                <Select
                    size="small"
                    value={draftProvider?.provider || ""}
                    onChange={(e) => handleSelectProvider(e.target.value)}
                    displayEmpty
                    disabled={!!draftProvider}
                    open={selectOpen}
                    onOpen={() => setSelectOpen(true)}
                    onClose={() => setSelectOpen(false)}
                    sx={{ minWidth: 250, height: 60 }}
                >
                    <MenuItem value="" disabled>
                        <Typography variant="body2" color="textSecondary">Add provider...</Typography>
                    </MenuItem>
                    {getAvailableProviders().map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2">{option.label}</Typography>
                                <Typography variant="caption" color="textSecondary">{option.caption}</Typography>
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            </SectionRow>

            {draftProvider ? (
                <Card variant="outlined">
                    <CardContent component="form" onSubmit={handleSubmitForm}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box>
                                <Typography variant="h6">
                                    {getProviderLabel(draftProvider.provider)}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                    {providerOptions.find(opt => opt.value === draftProvider.provider)?.caption}
                                </Typography>
                            </Box>
                            <IconButton
                                size="small"
                                color="error"
                                onClick={handleCancelDraft}
                                type="button"
                            >
                                <Iconify icon="eva:close-outline" />
                            </IconButton>
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField
                                fullWidth
                                label="Name (Optional)"
                                size="small"
                                value={draftProvider.name}
                                onChange={(e) => handleUpdateDraft('name', e.target.value)}
                                placeholder="e.g., Work OpenAI, Personal Account"
                                helperText="Give this configuration a memorable name"
                            />
                            <TextField
                                fullWidth
                                label="API Key"
                                size="small"
                                required
                                value={draftProvider.apiKey}
                                onChange={(e) => handleUpdateDraft('apiKey', e.target.value)}
                                placeholder="Enter your API key"
                            />
                            {draftProvider.provider === 'custom' && (
                                <TextField
                                    fullWidth
                                    label="Base URL"
                                    size="small"
                                    required
                                    value={draftProvider.baseUrl}
                                    onChange={(e) => handleUpdateDraft('baseUrl', e.target.value)}
                                    placeholder="e.g., https://llm.endpoint.com/openapi.json"
                                    helperText="Custom OpenAPI spec URL for your hosted AI service"
                                />
                            )}
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
                            <Button
                                variant="contained"
                                size="small"
                                type="submit"
                                disabled={!draftProvider.apiKey.trim()}
                            >
                                Save Provider
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={handleCancelDraft}
                                type="button"
                            >
                                Cancel
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            ) : null}

            {!draftProvider ? <Box
                onClick={handleOpenSelect}
                sx={{
                    p: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.neutral',
                    '&:hover': { bgcolor: 'action.hover' },
                    mb: 1
                }}
            >
                <Iconify icon="eva:cloud-upload-outline" width={48} sx={{ color: 'text.secondary' }} />
                <Typography variant="body2" color="textSecondary">
                    Select your provider above to get started
                </Typography>
            </Box> : null}

            {/* Saved Providers */}
            <Typography variant="h6" gutterBottom>
                Saved Providers
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {savedProviders.length > 0 ? (
                    savedProviders.map((provider) => (
                        <Box key={provider.id}>
                            <Card
                                variant="outlined"
                                sx={{
                                    p: 1.5,
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'action.hover' }
                                }}
                                onClick={() => handleEditProvider(provider)}
                            >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {provider.name || getProviderLabel(provider.provider)}
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary">
                                            {getProviderLabel(provider.provider)}
                                        </Typography>
                                    </Box>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveProvider(provider.id);
                                        }}
                                    >
                                        <Iconify icon="eva:trash-2-outline" />
                                    </IconButton>
                                </Box>
                            </Card>

                            <Collapse in={editingProviderId === provider.id}>
                                <Box sx={{ p: 2, bgcolor: 'background.neutral', borderLeft: '3px solid', borderColor: 'primary.main' }}>
                                    <Box component="form" onSubmit={handleSaveEdit}>
                                        <Typography variant="subtitle2" sx={{ mb: 2 }}>
                                            Edit Provider
                                        </Typography>

                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <TextField
                                                fullWidth
                                                label="Name (Optional)"
                                                size="small"
                                                value={editProvider?.name || ''}
                                                onChange={(e) => handleUpdateEdit('name', e.target.value)}
                                                placeholder="e.g., Work OpenAI, Personal Account"
                                                helperText="Give this configuration a memorable name"
                                            />
                                            <TextField
                                                fullWidth
                                                label="API Key"
                                                size="small"
                                                required
                                                value={editProvider?.apiKey || ''}
                                                onChange={(e) => handleUpdateEdit('apiKey', e.target.value)}
                                                placeholder="Enter your API key"
                                            />
                                            {editProvider?.provider === 'custom' && (
                                                <TextField
                                                    fullWidth
                                                    label="Base URL"
                                                    size="small"
                                                    required
                                                    value={editProvider?.baseUrl || ''}
                                                    onChange={(e) => handleUpdateEdit('baseUrl', e.target.value)}
                                                    placeholder="e.g., https://llm.endpoint.com/openapi.json"
                                                    helperText="Custom OpenAPI spec URL for your hosted AI service"
                                                />
                                            )}
                                        </Box>

                                        <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                type="submit"
                                                disabled={!editProvider?.apiKey?.trim()}
                                            >
                                                Update Provider
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={handleCancelEdit}
                                                type="button"
                                            >
                                                Cancel
                                            </Button>
                                        </Box>
                                    </Box>
                                </Box>
                            </Collapse>
                        </Box>
                    ))
                ) : null}
            </Box>

        </Box>
    );
}

export default SettingsDialogDataControl;