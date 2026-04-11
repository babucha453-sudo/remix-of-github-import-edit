/**
 * AppointPanda Dashboard Theme
 * Brand colors matching homepage: Emerald & Teal
 */

export const dashboardTheme = {
  colors: {
    // Primary brand colors (match homepage)
    primary: {
      DEFAULT: '#10b981', // emerald-500
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
    },
    // Accent teal
    accent: {
      DEFAULT: '#14b8a6', // teal-500
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
    },
    // Backgrounds
    background: {
      main: '#ffffff',
      muted: '#f8fafc',
      card: '#ffffff',
    },
    // Text
    text: {
      DEFAULT: '#0f172a', // slate-900
      muted: '#64748b', // slate-500
      light: '#94a3b8', // slate-400
    },
    // Borders
    border: {
      DEFAULT: '#e2e8f0', // slate-200
      light: '#f1f5f9', // slate-100
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
};

// Helper function to get brand styles
export const getBrandStyles = (variant: 'primary' | 'accent' | 'default' = 'default') => {
  const colors = dashboardTheme.colors;
  
  const variants = {
    default: {
      background: colors.background.main,
      border: colors.border.DEFAULT,
      text: colors.text.DEFAULT,
    },
    primary: {
      background: colors.primary[50],
      border: colors.primary[200],
      text: colors.primary[700],
    },
    accent: {
      background: colors.accent[50],
      border: colors.accent[200],
      text: colors.accent[700],
    },
  };
  
  return variants[variant];
};

export default dashboardTheme;