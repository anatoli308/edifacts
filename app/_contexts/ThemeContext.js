'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';

// app imports
import { COLOR_CODES, getColorScheme } from '@/app/theme/colors';
import { getBackgroundMode } from '@/app/theme/backgroundModes';
import { useUser } from '@/app/_contexts/UserContext';

const ThemeContext = createContext(undefined);

export function ThemeConfigProvider({ children }) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const { user } = useUser();

  const [themeBackground, setThemeBackground] = useState('white');
  const [fontColor, setFontColor] = useState(COLOR_CODES.blue);
  const [themeFontSize, setThemeFontSize] = useState(3);
  const [isLoaded, setIsLoaded] = useState(false);
  const [splashTrigger, setSplashTrigger] = useState(0);

  // Only set state after hydration is complete and load persisted theme if no user
  useEffect(() => {
    loadPersistedTheme();
    setIsLoaded(true);
  }, [prefersDarkMode]);

  const loadPersistedTheme = () => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('themePrefs') : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.background) setThemeBackground(parsed.background);
        if (parsed?.fontColor) setFontColor(parsed.fontColor);
        if (Number.isFinite(parsed?.fontSize)) setThemeFontSize(parsed.fontSize);
        return;
      }
    } catch (error) {
      console.error('Failed to read theme from storage:', error);
    }

    setThemeBackground(prefersDarkMode ? 'black' : 'white');
  };

  // Sync theme with user or reset to defaults when logged out
  useEffect(() => {
    if (user && user.theme) {
      setThemeBackground(user.theme.backgroundMode || 'white');
      setFontColor(user.theme.fontColor || COLOR_CODES.blue);
      setThemeFontSize(user.theme.fontSize ?? 3);
    } else {
      setThemeBackground((prev) => prev || (prefersDarkMode ? 'black' : 'white'));
      setFontColor((prev) => prev || COLOR_CODES.blue);
      setThemeFontSize((prev) => (Number.isFinite(prev) ? prev : 3));
    }
  }, [user, prefersDarkMode]);

  // Persist theme for guests (no user) so reload keeps settings
  useEffect(() => {
    if (!user) {
      try {
        const payload = {
          background: themeBackground,
          fontColor,
          fontSize: themeFontSize,
        };
        localStorage.setItem('themePrefs', JSON.stringify(payload));
      } catch (error) {
        console.error('Failed to persist theme to storage:', error);
      }
    }
  }, [user, themeBackground, fontColor, themeFontSize]);

  const updateBackground = async (value) => {
    setThemeBackground(value);

    // Versuche API-Update wenn User eingeloggt ist
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      if (token) {
        console.log(`Updating background in for user ${user?.name || 'GUEST'} to: ${value}`);
        await fetch('/api/user/settings/updateBackground', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ backgroundMode: value })
        });
      }
    } catch (error) {
      console.error('Failed to update background in database:', error);
      // Fehler werden ignoriert, lokaler State ist bereits aktualisiert
    }
  };

  const backgroundMode = getBackgroundMode(themeBackground);
  const colorScheme = getColorScheme(fontColor);

  return (
    <ThemeContext.Provider
      value={{
        themeBackground,
        fontColor,
        themeFontSize,
        backgroundMode,
        colorScheme,
        isLoaded,
        splashTrigger,
        handlers: {
          updateFontColor: setFontColor,
          updateBackground,
          updateFontSize: setThemeFontSize,
          restartSplashscreen: () => {
            setSplashTrigger((value) => value + 1);
            setIsLoaded(true);
          },
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeConfig must be used within ThemeConfigProvider');
  }
  return context;
}
