/**
 * CHENGETO Health - Brand Mark
 * Renders the app logo with a safe fallback when the asset isn't present yet.
 */

import React, { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';

const BRAND_ASSETS = {
  square: '/brand/chengeto-logo-square.png',
  rect: '/brand/chengeto-logo-rect.png',
};

const BrandMark = ({
  variant = 'square',
  height = 40,
  showText = false,
  textVariant = 'h6',
}) => {
  const [hasError, setHasError] = useState(false);

  const src = useMemo(() => BRAND_ASSETS[variant] || BRAND_ASSETS.square, [variant]);
  const width = useMemo(() => {
    if (variant === 'rect') return Math.round(height * 3.3);
    return height;
  }, [variant, height]);

  if (hasError) {
    return (
      <Box
        sx={{
          width: height,
          height,
          bgcolor: 'primary.main',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: `${Math.max(16, Math.round(height * 0.5))}px`,
        }}
        aria-label="CHENGETO logo"
      >
        C
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Box
        component="img"
        src={src}
        alt="CHENGETO Health"
        loading="eager"
        onError={() => setHasError(true)}
        sx={{
          height,
          width,
          objectFit: 'contain',
          display: 'block',
        }}
      />
      {showText && (
        <Typography variant={textVariant} sx={{ fontWeight: 700 }} noWrap>
          CHENGETO
        </Typography>
      )}
    </Box>
  );
};

export default BrandMark;

