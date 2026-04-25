import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Avatar,
  IconButton,
  Chip,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Person as PersonIcon,
  Edit as EditIcon,
  PhotoCamera as CameraIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Work as WorkIcon,
  CalendarToday as CalendarIcon,
  Security as SecurityIcon,
  History as HistoryIcon,
  Badge as BadgeIcon,
  School as SchoolIcon,
  EmojiEvents as AwardIcon,
  Star as StarIcon,
  CheckCircle as VerifiedIcon,
  AccessTime as TimeIcon,
  Bluetooth as BluetoothIcon,
  GpsFixed as GpsIcon,
  Nfc as NfcIcon,
  Assignment as TaskIcon,
  TrendingUp as TrendingUpIcon,
  LocalHospital as HospitalIcon,
  Notifications as NotificationIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useAuth, api } from '../../contexts/AuthContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

// Tab panel component
const TabPanel = ({ value, index, children }) => (
  <Box hidden={value !== index} sx={{ pt: 3 }}>
    {value === index && children}
  </Box>
);

// Stat card component
const StatCard = ({ title, value, icon, color = 'primary' }) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold" color={`${color}.main`}>
            {value}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: `${color}.light`, color: `${color}.main` }}>
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

// Activity item component
const ActivityItem = ({ activity }) => {
  const getIcon = () => {
    switch (activity.type) {
      case 'checkin':
        return <VerifiedIcon color="success" />;
      case 'alert':
        return <NotificationIcon color="error" />;
      case 'patient':
        return <PersonIcon color="primary" />;
      case 'schedule':
        return <TaskIcon color="warning" />;
      default:
        return <HistoryIcon color="action" />;
    }
  };

  return (
    <ListItem>
      <ListItemIcon>{getIcon()}</ListItemIcon>
      <ListItemText
        primary={activity.description}
        secondary={new Date(activity.timestamp).toLocaleString()}
      />
    </ListItem>
  );
};

