'use client';

import { CssBaseline, Box } from '@mui/material';
import {
  ThemeProvider as MUIThemeProvider,
  StyledEngineProvider,
  createTheme,
} from '@mui/material/styles';
import { useMemo } from 'react';

//app imports
import componentsOverride from '@/app/theme/overrides';
import palette from '@/app/theme/palette';
import shadows, { customShadows } from '@/app/theme/shadows';
import typography from '@/app/theme/typography';
import { ThemeConfigProvider, useThemeConfig } from '@/app/_contexts/ThemeContext';

import SplashScreen from '@/app/_components/SplashScreen';

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
