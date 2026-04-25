/**
 * CHENGETO Health - Main Layout Component
 * Main application layout with sidebar navigation
 */

import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckInIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  CloudOff as CloudOffIcon,
  Cloud as CloudIcon,
  Sensors as SensorsIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useOffline } from '../../contexts/OfflineContext';
import BrandMark from '../brand/BrandMark';

const drawerWidth = 260;

const MainLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { alerts, isConnected } = useSocket();
  const { isOnline, pendingCount } = useOffline();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Navigation items based on role
  const getNavItems = () => {
    const baseItems = [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    ];

    const roleItems = {
      admin: [
        { text: 'Patients', icon: <PeopleIcon />, path: '/patients' },
        { text: 'Alerts', icon: <WarningIcon />, path: '/alerts', badge: alerts.filter(a => a.status === 'active').length },
        { text: 'Check-ins', icon: <CheckInIcon />, path: '/checkin' },
        { text: 'Schedule', icon: <ScheduleIcon />, path: '/schedule' },
        { text: 'IoT Simulator', icon: <SensorsIcon />, path: '/iot/simulator' },
        { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
      ],
      caregiver: [
        { text: 'My Patients', icon: <PeopleIcon />, path: '/patients' },
        { text: 'Alerts', icon: <WarningIcon />, path: '/alerts', badge: alerts.filter(a => a.status === 'active').length },
        { text: 'Check-in', icon: <CheckInIcon />, path: '/checkin' },
        { text: 'Schedule', icon: <ScheduleIcon />, path: '/schedule' },
      ],
      chw: [
        { text: 'Patients', icon: <PeopleIcon />, path: '/patients' },
        { text: 'Alerts', icon: <WarningIcon />, path: '/alerts', badge: alerts.filter(a => a.status === 'active').length },
        { text: 'Check-ins', icon: <CheckInIcon />, path: '/checkin' },
        { text: 'Schedule', icon: <ScheduleIcon />, path: '/schedule' },
        { text: 'IoT Simulator', icon: <SensorsIcon />, path: '/iot/simulator' },
      ],
      clinician: [
        { text: 'Patients', icon: <PeopleIcon />, path: '/patients' },
        { text: 'Alerts', icon: <WarningIcon />, path: '/alerts', badge: alerts.filter(a => a.status === 'active').length },
        { text: 'Analytics', icon: <ScheduleIcon />, path: '/analytics' },
      ],
      family: [
        { text: 'My Loved One', icon: <PeopleIcon />, path: '/patients' },
        { text: 'Activity', icon: <CheckInIcon />, path: '/checkin/history' },
      ],
    };

    return [...baseItems, ...(roleItems[user?.role] || [])];
  };

  const navItems = getNavItems();

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo and title */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <BrandMark variant="square" height={40} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>
            CHENGETO
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Health Monitoring
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Navigation */}
      <List sx={{ flex: 1, px: 1, py: 2 }}>
        {navItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => navigate(item.path)}
              selected={location.pathname === item.path}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'white',
                  '& .MuiListItemIcon-root': { color: 'white' },
                  '&:hover': { bgcolor: 'primary.dark' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {item.badge ? (
                  <Badge badgeContent={item.badge} color="error">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* User profile section */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
              {user?.role}
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleMenuOpen}>
            <MenuIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {navItems.find((item) => item.path === location.pathname)?.text || 'Dashboard'}
          </Typography>

          {/* Connection status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
            {isOnline ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CloudIcon fontSize="small" color={isConnected ? 'success' : 'warning'} />
                <Typography variant="caption" color="text.secondary">
                  {isConnected ? 'Connected' : 'Reconnecting...'}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CloudOffIcon fontSize="small" color="error" />
                <Typography variant="caption" color="error">
                  Offline
                </Typography>
              </Box>
            )}
          </Box>

          {/* Pending sync badge */}
          {pendingCount > 0 && (
            <Badge badgeContent={pendingCount} color="warning" sx={{ mr: 2 }}>
              <NotificationsIcon />
            </Badge>
          )}

          {/* Notifications */}
          <IconButton color="inherit">
            <Badge badgeContent={alerts.filter(a => a.status === 'active').length} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: '64px',
          minHeight: 'calc(100vh - 64px)',
          bgcolor: 'background.default',
        }}
      >
        <Outlet />
      </Box>

      {/* User menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); navigate('/settings'); }}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default MainLayout;
