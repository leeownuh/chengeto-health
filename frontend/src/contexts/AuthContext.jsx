/**
 * CHENGETO Health - Authentication Context
 * Manages user authentication state and operations
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { resolveApiUrl } from '../utils/runtimeUrls';
import { syncThemeModeFromUserPreferences } from './ThemeModeContext';

const AuthContext = createContext(null);

// API base URL
const API_URL = resolveApiUrl();
const REFRESH_BYPASS_PATHS = ['/auth/login', '/auth/refresh'];

const clearStoredAuth = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
};

const normalizeUser = (value) => {
  if (!value) {
    return value;
  }

  const normalizedId = value._id || value.id;

  return {
    ...value,
    _id: normalizedId,
    id: normalizedId
  };
};

const redirectToLogin = () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
};

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let refreshRequestPromise = null;

// Response interceptor for handling token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const requestUrl = originalRequest.url || '';
    const shouldBypassRefresh = REFRESH_BYPASS_PATHS.some((path) => requestUrl.includes(path));

    if (error.response?.status !== 401 || originalRequest._retry || shouldBypassRefresh) {
      if (error.response?.status === 401 && requestUrl.includes('/auth/refresh')) {
        clearStoredAuth();
        redirectToLogin();
      }

      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshRequestPromise) {
        refreshRequestPromise = api
          .post('/auth/refresh')
          .then((response) => {
            const { accessToken } = response.data.data;
            localStorage.setItem('accessToken', accessToken);
            return accessToken;
          })
          .catch((refreshError) => {
            clearStoredAuth();
            redirectToLogin();
            throw refreshError;
          })
          .finally(() => {
            refreshRequestPromise = null;
          });
      }

      const accessToken = await refreshRequestPromise;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('accessToken');
      
      if (storedUser && token) {
        // Optimistic offline-first: use the persisted user immediately so protected
        // routes can render even when the API is temporarily unreachable.
        try {
          const parsed = JSON.parse(storedUser);
          const nextUser = normalizeUser(parsed);
          setUser(nextUser);
          syncThemeModeFromUserPreferences(nextUser);
        } catch {
          // ignore malformed localStorage user
        }

        try {
          const response = await api.get('/auth/me');
          const nextUser = normalizeUser(response.data.data);
          setUser(nextUser);
          localStorage.setItem('user', JSON.stringify(nextUser));
          syncThemeModeFromUserPreferences(nextUser);
        } catch (err) {
          const status = err?.response?.status;
          const isNetworkError = !err?.response;
          const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

          // If we're offline (or the API is unreachable), keep the persisted session.
          // Only clear on explicit auth failures.
          if (!offline && !isNetworkError && status === 401) {
            clearStoredAuth();
            setUser(null);
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await api.get('/auth/me');
    const nextUser = normalizeUser(response.data.data);

    setUser(nextUser);
    localStorage.setItem('user', JSON.stringify(nextUser));
    syncThemeModeFromUserPreferences(nextUser);

    return nextUser;
  }, []);

  // Login function
  const login = useCallback(async (email, password, mfaCode = null, deviceFingerprint = null) => {
    setError(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email,
        password,
        mfaCode,
        deviceFingerprint,
      });

      const { user: rawUserData, accessToken, refreshToken, requiresMFA } = response.data.data;
      const userData = normalizeUser(rawUserData);

      if (requiresMFA) {
        setLoading(false);
        return { requiresMFA: true };
      }

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(userData));
      syncThemeModeFromUserPreferences(userData);
      setUser(userData);
      setLoading(false);

      return { success: true, user: userData };
    } catch (err) {
      setLoading(false);
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // Register function
  const register = useCallback(async (userData) => {
    setError(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/register', userData);
      const { user: rawNewUser, accessToken } = response.data.data;
      const newUser = normalizeUser(rawNewUser);

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      syncThemeModeFromUserPreferences(newUser);
      setUser(newUser);
      setLoading(false);

      return { success: true, user: newUser };
    } catch (err) {
      setLoading(false);
      const message = err.response?.data?.message || 'Registration failed';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      setUser(null);
    }
  }, []);

  // Update profile
  const updateProfile = useCallback(async (updates) => {
    try {
      const response = await api.put('/auth/me', updates);
      const updatedUser = normalizeUser(response.data.data);
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      syncThemeModeFromUserPreferences(updatedUser);
      return { success: true, user: updatedUser };
    } catch (err) {
      const message = err.response?.data?.message || 'Update failed';
      return { success: false, error: message };
    }
  }, []);

  // Change password
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Password change failed';
      return { success: false, error: message };
    }
  }, []);

  // Forgot password
  const forgotPassword = useCallback(async (email) => {
    try {
      await api.post('/auth/forgot-password', { email });
      return { success: true };
    } catch (err) {
      return { success: true }; // Don't reveal if email exists
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (token, password) => {
    try {
      const response = await api.post('/auth/reset-password', { token, password });
      const { accessToken, refreshToken } = response.data.data;
      localStorage.setItem('accessToken', accessToken);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Reset failed';
      return { success: false, error: message };
    }
  }, []);

  // Setup MFA
  const setupMFA = useCallback(async () => {
    try {
      const response = await api.post('/auth/mfa/setup');
      return { success: true, data: response.data.data };
    } catch (err) {
      const message = err.response?.data?.message || 'MFA setup failed';
      return { success: false, error: message };
    }
  }, []);

  // Verify MFA
  const verifyMFA = useCallback(async (code) => {
    try {
      await api.post('/auth/mfa/verify', { code });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Verification failed';
      return { success: false, error: message };
    }
  }, []);

  // Check if user has permission
  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    return user.permissions?.includes(permission) || user.role === 'admin';
  }, [user]);

  // Check if user has role
  const hasRole = useCallback((roles) => {
    if (!user) return false;
    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    return user.role === roles;
  }, [user]);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    setupMFA,
    verifyMFA,
    refreshUser,
    hasPermission,
    hasRole,
    api, // Export api instance for use in other components
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { api };
export default AuthContext;
