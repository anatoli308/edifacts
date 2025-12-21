'use client';

import { Visibility, VisibilityOff } from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Container,
    IconButton,
    InputAdornment,
    TextField,
    Link as MuiLink,
    Typography
} from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

//app imports
import { useThemeConfig } from '@/app/_contexts/ThemeContext';
import { useUser } from '@/app/_contexts/UserContext';
import { useAlreadyAuthenticatedRoute } from '@/app/_hooks/useAlreadyAuthenticatedRoute';

function LoginContainer() {
    useAlreadyAuthenticatedRoute('/'); // Redirect to home if already logged in
    const router = useRouter();
    const { login } = useUser();
    const { handlers } = useThemeConfig();

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        // Clear error on input change
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(formData.email, formData.password);
            handlers.restartSplashscreen();
            router.push('/'); // Redirect to home after successful login
        } catch (err) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container maxWidth="sm">
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
            }}>
                <Card sx={{ width: '100%' }}>
                    <CardContent sx={{ p: 2 }}>
                        <Image src="/logo/logo-color-no-bg.png" alt="edifacts logo" width={200} height={150}
                            style={{ display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />

                        <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 3 }}>
                            Welcome back
                        </Typography>

                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>
                            Sign in to your account to continue
                        </Typography>

                        {error && (
                            <Alert severity="error" sx={{ mb: 3 }}>
                                {error}
                            </Alert>
                        )}

                        <Box component="form" onSubmit={handleSubmit} noValidate>
                            <TextField
                                fullWidth
                                label="Email Address"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                autoComplete="email"
                                autoFocus
                                required
                                disabled={isLoading}
                                sx={{ mb: 2 }}
                            />

                            <TextField
                                fullWidth
                                label="Password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                value={formData.password}
                                onChange={handleChange}
                                autoComplete="current-password"
                                required
                                disabled={isLoading}
                                sx={{ mb: 3 }}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowPassword(!showPassword)}
                                                edge="end"
                                                disabled={isLoading}
                                            >
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />

                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={isLoading || !formData.email || !formData.password}
                                sx={{ mb: 2 }}
                            >
                                {isLoading ? (
                                    <CircularProgress size={24} color="inherit" />
                                ) : (
                                    'Sign In'
                                )}
                            </Button>

                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                    Don&apos;t have an account? Sign up <MuiLink href="/auth/register" as={Link}
                                        color='inherit'>here</MuiLink>.
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        </Container>
    );
}

export default LoginContainer;