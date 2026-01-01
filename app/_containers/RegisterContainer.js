'use client';

import {
    Link as MuiLink, Box,
    Button, Card, CardContent,
    Checkbox, CircularProgress, Container,
    FormControlLabel, IconButton, InputAdornment,
    TextField, Typography
} from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

//app imports
import Iconify from '@/app/_components/utils/Iconify';
import { useThemeConfig } from '@/app/_contexts/ThemeContext';
import { useUser } from '@/app/_contexts/UserContext';
import { useAlreadyAuthenticatedRoute } from '@/app/_hooks/useAlreadyAuthenticatedRoute';
import { useSnackbar } from '@/app/_contexts/SnackbarContext';

function RegisterContainer() {
    useAlreadyAuthenticatedRoute('/'); // Redirect to home if already logged in
    const router = useRouter();
    const { login } = useUser();
    const { restartSplashscreen } = useThemeConfig();
    const { pushSnackbarMessage } = useSnackbar();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        tosAccepted: false
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value, checked, type } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const validateForm = () => {
        if (!formData.name.trim()) {
            pushSnackbarMessage('Username is required', 'error');
            return false;
        }
        if (formData.name.length < 2) {
            pushSnackbarMessage('Username must be at least 2 characters', 'error');
            return false;
        }
        if (!formData.email.trim()) {
            pushSnackbarMessage('Email is required', 'error');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            pushSnackbarMessage('Please enter a valid email address', 'error');
            return false;
        }
        if (!formData.password) {
            pushSnackbarMessage('Password is required', 'error');
            return false;
        }
        if (formData.password.length < 8) {
            pushSnackbarMessage('Password must be at least 8 characters', 'error');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            pushSnackbarMessage('Passwords do not match', 'error');
            return false;
        }
        if (!formData.tosAccepted) {
            pushSnackbarMessage('You must accept the terms of service', 'error');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    tosAccepted: formData.tosAccepted
                }),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            // Auto-login after registration
            await login(formData.email, formData.password);
            restartSplashscreen();
            router.push('/'); // Redirect to home
        } catch (err) {
            pushSnackbarMessage(err.message || 'Registration failed. Please try again.', 'error');
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
                            Create Account
                        </Typography>

                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>
                            Sign up to start managing your EDIFACT data
                        </Typography>

                        <Box component="form" onSubmit={handleSubmit} noValidate>
                            <TextField
                                fullWidth
                                label="Username"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                autoComplete="username"
                                autoFocus
                                required
                                disabled={isLoading}
                                sx={{ mb: 2 }}
                                helperText="Must be unique and at least 2 characters"
                            />

                            <TextField
                                fullWidth
                                label="Email Address"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                autoComplete="email"
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
                                autoComplete="new-password"
                                required
                                disabled={isLoading}
                                sx={{ mb: 2 }}
                                helperText="Minimum 8 characters"
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowPassword(!showPassword)}
                                                edge="end"
                                                disabled={isLoading}
                                            >
                                                {showPassword ? <Iconify icon="mdi:eye-off" /> : <Iconify icon="mdi:eye" />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />

                            <TextField
                                fullWidth
                                label="Confirm Password"
                                name="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                autoComplete="new-password"
                                required
                                disabled={isLoading}
                                sx={{ mb: 2 }}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                edge="end"
                                                disabled={isLoading}
                                            >
                                                {showConfirmPassword ? <Iconify icon="mdi:eye-off" /> : <Iconify icon="mdi:eye" />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        name="tosAccepted"
                                        checked={formData.tosAccepted}
                                        onChange={handleChange}
                                        disabled={isLoading}
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        I accept the{' '}
                                        <MuiLink as={Link} href="/tos" underline="always" color='inherit'>
                                            Terms of Service
                                        </MuiLink>
                                        {' '}and{' '}
                                        <MuiLink as={Link} href="/privacy" underline="always" color='inherit'>
                                            Privacy Policy
                                        </MuiLink>
                                    </Typography>
                                }
                                sx={{ mb: 3 }}
                            />

                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={isLoading}
                                sx={{ mb: 2 }}
                            >
                                {isLoading ? (
                                    <CircularProgress size={24} color="inherit" />
                                ) : (
                                    'Create Account'
                                )}
                            </Button>

                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                    Already have an account? Sign in <MuiLink href="/auth/login" as={Link}
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

export default RegisterContainer;
