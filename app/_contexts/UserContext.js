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
            document.cookie = 'authToken=; path=/; max-age=0';
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
        document.cookie = `authToken=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;

        setUser(user);
        return user;
    };

    const logout = () => {
        // Clear authentication cookie
        document.cookie = 'authToken=; path=/; max-age=0';
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