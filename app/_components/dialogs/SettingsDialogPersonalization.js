import { useState } from 'react';
import {
    Box,
    Typography,
    Divider,
    Select,
    Button,
    MenuItem,
    TextField,
    ListItem,
    Switch,
    FormControlLabel,
    Tooltip,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import Iconify from '@/app/_components/utils/Iconify';

const SelectChevron = (props) => (
    <Iconify icon="mdi:chevron-down" sx={{ fontSize: 18 }} {...props} />
);

function SettingsDialogPersonalization() {
    const [responseStyle, setResponseStyle] = useState('default');
    const [headlinesAndLists, setHeadlinesAndLists] = useState('default');
    const [tables, setTables] = useState('default');
    const [chartsAndVisualizations, setChartsAndVisualizations] = useState('default');
    const [emojis, setEmojis] = useState('default');
    const [useChatHistory, setUseChatHistory] = useState(true);
    const [useSavedMemories, setUseSavedMemories] = useState(true);
    const [personalizedBehavior, setPersonalizedBehavior] = useState('');
    const [nickname, setNickname] = useState('');
    const [occupation, setOccupation] = useState('');
    const [aboutMe, setAboutMe] = useState('');
    const [useInternetSearch, setUseInternetSearch] = useState(true);
    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Personalization
            </Typography>
            <Divider sx={{ my: 2 }} />

            {/* Response Style - Inline */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="body2">Response Style</Typography>
                    <Typography variant="caption" color="textSecondary">
                        Select how the AI should responds
                    </Typography>
                </Box>
                <Select
                    size="small"
                    value={responseStyle}
                    onChange={(e) => setResponseStyle(e.target.value)}
                    sx={{ minWidth: 250 }}
                >
                    <MenuItem value="default">
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">Default</Typography>
                            <Typography variant="caption" color="textSecondary">Typical response style</Typography>
                        </Box>
                    </MenuItem>

                    <MenuItem value="analyst">
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">Analyst</Typography>
                            <Typography variant="caption" color="textSecondary">Deep technical insights</Typography>
                        </Box>
                    </MenuItem>

                    <MenuItem value="manager">
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">Manager</Typography>
                            <Typography variant="caption" color="textSecondary">Executive focused</Typography>
                        </Box>
                    </MenuItem>

                    <MenuItem value="business">
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">Business</Typography>
                            <Typography variant="caption" color="textSecondary">Impact & compliance</Typography>
                        </Box>
                    </MenuItem>

                    <MenuItem value="tech">
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">Tech</Typography>
                            <Typography variant="caption" color="textSecondary">Debug & validation</Typography>
                        </Box>
                    </MenuItem>
                </Select>
            </Box>

            <Box sx={{ my: 2 }}>
                <Typography variant="body2">Customization</Typography>
                <Typography variant="caption" color="textSecondary">
                    Select additional customization options for your AI responses
                </Typography>
            </Box>



            {/* Headlines and Lists - Inline */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                    <Typography variant="body2">Headlines and Lists</Typography>
                    <Typography variant="caption" color="textSecondary">
                        Control the use of headlines and lists
                    </Typography>
                </Box>
                <Select
                    size="small"
                    value={headlinesAndLists}
                    onChange={(e) => setHeadlinesAndLists(e.target.value)}
                    sx={{ minWidth: 200 }}
                    IconComponent={SelectChevron}
                    renderValue={(value) => (
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {value}
                        </Typography>
                    )}
                >
                    <MenuItem value="more" as={Button} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={headlinesAndLists === 'more' ? "primary" : "textPrimary"}>More</Typography>
                                <Typography variant="caption" color="textSecondary">Extensive use</Typography>
                            </Box>
                            {headlinesAndLists === 'more' && (
                                <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                        </Box>
                    </MenuItem>
                    <MenuItem value="default" as={Button} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={headlinesAndLists === 'default' ? "primary" : "textPrimary"}>Default</Typography>
                                <Typography variant="caption" color="textSecondary">Balanced use</Typography>
                            </Box>
                            {headlinesAndLists === 'default' && (
                                <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                        </Box>
                    </MenuItem>
                    <MenuItem value="less" as={Button} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={headlinesAndLists === 'less' ? "primary" : "textPrimary"}>Less</Typography>
                                <Typography variant="caption" color="textSecondary">Minimal use</Typography>
                            </Box>
                            {headlinesAndLists === 'less' && (
                                <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                        </Box>
                    </MenuItem>
                </Select>
            </Box>

            {/* Tables - Inline */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                    <Typography variant="body2">Tables</Typography>
                    <Typography variant="caption" color="textSecondary">
                        Control the use of tables
                    </Typography>
                </Box>
                <Select
                    size="small"
                    value={tables}
                    onChange={(e) => setTables(e.target.value)}
                    sx={{ minWidth: 200 }}
                    IconComponent={SelectChevron}
                    renderValue={(value) => (
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {value}
                        </Typography>
                    )}
                >
                    <MenuItem value="more" as={Button} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={tables === 'more' ? "primary" : "textPrimary"}>More</Typography>
                                <Typography variant="caption" color="textSecondary">Extensive use</Typography>
                            </Box>
                            {tables === 'more' && (
                                <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                        </Box>
                    </MenuItem>
                    <MenuItem value="default" as={Button} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={tables === 'default' ? "primary" : "textPrimary"}>Default</Typography>
                                <Typography variant="caption" color="textSecondary">Balanced use</Typography>
                            </Box>
                            {tables === 'default' && (
                                <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                        </Box>
                    </MenuItem>
                    <MenuItem value="less" as={Button} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={tables === 'less' ? "primary" : "textPrimary"}>Less</Typography>
                                <Typography variant="caption" color="textSecondary">Minimal use</Typography>
                            </Box>
                            {tables === 'less' && (
                                <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                        </Box>
                    </MenuItem>
                </Select>
            </Box>

            {/* Charts and Visualizations - Inline */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                    <Typography variant="body2">Charts and Visualizations</Typography>
                    <Typography variant="caption" color="textSecondary">
                        Control the use of charts and visual elements
                    </Typography>
                </Box>
                <Select
                    size="small"
                    value={chartsAndVisualizations}
                    onChange={(e) => setChartsAndVisualizations(e.target.value)}
                    sx={{ minWidth: 200 }}
                    IconComponent={SelectChevron}
                    renderValue={(value) => (
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {value}
                        </Typography>
                    )}
                >
                    <MenuItem value="more" as={Button} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={chartsAndVisualizations === 'more' ? "primary" : "textPrimary"}>More</Typography>
                                <Typography variant="caption" color="textSecondary">Extensive use</Typography>
                            </Box>
                            {chartsAndVisualizations === 'more' && (
                                <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                        </Box>
                    </MenuItem>
                    <MenuItem value="default" as={Button} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={chartsAndVisualizations === 'default' ? "primary" : "textPrimary"}>Default</Typography>
                                <Typography variant="caption" color="textSecondary">Balanced use</Typography>
                            </Box>
                            {chartsAndVisualizations === 'default' && (
                                <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                        </Box>
                    </MenuItem>
                    <MenuItem value="less" as={Button} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={chartsAndVisualizations === 'less' ? "primary" : "textPrimary"}>Less</Typography>
                                <Typography variant="caption" color="textSecondary">Minimal use</Typography>
                            </Box>
                            {chartsAndVisualizations === 'less' && (
                                <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                        </Box>
                    </MenuItem>
                </Select>
            </Box>

            {/* Emojis - Inline */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                    <Typography variant="body2">Emojis</Typography>
                    <Typography variant="caption" color="textSecondary">
                        Control the use of emojis
                    </Typography>
                </Box>
                <Select
                    size="small"
                    value={emojis}
                    onChange={(e) => setEmojis(e.target.value)}
                    sx={{ minWidth: 200 }}
                    IconComponent={SelectChevron}
                    renderValue={(value) => (
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {value}
                        </Typography>
                    )}
                >
                    <MenuItem value="more" as={Button} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={emojis === 'more' ? "primary" : "textPrimary"}>More</Typography>
                                <Typography variant="caption" color="textSecondary">Extensive use</Typography>
                            </Box>
                            {emojis === 'more' && (
                                <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                        </Box>
                    </MenuItem>
                    <MenuItem value="default" as={Button} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={emojis === 'default' ? "primary" : "textPrimary"}>Default</Typography>
                                <Typography variant="caption" color="textSecondary">Balanced use</Typography>
                            </Box>
                            {emojis === 'default' && (
                                <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                        </Box>
                    </MenuItem>
                    <MenuItem value="less" as={Button} dense>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2" color={emojis === 'less' ? "primary" : "textPrimary"}>Less</Typography>
                                <Typography variant="caption" color="textSecondary">Minimal use</Typography>
                            </Box>
                            {emojis === 'less' && (
                                <Iconify icon="mdi:check" sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                        </Box>
                    </MenuItem>
                </Select>
            </Box>

            {/* Personalized Behavior - Not Inline */}
            <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>Personalized Behavior</Typography>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Describe how you'd like the AI to behave..."
                    value={personalizedBehavior}
                    onChange={(e) => setPersonalizedBehavior(e.target.value)}
                    multiline
                    minRows={3}
                    maxRows={12}
                />
            </Box>

            {/* About Me Section - Not Inline */}
            <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle1" gutterBottom>
                    About You
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>Nickname</Typography>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Your nickname"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                    />
                </Box>
                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>Occupation</Typography>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Your occupation"
                        value={occupation}
                        onChange={(e) => setOccupation(e.target.value)}
                    />
                </Box>
                <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>More About You</Typography>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Tell us more about yourself..."
                        value={aboutMe}
                        onChange={(e) => setAboutMe(e.target.value)}
                        multiline
                        minRows={1}
                        maxRows={3}
                    />
                </Box>
            </Box>

            {/* Memory Settings - Not Inline */}
            <Box sx={{ mt: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">
                            Memory Settings
                        </Typography>
                        <Tooltip title="Control how EDIFACTS uses chat history and saved memories">
                            <Iconify icon="mdi:information-outline" sx={{ fontSize: 20, cursor: 'pointer' }} />
                        </Tooltip>
                    </Box>
                    <Button size="small" variant="outlined">Edit</Button>
                </Box>
                <Divider sx={{ my: 1 }} />

                {/* Memory Settings */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box>
                        <Typography variant="body2">Consider chat history</Typography>
                        <Typography variant="caption" color="textSecondary">
                            Let EDIFACTS consider recent conversations when replying
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={<Switch checked={useChatHistory} onChange={(e) => setUseChatHistory(e.target.checked)} />}
                        label=""
                        sx={{ m: 0 }}
                    />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                        <Typography variant="body2">Consider saved memories</Typography>
                        <Typography variant="caption" color="textSecondary">
                            Let EDIFACTS store memories and use them in replies
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={<Switch checked={useSavedMemories} onChange={(e) => setUseSavedMemories(e.target.checked)} />}
                        label=""
                        sx={{ m: 0 }}
                    />
                </Box>
            </Box>

            {/* Advanced Settings */}
            <Accordion sx={{ p: 0 }}>
                <AccordionSummary
                    expandIcon={<Iconify icon="mdi:chevron-down" sx={{ fontSize: 24 }} />}
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0 }}
                >
                    <Typography variant="subtitle1">Advanced</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="body2">Internet search</Typography>
                            <Typography variant="caption" color="textSecondary">
                                Let EDIFACTS access and retrieve real-time information from the internet
                            </Typography>
                        </Box>
                        <FormControlLabel
                            control={<Switch checked={useInternetSearch} onChange={(e) => setUseInternetSearch(e.target.checked)} />}
                            label=""
                            sx={{ m: 0 }}
                        />
                    </Box>
                </AccordionDetails>
            </Accordion>

        </Box>
    );
}

export default SettingsDialogPersonalization;