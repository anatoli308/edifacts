import { useState } from 'react';
import { Box, Button, Divider, FormControlLabel, Switch, Tooltip, Typography } from '@mui/material';
import Iconify from '@/app/_components/utils/Iconify';
import SectionRow from './SectionRow';

const MemorySettingsSection = () => {
    const [useChatHistory, setUseChatHistory] = useState(true);
    const [useSavedMemories, setUseSavedMemories] = useState(true);

    return (
        <Box sx={{ mt: 4 }}>

            <SectionRow sx={{ alignItems: 'center', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1">Memory Settings</Typography>
                    <Tooltip title="Control how EDIFACTS uses chat history and saved memories">
                        <Iconify icon="mdi:information-outline" sx={{ fontSize: 20, cursor: 'pointer' }} />
                    </Tooltip>
                </Box>
                <Button size="small" variant="outlined">Edit</Button>
            </SectionRow>

            <Divider sx={{ my: 1 }} />
            
            <SectionRow sx={{ mb: 1 }}>
                <Box>
                    <Typography variant="body2">Consider chat history</Typography>
                    <Typography variant="caption" color="textSecondary">
                        Let EDIFACTS consider recent conversations when replying
                    </Typography>
                </Box>
                <FormControlLabel
                    control={<Switch checked={useChatHistory} onChange={(event) => setUseChatHistory(event.target.checked)} />}
                    label=""
                    sx={{ m: 0 }}
                />
            </SectionRow>
            
            <SectionRow sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="body2">Consider saved memories</Typography>
                    <Typography variant="caption" color="textSecondary">
                        Let EDIFACTS store memories and use them in replies
                    </Typography>
                </Box>
                <FormControlLabel
                    control={<Switch checked={useSavedMemories} onChange={(event) => setUseSavedMemories(event.target.checked)} />}
                    label=""
                    sx={{ m: 0 }}
                />
            </SectionRow>
        </Box>
    );
};

export default MemorySettingsSection;
