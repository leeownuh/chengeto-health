/**
 * CHENGETO Health - MFA Setup Page
 * Setup and verify multi-factor authentication
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Security,
  Smartphone,
  VerifiedUser,
  ContentCopy,
  Refresh,
  Check,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../contexts/AuthContext';

const steps = ['Setup Authenticator', 'Verify Code', 'Complete'];

const MFASetupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [setupData, setSetupData] = useState({
    secret: '',
    qrCode: '',
    uri: '',
  });
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [backupCodes, setBackupCodes] = useState([]);
  const inputRefs = useRef([]);

  useEffect(() => {
    // Check if MFA setup is required
    if (user?.mfaEnabled && user?.mfaVerified) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    generateMFASetup();
  }, []);

  const generateMFASetup = async () => {
    setLoading(true);
    try {
      const response = await api.post('/auth/mfa/setup');
      const data = response.data?.data || response.data || {};
      setSetupData({
        secret: data.secret || data.manualEntryKey || '',
        qrCode: data.qrCode || '',
        uri: data.uri || '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate MFA setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newCode = [...verificationCode];
    newCode[index] = value.slice(-1); // Only take last character

    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (index === 5 && value) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        handleVerifyCode(fullCode);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async (code) => {
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/mfa/verify', {
        code: code || verificationCode.join(''),
      });
      const data = response.data?.data || response.data || {};
      setBackupCodes(data.backupCodes || []);
      setActiveStep(2);
      await refreshUser();
      enqueueSnackbar('MFA enabled successfully!', { variant: 'success' });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid verification code. Please try again.');
      setVerificationCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(setupData.secret);
    enqueueSnackbar('Secret key copied to clipboard', { variant: 'success' });
  };

  const handleComplete = () => {
    const from = location.state?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" color="text.secondary" paragraph>
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : setupData.qrCode ? (
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box
                  component="img"
                  src={setupData.qrCode}
                  alt="MFA QR Code"
                  sx={{
                    width: 200,
                    height: 200,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                />
              </Box>
            ) : (
              <Alert severity="error" sx={{ mb: 2 }}>
                Failed to generate QR code. Please refresh.
              </Alert>
            )}

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Or enter this code manually:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Card variant="outlined" sx={{ flex: 1 }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography
                      variant="body1"
                      fontFamily="monospace"
                      fontWeight={600}
                      letterSpacing={1}
                    >
                      {setupData.secret.match(/.{1,4}/g)?.join(' ')}
                    </Typography>
                  </CardContent>
                </Card>
                <IconButton onClick={handleCopySecret} title="Copy to clipboard">
                  <ContentCopy />
                </IconButton>
              </Box>
            </Box>

            <Button
              variant="contained"
              fullWidth
              onClick={() => setActiveStep(1)}
              disabled={!setupData.secret}
            >
              I&apos;ve Added the Account
            </Button>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" color="text.secondary" paragraph>
              Enter the 6-digit code from your authenticator app
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 1,
                mb: 3,
              }}
            >
              {verificationCode.map((digit, index) => (
                <TextField
                  key={index}
                  inputRef={(el) => (inputRefs.current[index] = el)}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  inputProps={{
                    maxLength: 1,
                    style: {
                      textAlign: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 600,
                      width: '3rem',
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: digit ? 'primary.main' : 'divider',
                        borderWidth: digit ? 2 : 1,
                      },
                    },
                  }}
                />
              ))}
            </Box>

            <Button
              variant="contained"
              fullWidth
              onClick={() => handleVerifyCode()}
              disabled={loading || verificationCode.some((d) => !d)}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify Code'}
            </Button>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'success.light',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3,
              }}
            >
              <VerifiedUser sx={{ fontSize: 40, color: 'success.dark' }} />
            </Box>

            <Typography variant="h5" gutterBottom fontWeight={600}>
              MFA Enabled!
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Save these backup codes in a safe place. You can use them to access your account
              if you lose your authenticator device.
            </Typography>

            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 1,
                  }}
                >
                  {backupCodes.map((code, index) => (
                    <Chip
                      key={index}
                      label={code}
                      variant="outlined"
                      sx={{ fontFamily: 'monospace' }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>

            <Button variant="contained" fullWidth onClick={handleComplete}>
              Continue to Dashboard
            </Button>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 4, maxWidth: 500, width: '100%' }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            bgcolor: 'primary.light',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <Security sx={{ fontSize: 28, color: 'primary.dark' }} />
        </Box>
        <Typography variant="h4" fontWeight={700}>
          Two-Factor Authentication
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add an extra layer of security to your account
        </Typography>
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {renderStepContent(activeStep)}
    </Paper>
  );
};

export default MFASetupPage;
