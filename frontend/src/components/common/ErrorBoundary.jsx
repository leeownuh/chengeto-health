import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep a console trace for debugging (especially useful when an overlay is disabled).
    console.error('App crashed:', error, info);
  }

  render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (!hasError) return children;

    return (
      <Box sx={{ py: { xs: 6, md: 10 } }}>
        <Container maxWidth="md">
          <Stack spacing={2}>
            <Typography variant="h4" sx={{ fontWeight: 950 }}>
              Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary">
              The page crashed while loading. Please refresh. If it keeps happening, share the error message below.
            </Typography>
            {error?.message && (
              <Box
                component="pre"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  m: 0,
                  fontSize: 12,
                }}
              >
                {error.message}
              </Box>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button variant="contained" onClick={() => window.location.reload()} sx={{ borderRadius: 999, fontWeight: 900 }}>
                Refresh
              </Button>
              <Button variant="outlined" onClick={() => (window.location.href = '/')} sx={{ borderRadius: 999, fontWeight: 900 }}>
                Go home
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
    );
  }
}

export default ErrorBoundary;
