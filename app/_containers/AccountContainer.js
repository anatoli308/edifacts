"use client";

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

//app imports
import { useUser } from '@/app/_contexts/UserContext';
import { useProtectedRoute } from '@/app/_hooks/useProtectedRoute';

function AccountContainer(props) {
    useProtectedRoute('/auth/login'); // Redirect to login if not authenticated
    const { user } = useUser();
    return (
        <Box>
            <Typography>
                Welcome, {user ? user.name : 'Guest'}! This is the <Typography color='error' component={"span"}>account container</Typography>.
            </Typography>
        </Box>
    );
}

export default AccountContainer;