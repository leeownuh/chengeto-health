/**
 * CHENGETO - Public 404
 */

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Stack, Typography } from '@mui/material';

const NotFoundPage = () => {
  return (
    <Box sx={{ py: { xs: 8, md: 10 } }}>
      <Container maxWidth="md">
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="h3" sx={{ fontWeight: 950 }}>
            Page not found
          </Typography>
          <Typography variant="body1" color="text.secondary">
            The page you’re looking for doesn’t exist. Use the links below to get back on track.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
            <Button component={RouterLink} to="/" variant="contained" sx={{ borderRadius: 999, px: 3, fontWeight: 900 }}>
              Go home
            </Button>
            <Button component={RouterLink} to="/pricing" variant="outlined" sx={{ borderRadius: 999, px: 3, fontWeight: 900 }}>
              View pricing
            </Button>
            <Button component={RouterLink} to="/contact" variant="outlined" sx={{ borderRadius: 999, px: 3, fontWeight: 900 }}>
              Contact
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default NotFoundPage;
