"use client";

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

//app imports
import { useUser } from '@/app/_contexts/UserContext';

function AccountContainer(props) {
    const { user } = useUser();
    return (
        <Box>
            <Typography>
                Welcome, {user ? user.name : 'Guest'}! This is the account container.
            </Typography>
        </Box>
    );
}

export default AccountContainer;