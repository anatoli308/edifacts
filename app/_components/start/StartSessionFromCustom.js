import { Box, TextField } from '@mui/material';
import { useMemo, useState } from 'react';

function StartSessionFromCustom({ onChange }) {
    const MAX_CUSTOM_CHARS = 500000;
    const [text, setText] = useState('');

    const helperText = useMemo(() => `${text.length}/${MAX_CUSTOM_CHARS} characters`, [text.length]);

    const handleChange = (e) => {
        const next = e.target.value.slice(0, MAX_CUSTOM_CHARS);
        if (next !== e.target.value) {
            e.target.value = next;
        }
        setText(next);
        const blob = new Blob([next], { type: 'text/plain' });
        onChange && onChange(new File([blob], 'custom_text.edi', { type: 'text/plain' }));
    };

    return (
        <Box sx={{ width: '100%', p: 1 }}>
            <TextField
                fullWidth
                multiline
                rows={14}
                value={text}
                onChange={handleChange}
                placeholder="Paste your EDIFACT content (max. ~500 KB) here..."
                helperText={helperText}
                variant="outlined"
            />
        </Box>
    );
}

export default StartSessionFromCustom;
