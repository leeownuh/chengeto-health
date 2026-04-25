/**
 * CHENGETO Health - Forgot Password Page
 * Request password reset via email
 */

import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  InputAdornment,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Email, ArrowBack, MarkEmailRead } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';

const ForgotPasswordPage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('/api/auth/forgot-password', { email });
      setSubmitted(true);
      enqueueSnackbar('Password reset instructions sent to your email', {
        variant: 'success',
      });
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to send reset email. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
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
          <MarkEmailRead sx={{ fontSize: 32, color: 'success.dark' }} />
        </Box>
        <Typography variant="h5" gutterBottom fontWeight={600}>
          Check Your Email
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          We&apos;ve sent password reset instructions to <strong>{email}</strong>. Please check
          your inbox and follow the link to reset your password.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Didn&apos;t receive the email? Check your spam folder or{' '}
          <Link
            component="button"
            onClick={() => setSubmitted(false)}
            underline="hover"
          >
            try again
          </Link>
        </Typography>
        <Link component={RouterLink} to="/login" underline="hover">
          <Button startIcon={<ArrowBack />}>Back to Login</Button>
        </Link>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 4, maxWidth: 400, width: '100%' }}>
      <Typography variant="h4" align="center" gutterBottom fontWeight={700}>
        Forgot Password?
      </Typography>
      <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
        Enter your email address and we&apos;ll send you instructions to reset your password.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Email color="action" />
              </InputAdornment>
            ),
          }}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading || !email}
          sx={{ mt: 3 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Send Reset Link'}
        </Button>
      </form>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Link component={RouterLink} to="/login" underline="hover">
          <Button startIcon={<ArrowBack />}>Back to Login</Button>
        </Link>
      </Box>
    </Paper>
  );
};

export default ForgotPasswordPage;
