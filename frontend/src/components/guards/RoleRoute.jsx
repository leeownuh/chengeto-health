/**
 * CHENGETO Health - Role-Based Route Guard
 * Renders different components based on user role
 */

import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const RoleRoute = ({ roles }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If user role matches, render the appropriate component
  if (user && roles[user.role]) {
    return roles[user.role];
  }

  // Fallback for unauthorized role
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        p: 3,
      }}
    >
      <Typography variant="h4" color="error" gutterBottom>
        Access Denied
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        You don't have permission to access this page. Please contact your administrator
        if you believe this is an error.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Your role: <strong>{user?.role || 'Unknown'}</strong>
      </Typography>
      <Button variant="contained" onClick={() => navigate('/dashboard')}>
        Go to Dashboard
      </Button>
    </Box>
  );
};

export default RoleRoute;