// Edit profile dialog
const EditProfileDialog = ({ open, onClose, profile, onSave }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Zimbabwe',
    bio: '',
    specialization: '',
    qualification: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        phone: profile.phone || '+263',
        address: profile.address?.street || '',
        city: profile.address?.city || '',
        country: profile.address?.country || 'Zimbabwe',
        bio: profile.bio || '',
        specialization: profile.specialization || '',
        qualification: profile.qualification || '',
      });
    }
  }, [profile, open]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSave?.(formData);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="First Name"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="City"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Country"
              value={formData.country}
              onChange={(e) => handleChange('country', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Bio"
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              placeholder="Tell us about yourself..."
            />
          </Grid>
          {(profile?.role === 'chw' || profile?.role === 'clinician') && (
            <>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Specialization"
                  value={formData.specialization}
                  onChange={(e) => handleChange('specialization', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Qualification"
                  value={formData.qualification}
                  onChange={(e) => handleChange('qualification', e.target.value)}
                />
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ProfilePage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();

  const [tabValue, setTabValue] = useState(0);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Stats and activity data
  const [stats, setStats] = useState({
    totalCheckIns: 0,
    patientsHelped: 0,
    alertsResolved: 0,
    hoursActive: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);

  useEffect(() => {
    fetchProfile();
    fetchStats();
    fetchActivity();
    generatePerformanceData();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/auth/me');
      setProfile(response.data?.data || response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(user || null);
      setSnackbar({ open: true, message: 'Failed to load profile', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/auth/stats');
      setStats(response.data?.data || response.data || {});
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats({
        totalCheckIns: 0,
        patientsHelped: 0,
        alertsResolved: 0,
        hoursActive: 0
      });
    }
  };

  const fetchActivity = async () => {
    try {
      const response = await api.get('/auth/activity?limit=20');
      setRecentActivity(response.data?.data?.activities || []);
    } catch (error) {
      console.error('Error fetching activity:', error);
      setRecentActivity([]);
    }
  };

  const generatePerformanceData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        checkIns: Math.floor(Math.random() * 10) + 5,
        hours: Math.floor(Math.random() * 4) + 4,
      });
    }
    setPerformanceData(data);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSaveProfile = async (formData) => {
    try {
      const response = await api.put('/auth/me', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        address: {
          street: formData.address,
          city: formData.city,
          country: formData.country,
        },
        bio: formData.bio,
        specialization: formData.specialization,
        qualification: formData.qualification,
      });

      setProfile(response.data?.data || response.data);
      showSnackbar('Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      showSnackbar(error.response?.data?.message || 'Failed to update profile', 'error');
    }
  };

  const getRoleLabel = (role) => {
    const roles = {
      admin: 'Administrator',
      chw: 'Community Health Worker',
      caregiver: 'Caregiver',
      patient: 'Patient',
      family: 'Family Member',
      clinician: 'Clinician',
      auditor: 'Auditor',
    };
    return roles[role] || role;
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'error',
      chw: 'success',
      caregiver: 'primary',
      patient: 'info',
      family: 'secondary',
      clinician: 'warning',
      auditor: 'default',
    };
    return colors[role] || 'default';
  };

  if (loading && !profile) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header Banner */}
      <Card
        sx={{
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
        }}
      >
        <CardContent sx={{ py: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={profile?.avatar}
                  sx={{
                    width: 120,
                    height: 120,
                    border: '4px solid white',
                    bgcolor: 'rgba(255,255,255,0.2)',
                  }}
                >
                  {profile?.firstName?.charAt(0) || 'U'}
                </Avatar>
                <IconButton
                  size="small"
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    bgcolor: 'white',
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'grey.100' },
                  }}
                >
                  <CameraIcon fontSize="small" />
                </IconButton>
              </Box>
            </Grid>
            <Grid item xs>
              <Typography variant="h4" fontWeight="bold">
                {profile?.firstName} {profile?.lastName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Chip
                  label={getRoleLabel(profile?.role)}
                  color={getRoleColor(profile?.role)}
                  size="small"
                  sx={{ color: 'white', borderColor: 'white' }}
                  variant="outlined"
                />
                {(profile?.emailVerified || profile?.verified) && (
                  <Chip
                    icon={<VerifiedIcon />}
                    label="Verified"
                    color="success"
                    size="small"
                    sx={{ color: 'white', borderColor: 'white' }}
                    variant="outlined"
                  />
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EmailIcon fontSize="small" />
                  <Typography variant="body2">{profile?.email}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PhoneIcon fontSize="small" />
                  <Typography variant="body2">{profile?.phone}</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => setEditDialogOpen(true)}
                sx={{
                  bgcolor: 'white',
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'grey.100' },
                }}
              >
                Edit Profile
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <StatCard
            title="Total Check-ins"
            value={stats.totalCheckIns}
            icon={<TaskIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            title="Patients Helped"
            value={stats.patientsHelped}
            icon={<PersonIcon />}
            color="success"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            title="Alerts Resolved"
            value={stats.alertsResolved}
            icon={<NotificationIcon />}
            color="warning"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            title="Hours Active"
            value={stats.hoursActive}
            icon={<TimeIcon />}
            color="info"
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons="auto"
        >
          <Tab icon={<PersonIcon />} label="Overview" />
          <Tab icon={<HistoryIcon />} label="Activity" />
          <Tab icon={<TrendingUpIcon />} label="Performance" />
          <Tab icon={<BadgeIcon />} label="Credentials" />
        </Tabs>
      </Paper>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Personal Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <List dense>
                  <ListItem>
                    <ListItemIcon><PersonIcon /></ListItemIcon>
                    <ListItemText
                      primary="Full Name"
                      secondary={`${profile?.firstName} ${profile?.lastName}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><EmailIcon /></ListItemIcon>
                    <ListItemText primary="Email" secondary={profile?.email} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><PhoneIcon /></ListItemIcon>
                    <ListItemText primary="Phone" secondary={profile?.phone} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><LocationIcon /></ListItemIcon>
                    <ListItemText
                      primary="Location"
                      secondary={`${profile?.address?.city || 'N/A'}, ${profile?.address?.country || 'N/A'}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><WorkIcon /></ListItemIcon>
                    <ListItemText primary="Role" secondary={getRoleLabel(profile?.role)} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><CalendarIcon /></ListItemIcon>
                    <ListItemText
                      primary="Member Since"
                      secondary={profile?.joinedAt ? new Date(profile.joinedAt).toLocaleDateString() : 'N/A'}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Bio
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  {profile?.bio || 'No bio provided yet. Click "Edit Profile" to add one.'}
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Verification Methods
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip icon={<BluetoothIcon />} label="BLE Enabled" color="primary" variant="outlined" />
                  <Chip icon={<NfcIcon />} label="NFC Enabled" color="secondary" variant="outlined" />
                  <Chip icon={<GpsIcon />} label="GPS Enabled" color="success" variant="outlined" />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Activity
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <List>
                  {recentActivity.slice(0, 5).map((activity) => (
                    <ActivityItem key={activity._id} activity={activity} />
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Activity Tab */}
      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Activity History
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Activity</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentActivity.map((activity) => (
                    <TableRow key={activity._id} hover>
                      <TableCell>{activity.description}</TableCell>
                      <TableCell>
                        <Chip
                          label={activity.type}
                          size="small"
                          color={
                            activity.type === 'checkin' ? 'success' :
                            activity.type === 'alert' ? 'error' :
                            activity.type === 'patient' ? 'primary' : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(activity.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip label="Completed" color="success" size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Performance Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Weekly Check-ins
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip />
                    <Area
                      type="monotone"
                      dataKey="checkIns"
                      stroke={theme.palette.primary.main}
                      fill={theme.palette.primary.light}
                      name="Check-ins"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Working Hours
                </Typography>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip />
                    <Line
                      type="monotone"
                      dataKey="hours"
                      stroke={theme.palette.success.main}
                      name="Hours"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Performance Summary
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon><StarIcon color="primary" /></ListItemIcon>
                    <ListItemText
                      primary="Average Check-ins per Day"
                      secondary="8.2 check-ins"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><TrendingUpIcon color="success" /></ListItemIcon>
                    <ListItemText
                      primary="Response Time"
                      secondary="Average 12 minutes"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><TaskIcon color="warning" /></ListItemIcon>
                    <ListItemText
                      primary="Task Completion Rate"
                      secondary="94%"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><AwardIcon color="error" /></ListItemIcon>
                    <ListItemText
                      primary="Patient Satisfaction"
                      secondary="4.8 / 5.0"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Credentials Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Professional Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <List>
                  <ListItem>
                    <ListItemIcon><SchoolIcon /></ListItemIcon>
                    <ListItemText
                      primary="Qualification"
                      secondary={profile?.qualification || 'Not specified'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><HospitalIcon /></ListItemIcon>
                    <ListItemText
                      primary="Specialization"
                      secondary={profile?.specialization || 'Not specified'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><WorkIcon /></ListItemIcon>
                    <ListItemText
                      primary="Role"
                      secondary={getRoleLabel(profile?.role)}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Certifications & Badges
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip
                    icon={<AwardIcon />}
                    label="Certified CHW"
                    color="primary"
                  />
                  <Chip
                    icon={<VerifiedIcon />}
                    label="Verified Professional"
                    color="success"
                  />
                  <Chip
                    icon={<StarIcon />}
                    label="Top Performer"
                    color="warning"
                  />
                  <Chip
                    icon={<SchoolIcon />}
                    label="Training Complete"
                    color="info"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Security & Access
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <List>
                  <ListItem>
                    <ListItemIcon><SecurityIcon /></ListItemIcon>
                    <ListItemText
                      primary="Two-Factor Authentication"
                      secondary="Enabled"
                    />
                    <Chip label="Active" color="success" size="small" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><TimeIcon /></ListItemIcon>
                    <ListItemText
                      primary="Last Login"
                      secondary={profile?.lastActive ? new Date(profile.lastActive).toLocaleString() : 'N/A'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><SettingsIcon /></ListItemIcon>
                    <ListItemText
                      primary="Access Level"
                      secondary={getRoleLabel(profile?.role)}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Edit Profile Dialog */}
      <EditProfileDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        profile={profile}
        onSave={handleSaveProfile}
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

export default ProfilePage;
