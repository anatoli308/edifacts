// Background mode configurations
// Defines palette colors for light, dark, and dim modes

export const BACKGROUND_MODES = {
  light: {
    mode: 'light',
    customMode: 'light',
    background: {
      paper: '#F9FAFB',
      default: '#ffffff',
      neutral: '#F9FAFB',
    },
    text: {
      primary: '#212B36',
      secondary: '#637381',
      disabled: 'rgb(83, 100, 113)',
    },
  },
  dark: {
    mode: 'dark',
    customMode: 'dark',
    background: {
      paper: 'rgb(22, 24, 28)',
      default: '#000000',
      neutral: '#1a1a1a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#cfd8dc',
      disabled: 'rgb(139, 152, 165)',
    },
  },
  dim: {
    mode: 'dark',
    customMode: 'dim',
    background: {
      paper: '#0e1a28',
      default: '#1a2a3b',
      neutral: '#070e18',
    },
    text: {
      primary: '#ffffff',
      secondary: '#cfd8dc',
      disabled: '#90a4ae',
    },
  },
};

export const getBackgroundMode = (themeBackground) => {
  if (themeBackground === 'black') {
    return BACKGROUND_MODES.dark;
  } else if (themeBackground === '#1a2a3b') {
    return BACKGROUND_MODES.dim;
  }
  return BACKGROUND_MODES.light;
};
