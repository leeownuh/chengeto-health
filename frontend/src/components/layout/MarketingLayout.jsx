/**
 * CHENGETO - Marketing Layout
 * Public-facing pages for visitors and potential customers.
 */

import React from 'react';
import { Outlet, NavLink as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Link,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import BrandMark from '../brand/BrandMark';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'How it works', to: '/how-it-works' },
  { label: 'For diaspora', to: '/diaspora' },
  { label: 'For elders', to: '/elders' },
  { label: 'Careers', to: '/careers' },
  { label: 'Contact', to: '/contact' },
  { label: 'FAQ', to: '/faq' },
];

const MarketingLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const navigate = useNavigate();

  const showNav = location.pathname === '/' || navItems.some((item) => item.to === location.pathname);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(255,255,255,0.92)',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ py: 1, gap: 2 }}>
            <Link
              component={RouterLink}
              to="/"
              underline="none"
              color="inherit"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}
              aria-label="CHENGETO home"
            >
              <BrandMark variant="square" height={36} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }} noWrap>
                  CHENGETO
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }} noWrap>
                  Proactive Elderly Care
                </Typography>
              </Box>
            </Link>

            <Box sx={{ flex: 1 }} />

            {showNav && !isMobile && (
              <Stack direction="row" spacing={0.5} sx={{ mr: 1 }}>
                {navItems.map((item) => (
                  <Button
                    key={item.to}
                    component={RouterLink}
                    to={item.to}
                    color="inherit"
                    sx={{
                      fontWeight: 700,
                      px: 1.5,
                      borderRadius: 999,
                      ...(location.pathname === item.to
                        ? { bgcolor: 'action.selected' }
                        : { '&:hover': { bgcolor: 'action.hover' } }),
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Stack>
            )}

            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="text" color="inherit" onClick={() => navigate('/login')} sx={{ fontWeight: 800 }}>
                Login
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/contact')}
                sx={{ fontWeight: 800, borderRadius: 999, px: 2 }}
              >
                Get started
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>

      <Divider />
      <Box component="footer" sx={{ py: 4, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                CHENGETO Health
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Support for elders across Zimbabwe, with peace of mind for families anywhere.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <Stack direction="row" spacing={2}>
                <Link component={RouterLink} to="/pricing" underline="hover" color="text.secondary">
                  Pricing
                </Link>
                <Link component={RouterLink} to="/how-it-works" underline="hover" color="text.secondary">
                  How it works
                </Link>
                <Link component={RouterLink} to="/careers" underline="hover" color="text.secondary">
                  Careers
                </Link>
                <Link component={RouterLink} to="/contact" underline="hover" color="text.secondary">
                  Contact
                </Link>
                <Link component={RouterLink} to="/faq" underline="hover" color="text.secondary">
                  FAQ
                </Link>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                © {new Date().getFullYear()} CHENGETO Health
              </Typography>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

export default MarketingLayout;
