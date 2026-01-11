import { Box } from '@mui/material';

const SectionRow = ({ children, sx = {} }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...sx }}>
        {children}
    </Box>
);

export default SectionRow;
