
import Alert from '@mui/material/Alert';
import Grow from '@mui/material/Grow';
import Snackbar from '@mui/material/Snackbar';
import { createContext, useCallback, useContext, useState } from 'react';

const SnackbarContext = createContext(undefined);

export function SnackbarProvider({ children }) {
    const [snackbar, setSnackbar] = useState(null); // { key, message, severity }

    // Push a new snackbar message with severity
    const pushSnackbarMessage = useCallback((message, severity = 'success') => {
        setSnackbar({ key: Date.now() + Math.random(), message, severity });
    }, []);

    // Remove snackbar by key
    const handleClose = useCallback(() => {
        setSnackbar(null);
    }, []);

    return (
        <SnackbarContext.Provider value={{ pushSnackbarMessage }}>
            {children}
            {snackbar && (
                <Snackbar
                    key={snackbar.key}
                    open={true}
                    onClose={handleClose}
                    slots={{ transition: Grow }}
                    autoHideDuration={1200}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                >
                    <Alert
                        onClose={handleClose}
                        severity={snackbar.severity}
                        variant="filled"
                        sx={{ width: '100%' }}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            )}
        </SnackbarContext.Provider>
    );
}

export function useSnackbar() {
    const ctx = useContext(SnackbarContext);
    if (!ctx) throw new Error('useSnackbar must be used within a SnackbarProvider');
    return ctx;
}
