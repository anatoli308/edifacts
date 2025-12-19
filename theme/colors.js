// Color scheme definitions for different primary color themes
// This follows Material Design guidelines for color harmony

export const COLOR_SCHEMES = {
  blue: {
    primary: {
      lighter: '#CDE7FF',
      light: '#7FB3FF',
      main: '#1976D2',
      dark: '#115293',
      darker: '#0A2A4A',
      contrastText: '#ffffff',
    },
    secondary: {
      lighter: '#ffe0b2',
      light: '#ffb74d',
      main: '#ff9800',
      dark: '#c66900',
      darker: '#944d00',
      contrastText: '#000000',
    },
  },
  green: {
    primary: {
      lighter: '#80e27e',
      light: '#66bb6a',
      main: '#4caf50',
      dark: '#357a38',
      darker: '#1c4a1e',
      contrastText: '#000000',
    },
    secondary: {
      lighter: '#e1bee7',
      light: '#ce93d8',
      main: '#9c27b0',
      dark: '#7b1fa2',
      darker: '#4a148c',
      contrastText: '#ffffff',
    },
  },
  purple: {
    primary: {
      lighter: '#d05ce3',
      light: '#c218b9',
      main: '#9c27b0',
      dark: '#6a0080',
      darker: '#3f003f',
      contrastText: '#ffffff',
    },
    secondary: {
      lighter: '#fff9c4',
      light: '#fff59d',
      main: '#ffeb3b',
      dark: '#fbc02d',
      darker: '#f57f17',
      contrastText: '#000000',
    },
  },
  orange: {
    primary: {
      lighter: '#ffd699',
      light: '#ffb84d',
      main: '#ff9800',
      dark: '#c66900',
      darker: '#944d00',
      contrastText: '#000000',
    },
    secondary: {
      lighter: '#b2f5ea',
      light: '#4fd1c5',
      main: '#26a69a',
      dark: '#1a746f',
      darker: '#0f493f',
      contrastText: '#ffffff',
    },
  },
  pink: {
    primary: {
      lighter: '#ff6090',
      light: '#ff2f6d',
      main: '#e91e63',
      dark: '#b0003a',
      darker: '#7c001f',
      contrastText: '#ffffff',
    },
    secondary: {
      lighter: '#80e27e',
      light: '#66bb6a',
      main: '#4caf50',
      dark: '#357a38',
      darker: '#1c4a1e',
      contrastText: '#000000',
    },
  },
  yellow: {
    primary: {
      lighter: '#ffff72',
      light: '#fff94f',
      main: '#ffeb3b',
      dark: '#d4c22e',
      darker: '#a89c21',
      contrastText: '#000000',
    },
    secondary: {
      lighter: '#b2f7f1',
      light: '#80ede5',
      main: '#4dd0c8',
      dark: '#26a69a',
      darker: '#0f504f',
      contrastText: '#000000',
    },
  },
};

export const COLOR_CODES = {
  green: '#4caf50',
  purple: '#9c27b0',
  orange: '#ff9800',
  pink: '#e91e63',
  yellow: '#ffeb3b',
  blue: '#2065D1',
};

export const getColorScheme = (fontColor) => {
  const scheme = Object.entries(COLOR_SCHEMES).find(
    ([_, colors]) => colors.primary.main === fontColor
  );
  return scheme ? scheme[1] : COLOR_SCHEMES.blue;
};
