import React, { createContext, useContext, useEffect, useState } from 'react';
import { CssBaseline } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const ThemeModeContext = createContext(null);
const THEME_MODE_STORAGE_KEY = 'themeMode';
const THEME_MODE_EVENT = 'chengeto-theme-mode-change';

const parseStoredUser = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const resolveThemeMode = (user = null) => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedMode = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (storedMode === 'dark' || storedMode === 'light') {
    return storedMode;
  }

  const darkModePreference = user?.preferences?.appSettings?.darkMode;
  if (typeof darkModePreference === 'boolean') {
    return darkModePreference ? 'dark' : 'light';
  }

  return 'light';
};

const buildTheme = (mode) => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#2563eb',
        light: '#60a5fa',
        dark: '#1d4ed8',
        contrastText: '#ffffff'
      },
      secondary: {
        main: '#059669',
        light: '#34d399',
        dark: '#047857',
        contrastText: '#ffffff'
      },
      error: {
        main: '#dc2626',
        light: '#f87171',
        dark: '#b91c1c'
      },
      warning: {
        main: '#d97706',
        light: '#fbbf24',
        dark: '#b45309'
      },
      success: {
        main: '#059669',
        light: '#34d399',
        dark: '#047857'
      },
      background: {
        default: isDark ? '#0f172a' : '#f8fafc',
        paper: isDark ? '#111827' : '#ffffff'
      },
      text: {
        primary: isDark ? '#e5eefc' : '#1e293b',
        secondary: isDark ? '#94a3b8' : '#64748b'
      }
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 700,
        lineHeight: 1.2
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 600,
        lineHeight: 1.3
      },
      h3: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.4
      },
      h4: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.4
      },
      h5: {
        fontSize: '1rem',
        fontWeight: 600,
        lineHeight: 1.5
      },
      h6: {
        fontSize: '0.875rem',
        fontWeight: 600,
        lineHeight: 1.5
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.6
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.6
      }
    },
    shape: {
      borderRadius: 8
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
            backgroundImage: isDark
              ? 'radial-gradient(circle at top, rgba(37,99,235,0.16), transparent 35%)'
              : 'linear-gradient(180deg, rgba(96,165,250,0.08), transparent 220px)',
            minHeight: '100vh'
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            padding: '10px 20px'
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: isDark
                ? '0 8px 24px rgba(37, 99, 235, 0.32)'
                : '0 4px 12px rgba(37, 99, 235, 0.25)'
            }
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: isDark
              ? '0 8px 24px rgba(15, 23, 42, 0.42)'
              : '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
            borderRadius: 12,
            backgroundImage: 'none'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundImage: 'none'
          }
        }
      }
    }
  });
};

const updateDocumentTheme = (mode) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.style.colorScheme = mode;
  document.documentElement.dataset.theme = mode;
};

const dispatchThemeModeChange = (mode) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(THEME_MODE_EVENT, { detail: { mode } }));
};

export const syncThemeModeFromUserPreferences = (user) => {
  const mode = resolveThemeMode(user);

  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    updateDocumentTheme(mode);
    dispatchThemeModeChange(mode);
  }

  return mode;
};

export const ThemeModeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => resolveThemeMode(parseStoredUser()));

  useEffect(() => {
    updateDocumentTheme(mode);
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    const handleThemeEvent = (event) => {
      const nextMode = event.detail?.mode;
      if (nextMode === 'dark' || nextMode === 'light') {
        setMode(nextMode);
      }
    };

    const handleStorageEvent = (event) => {
      if (event.key === THEME_MODE_STORAGE_KEY && (event.newValue === 'dark' || event.newValue === 'light')) {
        setMode(event.newValue);
      }
    };

    window.addEventListener(THEME_MODE_EVENT, handleThemeEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener(THEME_MODE_EVENT, handleThemeEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  const setDarkMode = (enabled) => {
    setMode(enabled ? 'dark' : 'light');
  };

  const theme = buildTheme(mode);

  return (
    <ThemeModeContext.Provider
      value={{
        mode,
        darkMode: mode === 'dark',
        setMode,
        setDarkMode
      }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export const useThemeMode = () => {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }

  return context;
};
