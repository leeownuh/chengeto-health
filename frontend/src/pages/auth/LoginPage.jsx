/**
 * CHENGETO Health - Login Page
 * User authentication with MFA support
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Get device fingerprint
    const deviceFingerprint = {
      fingerprint: getDeviceFingerprint(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    };

    const result = await login(email, password, null, deviceFingerprint);
    
    if (result.requiresMFA) {
      setMfaRequired(true);
      setLoading(false);
    } else if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login failed');
      setLoading(false);
    }
  };

  const handleMFASubmit = async (e) => {
    e.preventDefault();
    setMfaError('');
    setLoading(true);

    const result = await login(email, password, mfaCode);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setMfaError(result.error || 'Invalid MFA code');
      setLoading(false);
    }
  };

  const getDeviceFingerprint = () => {
    // Simple fingerprint generation
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
    ];
    return btoa(components.join('|'));
  };

  return (
    <>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
        Welcome Back
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Sign in to access the CHENGETO Health platform
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailIcon color="action" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          fullWidth
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Link to="/forgot-password" style={{ textDecoration: 'none' }}>
            <Typography variant="body2" color="primary">
              Forgot password?
            </Typography>
          </Link>
        </Box>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ py: 1.5, mb: 2 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
        </Button>

        <Divider sx={{ my: 3 }}>
          <Typography variant="body2" color="text.secondary">
            OR
          </Typography>
        </Divider>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{' '}
            <Link to="/register" style={{ textDecoration: 'none' }}>
              <Typography component="span" variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                Sign Up
              </Typography>
            </Link>
          </Typography>
        </Box>
      </Box>

      {/* MFA Dialog */}
      <Dialog open={mfaRequired} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon color="primary" />
          Two-Factor Authentication
        </DialogTitle>
        <form onSubmit={handleMFASubmit}>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the 6-digit code from your authenticator app
            </Typography>
            
            {mfaError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {mfaError}
              </Alert>
            )}

            <TextField
              fullWidth
              label="6-digit code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              autoFocus
              inputProps={{
                maxLength: 6,
                pattern: '[0-9]*',
                inputMode: 'numeric',
                style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em' },
              }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setMfaRequired(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={loading || mfaCode.length !== 6}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
};

export default LoginPage;