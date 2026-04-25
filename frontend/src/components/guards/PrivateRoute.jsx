/**
 * CHENGETO Health - Private Route Guard
 * Protects routes from unauthenticated access
 */

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

const PrivateRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page but save the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if MFA is required but not yet verified
  if (user && user.mfaEnabled && !user.mfaVerified) {
    return <Navigate to="/mfa-setup" state={{ from: location }} replace />;
  }

  // Check if password reset is required
  if (user && user.requiresPasswordReset) {
    return <Navigate to="/reset-password" state={{ from: location }} replace />;
  }

  return children || <Outlet />;
};

export default PrivateRoute;
