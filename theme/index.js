'use client';

import { CssBaseline, Box } from '@mui/material';
import {
  ThemeProvider as MUIThemeProvider,
  StyledEngineProvider,
  createTheme,
} from '@mui/material/styles';
import { useMemo } from 'react';
import componentsOverride from './overrides';
import palette from './palette';
import shadows, { customShadows } from './shadows';
import typography from './typography';
import SplashScreen from '../app/_components/SplashScreen';
import { ThemeConfigProvider, useThemeConfig } from './ThemeContext';

function ThemeProviderContent({ children }) {
  const {
    backgroundMode,
    colorScheme,
    handlers,
    isLoaded,
  } = useThemeConfig();

  // Configure palette with background mode
  palette.mode = backgroundMode.mode;
  palette.customMode = backgroundMode.customMode;
  palette.background = backgroundMode.background;
  palette.text = backgroundMode.text;

  // Apply selected color scheme
  palette.primary = colorScheme.primary;
  palette.secondary = colorScheme.secondary;

  const themeOptions = useMemo(
    () => ({
      palette,
      shape: { borderRadius: 8 },
      typography,
      shadows,
      customShadows,
    }),
    [colorScheme, backgroundMode]
  );

  const theme = createTheme(themeOptions);
  theme.components = componentsOverride(theme);

  return (
    <StyledEngineProvider injectFirst>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {isLoaded && (
          <Box sx={{ display: 'block', height: '100%' }}>
            <SplashScreen
              updateFontColor={handlers.updateFontColor}
              updateBackground={handlers.updateBackground}
              updateFontSize={handlers.updateFontSize}
            >
              {children}
            </SplashScreen>
          </Box>
        )}
      </MUIThemeProvider>
    </StyledEngineProvider>
  );
}

export default function ThemeProvider({ children }) {
  return (
    <ThemeConfigProvider>
      <ThemeProviderContent>{children}</ThemeProviderContent>
    </ThemeConfigProvider>
  );
}
