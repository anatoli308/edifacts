'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Image from 'next/image';

//app imports
import { useUser } from '@/app/_contexts/UserContext';
import { useThemeConfig } from '@/app/_contexts/ThemeContext';
import { useAlreadyAuthenticatedRoute } from '@/app/_hooks/useAlreadyAuthenticatedRoute';

function RegisterContainer() {
    useAlreadyAuthenticatedRoute('/'); // Redirect to home if already logged in
    const router = useRouter();
    const { user, login } = useUser();
    const { handlers } = useThemeConfig();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        tosAccepted: false
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value, checked, type } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
        // Clear error on input change
        if (error) setError('');
    };

    const validateForm = () => {
        if (!formData.name.trim()) {
            setError('Username is required');
            return false;
        }
        if (formData.name.length < 2) {
            setError('Username must be at least 2 characters');
            return false;
        }
        if (!formData.email.trim()) {
            setError('Email is required');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setError('Please enter a valid email address');
            return false;
        }
        if (!formData.password) {
            setError('Password is required');
            return false;
        }
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return false;
        }
        if (!formData.tosAccepted) {
            setError('You must accept the terms of service');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

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
            handlers.restartSplashscreen();
            router.push('/'); // Redirect to home
        } catch (err) {
            setError(err.message || 'Registration failed. Please try again.');
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

                        {error && (
                            <Alert severity="error" sx={{ mb: 3 }}>
                                {error}
                            </Alert>
                        )}

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
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
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
                                                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
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
                                        <Link href="/tos" target="_blank" underline="hover">
                                            Terms of Service
                                        </Link>
                                        {' '}and{' '}
                                        <Link href="/privacy" target="_blank" underline="hover">
                                            Privacy Policy
                                        </Link>
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
                                <Button
                                    variant="text"
                                    size="small"
                                    disabled={isLoading}
                                    onClick={() => router.push('/auth/login')}
                                >
                                    Already have an account? Sign in
                                </Button>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        </Container>
    );
}

export default RegisterContainer;
