'use client';

import { createContext, useContext, useState, useEffect } from 'react';

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
            setIsLoading(true);
            const token = localStorage.getItem('authToken');

            if (!token) {
                setIsLoading(false);
                return;
            }

            const response = await fetch('/api/user/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load user');
            }

            const userData = await response.json();
            setUser(userData);
        } catch (err) {
            setError(err.message);
            localStorage.removeItem('authToken');
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email, password) => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        const { user, token } = await response.json();
        localStorage.setItem('authToken', token);
        setUser(user);
        return user;
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        setUser(null);
    };

    return (
        <UserContext.Provider value={{
            user,
            isLoading,
            error,
            login,
            logout,
            refreshUser: loadUser
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