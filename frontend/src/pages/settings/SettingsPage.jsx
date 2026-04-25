import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Palette as PaletteIcon,
  Language as LanguageIcon,
  Bluetooth as BluetoothIcon,
  GpsFixed as GpsIcon,
  Storage as StorageIcon,
  Backup as BackupIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PhotoCamera as CameraIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Smartphone as SmartphoneIcon,
  History as HistoryIcon,
  CloudSync as CloudSyncIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useThemeMode } from '../../contexts/ThemeModeContext';

// Tab panel component
const TabPanel = ({ value, index, children }) => (
  <Box hidden={value !== index} sx={{ pt: 3 }}>
    {value === index && children}
  </Box>
);

// Setting section component
const SettingSection = ({ title, children }) => (
  <Paper variant="outlined" sx={{ mb: 2 }}>
    <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
      <Typography variant="subtitle1" fontWeight="bold">
        {title}
      </Typography>
    </Box>
    <Divider />
    <Box sx={{ p: 2 }}>{children}</Box>
  </Paper>
);

// Change password dialog
const ChangePasswordDialog = ({ open, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async () => {
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await onSave?.(formData);
      onClose();
    } catch (err) {
      setError('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Change Password</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          margin="normal"
          label="Current Password"
          type={showPasswords ? 'text' : 'password'}
          value={formData.currentPassword}
          onChange={(e) => handleChange('currentPassword', e.target.value)}
          InputProps={{
            endAdornment: (
              <IconButton onClick={() => setShowPasswords(!showPasswords)} edge="end">
                {showPasswords ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            ),
          }}
        />
        <TextField
          fullWidth
          margin="normal"
          label="New Password"
          type={showPasswords ? 'text' : 'password'}
          value={formData.newPassword}
          onChange={(e) => handleChange('newPassword', e.target.value)}
        />
        <TextField
          fullWidth
          margin="normal"
          label="Confirm New Password"
          type={showPasswords ? 'text' : 'password'}
          value={formData.confirmPassword}
          onChange={(e) => handleChange('confirmPassword', e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !formData.currentPassword || !formData.newPassword}
        >
          {loading ? 'Saving...' : 'Change Password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Two-factor authentication dialog
const TwoFactorDialog = ({ open, onClose, enabled, onToggle }) => {
  const [step, setStep] = useState(0);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);

  useEffect(() => {
    if (open && !enabled) {
      // Generate backup codes
      setBackupCodes(
        Array.from({ length: 10 }, () =>
          Math.random().toString(36).substring(2, 8).toUpperCase()
        )
      );
    }
  }, [open, enabled]);

  const handleVerify = async () => {
    if (code.length === 6) {
      await onToggle?.(true);
      setStep(2);
    }
  };

  const handleDisable = async () => {
    await onToggle?.(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {enabled ? 'Two-Factor Authentication' : 'Set Up Two-Factor Authentication'}
      </DialogTitle>
      <DialogContent>
        {!enabled ? (
          <>
            {step === 0 && (
              <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Two-factor authentication adds an extra layer of security to your account.
                </Alert>
                <Typography variant="body2" gutterBottom>
                  To set up 2FA, you&apos;ll need an authenticator app like:
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="Google Authenticator" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Microsoft Authenticator" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Authy" />
                  </ListItem>
                </List>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => setStep(1)}
                  sx={{ mt: 2 }}
                >
                  Continue
                </Button>
              </Box>
            )}
            {step === 1 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Scan this QR code with your authenticator app:
                </Typography>
                <Box
                  sx={{
                    width: 200,
                    height: 200,
                    bgcolor: 'grey.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    my: 2,
                  }}
                >
                  <Typography variant="caption">QR Code Placeholder</Typography>
                </Box>
                <Typography variant="subtitle2" gutterBottom>
                  Or enter this code manually:
                </Typography>
                <TextField
                  fullWidth
                  value="JBSWY3DPEHPK3PXP"
                  InputProps={{ readOnly: true }}
                  sx={{ mb: 2 }}
                />
                <Typography variant="subtitle2" gutterBottom>
                  Enter the 6-digit code from your app:
                </Typography>
                <TextField
                  fullWidth
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputProps={{ style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: 8 } }}
                />
              </Box>
            )}
            {step === 2 && (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }} icon={<CheckIcon />}>
                  Two-factor authentication is now enabled!
                </Alert>
                <Typography variant="subtitle2" gutterBottom>
                  Save these backup codes in a safe place:
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Grid container spacing={1}>
                    {backupCodes.map((code, i) => (
                      <Grid item xs={6} key={i}>
                        <Typography variant="body2" fontFamily="monospace">
                          {code}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
                <Button variant="outlined" startIcon={<DownloadIcon />} sx={{ mt: 2 }}>
                  Download Backup Codes
                </Button>
              </Box>
            )}
          </>
        ) : (
          <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Two-factor authentication is currently enabled.
            </Alert>
            <Typography variant="body2" color="text.secondary" paragraph>
              Disabling 2FA will make your account less secure.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              onClick={handleDisable}
            >
              Disable Two-Factor Authentication
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {step === 2 ? 'Done' : 'Cancel'}
        </Button>
        {step === 1 && (
          <Button
            variant="contained"
            onClick={handleVerify}
            disabled={code.length !== 6}
          >
            Verify
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

const SettingsPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, updateProfile, changePassword, refreshUser } = useAuth();
  const { socket } = useSocket();
  const { darkMode, setDarkMode } = useThemeMode();

  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [pwaStatus, setPwaStatus] = useState({
    supported: false,
    controller: false,
    registrations: 0,
    displayMode: 'browser',
    manifest: null,
    cacheKeys: [],
    notificationPermission: 'default'
  });

  // Settings state
  const [settings, setSettings] = useState({
    // Profile
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '+263',
    language: 'en',
    timezone: 'Africa/Harare',

    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: true,
    alertSounds: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    notifyOnNewAlert: true,
    notifyOnMissedCheckin: true,
    notifyOnScheduleReminder: true,
    notifyOnPatientUpdate: true,

    // Security
    twoFactorEnabled: false,
    sessionTimeout: 30,
    loginAlerts: true,

    // Appearance
    darkMode,
    compactMode: false,
    fontSize: 'medium',

    // Connectivity
    bleEnabled: true,
    nfcEnabled: true,
    gpsEnabled: true,
    offlineMode: false,
    autoSync: true,
    syncInterval: 5,

    // Data
    autoBackup: true,
    backupInterval: 'weekly',
    dataRetention: 90,
    analyticsEnabled: true,
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    const persistedSettings = user.preferences?.appSettings || {};

    setSettings((prev) => ({
      ...prev,
      ...persistedSettings,
      firstName: user.firstName || prev.firstName,
      lastName: user.lastName || prev.lastName,
      email: user.email || prev.email,
      phone: user.phone || prev.phone,
      language: user.language || persistedSettings.language || prev.language,
      darkMode,
    }));
  }, [user, darkMode]);

  useEffect(() => {
    const loadPwaStatus = async () => {
      const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator;
      const controller = supported ? Boolean(navigator.serviceWorker.controller) : false;
      const displayMode =
        typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
          ? 'standalone'
          : 'browser';

      let registrations = 0;
      if (supported) {
        const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
        registrations = Array.isArray(regs) ? regs.length : 0;
      }

      let manifest = null;
      try {
        const response = await fetch('/manifest.json', { cache: 'no-store' });
        if (response.ok) {
          manifest = await response.json();
        }
      } catch {
        // ignore
      }

      let cacheKeys = [];
      if (typeof window !== 'undefined' && 'caches' in window) {
        cacheKeys = await caches.keys().catch(() => []);
      }

      const notificationPermission =
        typeof window !== 'undefined' && 'Notification' in window
          ? Notification.permission
          : 'unsupported';

      setPwaStatus({
        supported,
        controller,
        registrations,
        displayMode,
        manifest,
        cacheKeys,
        notificationPermission
      });
    };

    loadPwaStatus();
  }, []);

  // Dialogs
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSettingChange = (field, value) => {
    if (field === 'darkMode') {
      setDarkMode(value);
    }

    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveSettings = async (section) => {
    setLoading(true);
    try {
      const result = await updateProfile({
        email: settings.email,
        firstName: settings.firstName,
        lastName: settings.lastName,
        phone: settings.phone,
        language: settings.language,
        preferences: {
          appSettings: settings
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save settings');
      }

      await refreshUser();
      showSnackbar(`${section.charAt(0).toUpperCase()}${section.slice(1)} settings saved successfully`);
    } catch (error) {
      console.error('Error saving settings:', error);
      showSnackbar(error.message || 'Failed to save settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (data) => {
    try {
      const result = await changePassword(data.currentPassword, data.newPassword);

      if (!result.success) {
        throw new Error(result.error || 'Failed to change password');
      }

      showSnackbar('Password changed successfully');
    } catch (error) {
      showSnackbar(error.message || 'Failed to change password', 'error');
    }
  };

  const handleToggle2FA = async (enabled) => {
    setSettings((prev) => ({ ...prev, twoFactorEnabled: enabled }));
    showSnackbar(enabled ? 'MFA setup is available from the dedicated MFA page after login.' : 'Disable MFA from your authenticated MFA settings flow.', 'info');
  };

  const handleExportData = async () => {
    showSnackbar('Data export started. You will receive an email when ready.');
  };

  const handleClearCache = () => {
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    localStorage.removeItem('cachedData');
    showSnackbar('Cache cleared successfully');
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your account settings and preferences
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons="auto"
        >
          <Tab icon={<PersonIcon />} label="Profile" />
          <Tab icon={<NotificationsIcon />} label="Notifications" />
          <Tab icon={<SecurityIcon />} label="Security" />
          <Tab icon={<PaletteIcon />} label="Appearance" />
          <Tab icon={<BluetoothIcon />} label="Connectivity" />
          <Tab icon={<StorageIcon />} label="Data" />
        </Tabs>
      </Paper>

      {/* Profile Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                  <Avatar
                    src={user?.avatar}
                    sx={{ width: 120, height: 120, mb: 2, mx: 'auto' }}
                  >
                    {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </Avatar>
                  <IconButton
                    size="small"
                    sx={{
                      position: 'absolute',
                      bottom: 10,
                      right: 0,
                      bgcolor: 'primary.main',
                      color: 'white',
                      '&:hover': { bgcolor: 'primary.dark' },
                    }}
                  >
                    <CameraIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Typography variant="h6">
                  {settings.firstName} {settings.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                </Typography>
                <Chip
                  label={user?.verified ? 'Verified' : 'Unverified'}
                  color={user?.verified ? 'success' : 'default'}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <SettingSection title="Personal Information">
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={settings.firstName}
                    onChange={(e) => handleSettingChange('firstName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={settings.lastName}
                    onChange={(e) => handleSettingChange('lastName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={settings.email}
                    onChange={(e) => handleSettingChange('email', e.target.value)}
                    InputProps={{
                      startAdornment: <EmailIcon color="action" sx={{ mr: 1 }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={settings.phone}
                    onChange={(e) => handleSettingChange('phone', e.target.value)}
                    InputProps={{
                      startAdornment: <PhoneIcon color="action" sx={{ mr: 1 }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Language</InputLabel>
                    <Select
                      value={settings.language}
                      label="Language"
                      onChange={(e) => handleSettingChange('language', e.target.value)}
                    >
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="sn">Shona</MenuItem>
                      <MenuItem value="nd">Ndebele</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Timezone</InputLabel>
                    <Select
                      value={settings.timezone}
                      label="Timezone"
                      onChange={(e) => handleSettingChange('timezone', e.target.value)}
                    >
                      <MenuItem value="Africa/Harare">Africa/Harare (CAT)</MenuItem>
                      <MenuItem value="Africa/Johannesburg">Africa/Johannesburg (SAST)</MenuItem>
                      <MenuItem value="UTC">UTC</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => handleSaveSettings('profile')}
                  disabled={loading}
                >
                  Save Changes
                </Button>
              </Box>
            </SettingSection>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Notifications Tab */}
      <TabPanel value={tabValue} index={1}>
        <SettingSection title="Notification Channels">
          <List>
            <ListItem>
              <ListItemIcon><EmailIcon /></ListItemIcon>
              <ListItemText
                primary="Email Notifications"
                secondary="Receive notifications via email"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.emailNotifications}
                  onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon><SmartphoneIcon /></ListItemIcon>
              <ListItemText
                primary="Push Notifications"
                secondary="Receive push notifications on your device"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.pushNotifications}
                  onChange={(e) => handleSettingChange('pushNotifications', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon><PhoneIcon /></ListItemIcon>
              <ListItemText
                primary="SMS Notifications"
                secondary="Receive notifications via SMS"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.smsNotifications}
                  onChange={(e) => handleSettingChange('smsNotifications', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemText
                primary="Alert Sounds"
                secondary="Play sounds for notifications"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.alertSounds}
                  onChange={(e) => handleSettingChange('alertSounds', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </SettingSection>

        <SettingSection title="Quiet Hours">
          <List>
            <ListItem>
              <ListItemText
                primary="Enable Quiet Hours"
                secondary="Mute notifications during specified hours"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.quietHoursEnabled}
                  onChange={(e) => handleSettingChange('quietHoursEnabled', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
          {settings.quietHoursEnabled && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="time"
                  label="Start Time"
                  value={settings.quietHoursStart}
                  onChange={(e) => handleSettingChange('quietHoursStart', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="time"
                  label="End Time"
                  value={settings.quietHoursEnd}
                  onChange={(e) => handleSettingChange('quietHoursEnd', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          )}
        </SettingSection>

        <SettingSection title="Notification Types">
          <List>
            {[
              { field: 'notifyOnNewAlert', label: 'New Alerts', desc: 'Critical patient alerts' },
              { field: 'notifyOnMissedCheckin', label: 'Missed Check-ins', desc: 'When a patient misses a scheduled check-in' },
              { field: 'notifyOnScheduleReminder', label: 'Schedule Reminders', desc: 'Upcoming appointment reminders' },
              { field: 'notifyOnPatientUpdate', label: 'Patient Updates', desc: 'Changes to patient information' },
            ].map((item) => (
              <ListItem key={item.field}>
                <ListItemText primary={item.label} secondary={item.desc} />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings[item.field]}
                    onChange={(e) => handleSettingChange(item.field, e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </SettingSection>

        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            onClick={() => handleSaveSettings('notifications')}
            disabled={loading}
          >
            Save Notification Settings
          </Button>
        </Box>
      </TabPanel>

      {/* Security Tab */}
      <TabPanel value={tabValue} index={2}>
        <SettingSection title="Password">
          <List>
            <ListItem>
              <ListItemIcon><LockIcon /></ListItemIcon>
              <ListItemText
                primary="Change Password"
                secondary="Last changed 30 days ago"
              />
              <ListItemSecondaryAction>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  Change
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </SettingSection>

        <SettingSection title="Two-Factor Authentication">
          <List>
            <ListItem>
              <ListItemIcon><SecurityIcon /></ListItemIcon>
              <ListItemText
                primary="Two-Factor Authentication"
                secondary={settings.twoFactorEnabled ? 'Enabled' : 'Add an extra layer of security'}
              />
              <ListItemSecondaryAction>
                <Button
                  variant={settings.twoFactorEnabled ? 'outlined' : 'contained'}
                  color={settings.twoFactorEnabled ? 'success' : 'primary'}
                  onClick={() => setTwoFactorDialogOpen(true)}
                >
                  {settings.twoFactorEnabled ? 'Manage' : 'Enable'}
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </SettingSection>

        <SettingSection title="Session Settings">
          <List>
            <ListItem>
              <ListItemText
                primary="Session Timeout"
                secondary={`Automatically log out after ${settings.sessionTimeout} minutes of inactivity`}
              />
            </ListItem>
          </List>
          <Box sx={{ px: 2 }}>
            <Slider
              value={settings.sessionTimeout}
              onChange={(e, v) => handleSettingChange('sessionTimeout', v)}
              min={5}
              max={120}
              step={5}
              marks={[
                { value: 5, label: '5 min' },
                { value: 30, label: '30 min' },
                { value: 60, label: '1 hour' },
                { value: 120, label: '2 hours' },
              ]}
              valueLabelDisplay="auto"
            />
          </Box>
          <List>
            <Divider sx={{ my: 1 }} />
            <ListItem>
              <ListItemText
                primary="Login Alerts"
                secondary="Get notified when someone logs into your account from a new device"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.loginAlerts}
                  onChange={(e) => handleSettingChange('loginAlerts', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </SettingSection>

        <SettingSection title="Active Sessions">
          <List>
            <ListItem>
              <ListItemIcon><SmartphoneIcon /></ListItemIcon>
              <ListItemText
                primary="Current Device"
                secondary="Chrome on Windows • Active now"
              />
              <Chip label="Current" color="success" size="small" />
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon><SmartphoneIcon /></ListItemIcon>
              <ListItemText
                primary="Mobile App"
                secondary="iPhone 13 • 2 hours ago"
              />
              <ListItemSecondaryAction>
                <Button size="small" color="error">Revoke</Button>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </SettingSection>

        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            onClick={() => handleSaveSettings('security')}
            disabled={loading}
          >
            Save Security Settings
          </Button>
        </Box>
      </TabPanel>

      {/* Appearance Tab */}
      <TabPanel value={tabValue} index={3}>
        <SettingSection title="Theme">
          <List>
            <ListItem>
              <ListItemIcon><PaletteIcon /></ListItemIcon>
              <ListItemText
                primary="Dark Mode"
                secondary="Use dark theme for the application"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.darkMode}
                  onChange={(e) => handleSettingChange('darkMode', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemText
                primary="Compact Mode"
                secondary="Reduce spacing for more content on screen"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.compactMode}
                  onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemText primary="Font Size" />
            </ListItem>
          </List>
          <Box sx={{ px: 2 }}>
            <ToggleButtonGroup
              value={settings.fontSize}
              exclusive
              onChange={(e, v) => v && handleSettingChange('fontSize', v)}
              size="small"
            >
              <ToggleButton value="small">Small</ToggleButton>
              <ToggleButton value="medium">Medium</ToggleButton>
              <ToggleButton value="large">Large</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </SettingSection>

        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            onClick={() => handleSaveSettings('appearance')}
            disabled={loading}
          >
            Save Appearance Settings
          </Button>
        </Box>
      </TabPanel>

      {/* Connectivity Tab */}
      <TabPanel value={tabValue} index={4}>
        <SettingSection title="Verification Methods">
          <List>
            <ListItem>
              <ListItemIcon><BluetoothIcon /></ListItemIcon>
              <ListItemText
                primary="Bluetooth (BLE)"
                secondary="Use Bluetooth for proximity verification"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.bleEnabled}
                  onChange={(e) => handleSettingChange('bleEnabled', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon><SmartphoneIcon /></ListItemIcon>
              <ListItemText
                primary="NFC"
                secondary="Use NFC tap-to-verify for check-ins"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.nfcEnabled}
                  onChange={(e) => handleSettingChange('nfcEnabled', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon><GpsIcon /></ListItemIcon>
              <ListItemText
                primary="GPS Location"
                secondary="Use GPS for location verification"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.gpsEnabled}
                  onChange={(e) => handleSettingChange('gpsEnabled', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </SettingSection>

        <SettingSection title="Offline & Sync">
          <List>
            <ListItem>
              <ListItemText
                primary="Offline Mode"
                secondary="Work without internet connection (data will sync when connected)"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.offlineMode}
                  onChange={(e) => handleSettingChange('offlineMode', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemText
                primary="Auto Sync"
                secondary="Automatically sync data when online"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.autoSync}
                  onChange={(e) => handleSettingChange('autoSync', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
          {settings.autoSync && (
            <Box sx={{ px: 2, mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                Sync Interval: Every {settings.syncInterval} minutes
              </Typography>
              <Slider
                value={settings.syncInterval}
                onChange={(e, v) => handleSettingChange('syncInterval', v)}
                min={1}
                max={30}
                valueLabelDisplay="auto"
              />
            </Box>
          )}

          <Box sx={{ px: 2, mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              PWA Status (proof)
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Service Worker: {pwaStatus.supported ? 'supported' : 'not supported'} - Registrations: {pwaStatus.registrations} - Controlling: {pwaStatus.controller ? 'yes' : 'no'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Display Mode: {pwaStatus.displayMode}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manifest: {pwaStatus.manifest ? (pwaStatus.manifest.name || pwaStatus.manifest.short_name || 'loaded') : 'not detected'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Caches: {Array.isArray(pwaStatus.cacheKeys) ? pwaStatus.cacheKeys.length : 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Notifications: {pwaStatus.notificationPermission}
              </Typography>
            </Box>
            {'Notification' in window && pwaStatus.notificationPermission !== 'granted' && (
              <Box sx={{ mt: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={async () => {
                    try {
                      const permission = await Notification.requestPermission();
                      setPwaStatus((prev) => ({ ...prev, notificationPermission: permission }));
                      showSnackbar(permission === 'granted' ? 'Notifications enabled' : 'Notifications not enabled', 'info');
                    } catch {
                      showSnackbar('Failed to request notification permission', 'error');
                    }
                  }}
                >
                  Enable Notifications
                </Button>
              </Box>
            )}
          </Box>
        </SettingSection>

        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            onClick={() => handleSaveSettings('connectivity')}
            disabled={loading}
          >
            Save Connectivity Settings
          </Button>
        </Box>
      </TabPanel>

      {/* Data Tab */}
      <TabPanel value={tabValue} index={5}>
        <SettingSection title="Backup & Export">
          <List>
            <ListItem>
              <ListItemIcon><BackupIcon /></ListItemIcon>
              <ListItemText
                primary="Automatic Backup"
                secondary="Automatically backup your data"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.autoBackup}
                  onChange={(e) => handleSettingChange('autoBackup', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
            {settings.autoBackup && (
              <>
                <Divider />
                <ListItem>
                  <ListItemText primary="Backup Frequency" />
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={settings.backupInterval}
                      onChange={(e) => handleSettingChange('backupInterval', e.target.value)}
                    >
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                    </Select>
                  </FormControl>
                </ListItem>
              </>
            )}
          </List>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportData}
              sx={{ mr: 1 }}
            >
              Export Data
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
            >
              Import Data
            </Button>
          </Box>
        </SettingSection>

        <SettingSection title="Storage">
          <List>
            <ListItem>
              <ListItemIcon><StorageIcon /></ListItemIcon>
              <ListItemText
                primary="Data Retention"
                secondary={`Keep data for ${settings.dataRetention} days`}
              />
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Select
                  value={settings.dataRetention}
                  onChange={(e) => handleSettingChange('dataRetention', e.target.value)}
                >
                  <MenuItem value={30}>30 days</MenuItem>
                  <MenuItem value={60}>60 days</MenuItem>
                  <MenuItem value={90}>90 days</MenuItem>
                  <MenuItem value={180}>180 days</MenuItem>
                  <MenuItem value={365}>1 year</MenuItem>
                </Select>
              </FormControl>
            </ListItem>
          </List>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Storage Used
            </Typography>
            <LinearProgress variant="determinate" value={45} sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              450 MB of 1 GB used
            </Typography>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<DeleteIcon />}
              onClick={handleClearCache}
            >
              Clear Cache
            </Button>
          </Box>
        </SettingSection>

        <SettingSection title="Analytics">
          <List>
            <ListItem>
              <ListItemText
                primary="Usage Analytics"
                secondary="Help improve the app by sharing anonymous usage data"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={settings.analyticsEnabled}
                  onChange={(e) => handleSettingChange('analyticsEnabled', e.target.checked)}
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </SettingSection>

        <SettingSection title="Danger Zone">
          <Alert severity="warning" sx={{ mb: 2 }}>
            These actions are irreversible. Please proceed with caution.
          </Alert>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />}>
            Delete Account
          </Button>
        </SettingSection>

        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            onClick={() => handleSaveSettings('data')}
            disabled={loading}
          >
            Save Data Settings
          </Button>
        </Box>
      </TabPanel>

      {/* Dialogs */}
      <ChangePasswordDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        onSave={handleChangePassword}
      />

      <TwoFactorDialog
        open={twoFactorDialogOpen}
        onClose={() => setTwoFactorDialogOpen(false)}
        enabled={settings.twoFactorEnabled}
        onToggle={handleToggle2FA}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SettingsPage;
