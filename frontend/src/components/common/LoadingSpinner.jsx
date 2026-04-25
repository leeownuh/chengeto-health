import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const LoadingSpinner = ({
  message = 'Loading...',
  minHeight = '50vh',
  size = 48,
}) => {
  return (
    <Box
      sx={{
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        px: 2,
      }}
    >
      <CircularProgress size={size} />
      <Typography variant="body2" color="text.secondary" align="center">
        {message}
      </Typography>
    </Box>
  );
};

export default LoadingSpinner;
