'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';

// app imports
import { COLOR_CODES, getColorScheme } from '@/app/theme/colors';
import { getBackgroundMode } from '@/app/theme/backgroundModes';

const ThemeContext = createContext(undefined);

export function ThemeConfigProvider({ children }) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const [themeBackground, setThemeBackground] = useState('white');
  const [fontColor, setFontColor] = useState(COLOR_CODES.blue);
  const [themeFontSize, setThemeFontSize] = useState(3);
  const [isLoaded, setIsLoaded] = useState(false);

  // Only set state after hydration is complete
  useEffect(() => {
    setThemeBackground(prefersDarkMode ? 'black' : 'white');
    setIsLoaded(true);
  }, [prefersDarkMode]);

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
        handlers: {
          updateFontColor: setFontColor,
          updateBackground: setThemeBackground,
          updateFontSize: setThemeFontSize,
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
