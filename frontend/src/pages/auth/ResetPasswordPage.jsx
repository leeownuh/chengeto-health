/**
 * CHENGETO Health - Reset Password Page
 * Reset password with token from email
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  InputAdornment,
  IconButton,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Lock,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Error,
  ArrowForward,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { api } from '../../contexts/AuthContext';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    const validateToken = async () => {
      try {
        await api.get(`/auth/reset-password/${token}`);
        setTokenValid(true);
      } catch (err) {
        setTokenValid(false);
        setError('This password reset link is invalid or has expired.');
      } finally {
        setValidating(false);
      }
    };
    validateToken();
  }, [token]);

  useEffect(() => {
    // Calculate password strength
    let strength = 0;
    if (formData.password.length >= 8) strength += 1;
    if (/[a-z]/.test(formData.password)) strength += 1;
    if (/[A-Z]/.test(formData.password)) strength += 1;
    if (/\d/.test(formData.password)) strength += 1;
    if (/[^a-zA-Z0-9]/.test(formData.password)) strength += 1;
    setPasswordStrength(strength);
  }, [formData.password]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordStrength < 3) {
      setError('Please choose a stronger password');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        password: formData.password,
      });
      setSuccess(true);
      enqueueSnackbar('Password reset successfully!', { variant: 'success' });
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to reset password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength <= 1) return 'error.main';
    if (passwordStrength <= 2) return 'warning.main';
    if (passwordStrength <= 3) return 'info.main';
    return 'success.main';
  };

  const getStrengthLabel = () => {
    if (passwordStrength <= 1) return 'Weak';
    if (passwordStrength <= 2) return 'Fair';
    if (passwordStrength <= 3) return 'Good';
    return 'Strong';
  };

  if (validating) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (success) {
    return (
      <Paper elevation={0} sx={{ p: 4, maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: 'success.light',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <CheckCircle sx={{ fontSize: 32, color: 'success.dark' }} />
        </Box>
        <Typography variant="h5" gutterBottom fontWeight={600}>
          Password Reset!
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your password has been reset successfully. Redirecting to login...
        </Typography>
      </Paper>
    );
  }

  if (!tokenValid) {
    return (
      <Paper elevation={0} sx={{ p: 4, maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: 'error.light',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <Error sx={{ fontSize: 32, color: 'error.dark' }} />
        </Box>
        <Typography variant="h5" gutterBottom fontWeight={600}>
          Invalid Link
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {error}
        </Typography>
        <Link component={RouterLink} to="/forgot-password" underline="hover">
          <Button variant="contained">Request New Link</Button>
        </Link>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 4, maxWidth: 400, width: '100%' }}>
      <Typography variant="h4" align="center" gutterBottom fontWeight={700}>
        Reset Password
      </Typography>
      <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
        Enter your new password below.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="New Password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
          onChange={handleChange}
          required
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Lock color="action" />
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
        {formData.password && (
          <Box sx={{ mt: 1, mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: 'grey.200',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: `${(passwordStrength / 5) * 100}%`,
                    height: '100%',
                    bgcolor: getStrengthColor(),
                    transition: 'width 0.3s',
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: getStrengthColor() }}>
                {getStrengthLabel()}
              </Typography>
            </Box>
          </Box>
        )}
        <TextField
          fullWidth
          label="Confirm New Password"
          name="confirmPassword"
          type={showConfirmPassword ? 'text' : 'password'}
          value={formData.confirmPassword}
          onChange={handleChange}
          required
          sx={{ mt: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Lock color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  edge="end"
                >
                  {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading || !formData.password || !formData.confirmPassword}
          endIcon={<ArrowForward />}
          sx={{ mt: 3 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Reset Password'}
        </Button>
      </form>
    </Paper>
  );
};

export default ResetPasswordPage;
