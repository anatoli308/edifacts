import { createContext, useContext, useEffect, useState } from 'react';

import { AUTH_COOKIE_EXPIRY_SECONDS, AUTH_COOKIE_NAME } from '@/app/_components/utils/Constants';

const UserContext = createContext(undefined);

export function UserProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            console.log('Loading user...');
            setIsLoading(true);
            const response = await fetch('/api/user/me', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load user');
            }

            const userData = await response.json();
            console.log('User loaded:', userData);
            setUser(userData);
        } catch (err) {
            console.log('Error loading user:', err);
            setError(err.message);
            // Clear cookie on error
            document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Strict`;
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email, password) => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        const { user, token } = await response.json();

        // Set token in cookie (7 days expiry)
        document.cookie = `${AUTH_COOKIE_NAME}=${token}; path=/; max-age=${AUTH_COOKIE_EXPIRY_SECONDS}; SameSite=Strict`;

        setUser(user);
        return user;
    };

    const updateGuestCookie = (token) => {
        document.cookie = `${AUTH_COOKIE_NAME}=${token}; path=/; max-age=${AUTH_COOKIE_EXPIRY_SECONDS}; SameSite=Strict`;
    };

    const logout = () => {
        // Clear authentication cookie
        document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Strict`;
        setUser(null);
    };

    return (
        <UserContext.Provider value={{
            user,
            isLoading,
            error,
            login,
            logout,
            loadUser,
            updateGuestCookie
        }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within UserProvider');
    }
    return context;
}