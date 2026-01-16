import { Box } from '@mui/material';

const SectionRow = ({ children, sx = {} }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...sx, my: 1 }}>
        {children}
    </Box>
);

export default SectionRow;
