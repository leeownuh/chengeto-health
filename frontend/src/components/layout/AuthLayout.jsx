/**
 * CHENGETO Health - Auth Layout Component
 * Layout for authentication pages
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Container, Paper, Typography, Link } from '@mui/material';
import BrandMark from '../brand/BrandMark';

const AuthLayout = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        {/* Logo */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
              boxShadow: 3,
            }}
          >
            <Box
              sx={{
                width: 320,
                maxWidth: '80vw',
                height: 72,
                bgcolor: 'rgba(255,255,255,0.98)',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 2,
              }}
            >
              <BrandMark variant="rect" height={56} />
            </Box>
          </Box>
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 700 }}>
            CHENGETO Health
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 1 }}>
            Proactive Elderly Care Monitoring
          </Typography>
        </Box>

        {/* Auth Card */}
        <Paper
          elevation={10}
          sx={{
            p: 4,
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Outlet />
        </Paper>

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            © {new Date().getFullYear()} CHENGETO Health. All rights reserved.
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Link href="#" variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mx: 1 }}>
              Privacy Policy
            </Link>
            <Link href="#" variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mx: 1 }}>
              Terms of Service
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default AuthLayout;
