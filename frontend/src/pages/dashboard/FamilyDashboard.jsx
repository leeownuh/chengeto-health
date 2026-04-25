/**
 * CHENGETO Health - Family Member Dashboard
 * Monitor loved ones and stay connected
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Button,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Badge,
} from '@mui/material';
import {
  Favorite,
  Phone,
  Videocam,
  Message,
  LocationOn,
  Schedule,
  CheckCircle,
  Warning,
  Person,
  Notifications,
  Settings,
  Add,
  Visibility,
  Send,
  HealthAndSafety,
  Accessibility,
  Restaurant,
  Medication,
  Event,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useSnackbar } from 'notistack';
import { api } from '../../contexts/AuthContext';

// Family Member Card
const FamilyMemberCard = ({ patient, onContact, onViewDetails }) => {
  const getStatusColor = () => {
    if (!patient.lastCheckIn) return 'warning';
    const hoursSinceCheckIn = (Date.now() - new Date(patient.lastCheckIn).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCheckIn > 24) return 'error';
    return 'success';
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: `${getStatusColor()}.main`,
                    border: '2px solid white',
                  }}
                />
              }
            >
              <Avatar
                sx={{ width: 64, height: 64, bgcolor: 'primary.light' }}
              >
                {patient.firstName?.[0]}{patient.lastName?.[0]}
              </Avatar>
            </Badge>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {patient.firstName} {patient.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {patient.relationship || 'Family Member'}
              </Typography>
            </Box>
          </Box>
          <Chip
            size="small"
            label={patient.active ? 'Active' : 'Inactive'}
            color={getStatusColor()}
          />
        </Box>

        {/* Quick Stats */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Favorite sx={{ color: 'error.main', mb: 0.5 }} />
              <Typography variant="body2" fontWeight={600}>
                {patient.vitals?.heartRate || '--'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                BPM
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center' }}>
              <HealthAndSafety sx={{ color: 'success.main', mb: 0.5 }} />
              <Typography variant="body2" fontWeight={600}>
                {patient.wellnessScore || '--'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Wellness
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircle sx={{ color: 'info.main', mb: 0.5 }} />
              <Typography variant="body2" fontWeight={600}>
                {patient.checkInStreak || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Day Streak
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Last Check-in */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Schedule fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            Last check-in: {patient.lastCheckIn
              ? new Date(patient.lastCheckIn).toLocaleString()
              : 'No check-ins yet'}
          </Typography>
        </Box>

        {/* Alerts */}
        {patient.activeAlerts > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {patient.activeAlerts} active alert(s) require attention
          </Alert>
        )}

        {(patient.medicationSummary?.dueToday > 0 || patient.medicationSummary?.refillRisks > 0) && (
          <Alert
            severity={patient.medicationSummary?.refillRisks > 0 ? 'warning' : 'info'}
            sx={{ mb: 2 }}
          >
            {[
              patient.medicationSummary?.dueToday > 0
                ? `${patient.medicationSummary.dueToday} medication task(s) due today`
                : null,
              patient.medicationSummary?.refillRisks > 0
                ? `${patient.medicationSummary.refillRisks} refill risk(s)`
                : null,
            ].filter(Boolean).join(' | ')}
          </Alert>
        )}

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<Visibility />}
            onClick={() => onViewDetails(patient)}
            sx={{ flex: 1 }}
          >
            View Details
          </Button>
          <IconButton size="small" color="primary" onClick={() => onContact(patient, 'call')}>
            <Phone />
          </IconButton>
          <IconButton size="small" color="primary" onClick={() => onContact(patient, 'video')}>
            <Videocam />
          </IconButton>
          <IconButton size="small" color="primary" onClick={() => onContact(patient, 'message')}>
            <Message />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

// Activity Timeline
const ActivityTimeline = ({ activities }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Recent Activity
      </Typography>
      <List dense>
        {activities?.map((activity, index) => (
          <React.Fragment key={index}>
            <ListItem alignItems="flex-start">
              <ListItemAvatar>
                <Avatar sx={{
                  bgcolor: activity.type === 'checkin' ? 'success.light' :
                    activity.type === 'alert' ? 'error.light' :
                    activity.type === 'vitals' ? 'info.light' : 'primary.light',
                  width: 32,
                  height: 32
                }}>
                  {activity.type === 'checkin' ? <CheckCircle fontSize="small" /> :
                   activity.type === 'alert' ? <Warning fontSize="small" /> :
                   activity.type === 'vitals' ? <Favorite fontSize="small" /> :
                   <Person fontSize="small" />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={activity.description}
                secondary={new Date(activity.timestamp).toLocaleString()}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
            {index < activities.length - 1 && <Divider variant="inset" component="li" />}
          </React.Fragment>
        ))}
        {(!activities || activities.length === 0) && (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
            No recent activity
          </Typography>
        )}
      </List>
    </CardContent>
  </Card>
);

// Care Team Card
const CareTeamCard = ({ caregivers, onCallCaregiver }) => (
  <Card>
    <CardContent>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Care Team
      </Typography>
      <List dense>
        {caregivers?.map((caregiver, index) => (
          <React.Fragment key={index}>
            <ListItem>
              <ListItemAvatar>
                <Avatar sx={{ width: 36, height: 36 }}>
                  {caregiver.firstName?.[0]}{caregiver.lastName?.[0]}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={`${caregiver.firstName} ${caregiver.lastName}`}
                secondary={caregiver.role || 'Caregiver'}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
              <ListItemSecondaryAction>
                <IconButton size="small" onClick={() => onCallCaregiver(caregiver)}>
                  <Phone fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
            {index < caregivers.length - 1 && <Divider />}
          </React.Fragment>
        ))}
        {(!caregivers || caregivers.length === 0) && (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
            No caregivers assigned
          </Typography>
        )}
      </List>
    </CardContent>
  </Card>
);

const FamilyDashboard = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { socket } = useSocket();

  const [loading, setLoading] = useState(true);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [detailDialog, setDetailDialog] = useState(false);
  const [messageDialog, setMessageDialog] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchDashboardData();

    if (socket) {
      socket.on('patient:update', (data) => {
        setFamilyMembers(prev =>
          prev.map(p => p._id === data.patientId ? { ...p, ...data.updates } : p)
        );
      });
      socket.on('activity:new', (activity) => {
        setActivities(prev => [activity, ...prev.slice(0, 19)]);
      });
    }

    return () => {
      if (socket) {
        socket.off('patient:update');
        socket.off('activity:new');
      }
    };
  }, [socket]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [membersRes, activitiesRes] = await Promise.all([
        api.get('/dashboard/family/members'),
        api.get('/dashboard/family/activities?limit=10'),
      ]);

      setFamilyMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
      setActivities(Array.isArray(activitiesRes.data) ? activitiesRes.data : []);
    } catch (error) {
      console.error('Failed to fetch family dashboard data:', error);
      enqueueSnackbar('Failed to load dashboard data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleContact = (patient, method) => {
    if (method === 'call') {
      window.location.href = `tel:${patient.phone}`;
    } else if (method === 'message') {
      setSelectedPatient(patient);
      setMessageDialog(true);
    } else if (method === 'video') {
      enqueueSnackbar('Video call feature coming soon', { variant: 'info' });
    }
  };

  const handleViewDetails = (patient) => {
    setSelectedPatient(patient);
    setDetailDialog(true);
  };

  const handleCallCaregiver = (caregiver) => {
    if (caregiver?.phone) {
      window.location.href = `tel:${caregiver.phone}`;
      return;
    }

    enqueueSnackbar('Phone number not available for this care team member.', { variant: 'info' });
  };

  const handleRequestAccess = () => {
    navigate('/profile');
    enqueueSnackbar('Open your profile to request or confirm family access details.', {
      variant: 'info'
    });
  };

  const handleSendMessage = async () => {
    try {
      await api.post('/dashboard/family/message', {
        patientId: selectedPatient._id,
        message
      });
      enqueueSnackbar('Message sent successfully', { variant: 'success' });
      setMessageDialog(false);
      setMessage('');
    } catch (error) {
      enqueueSnackbar('Failed to send message', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          Family Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Stay connected with your loved ones
        </Typography>
      </Box>

      {/* No Family Members */}
      {familyMembers.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Person sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Family Members Added
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              You haven't been granted access to any family members yet.
              Contact your care provider to get connected.
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={handleRequestAccess}>
              Request Access
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {/* Family Members Grid */}
          <Grid item xs={12} lg={8}>
            <Grid container spacing={3}>
              {familyMembers.map((patient) => (
                <Grid item xs={12} md={6} key={patient._id}>
                  <FamilyMemberCard
                    patient={patient}
                    onContact={handleContact}
                    onViewDetails={handleViewDetails}
                  />
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} lg={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <ActivityTimeline activities={activities} />
              <CareTeamCard caregivers={familyMembers[0]?.caregivers} onCallCaregiver={handleCallCaregiver} />
            </Box>
          </Grid>
        </Grid>
      )}

      {/* Patient Detail Dialog */}
      <Dialog
        open={detailDialog}
        onClose={() => setDetailDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 48, height: 48 }}>
              {selectedPatient?.firstName?.[0]}{selectedPatient?.lastName?.[0]}
            </Avatar>
            <Box>
              <Typography variant="h6">
                {selectedPatient?.firstName} {selectedPatient?.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedPatient?.relationship || 'Family Member'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedPatient && (
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Recent Vitals
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><Favorite color="error" /></ListItemIcon>
                      <ListItemText
                        primary="Heart Rate"
                        secondary={`${selectedPatient.vitals?.heartRate || '--'} BPM`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><HealthAndSafety color="success" /></ListItemIcon>
                      <ListItemText
                        primary="Blood Pressure"
                        secondary={selectedPatient.vitals?.bloodPressure || '--/--'}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Accessibility color="info" /></ListItemIcon>
                      <ListItemText
                        primary="Activity Level"
                        secondary={selectedPatient.vitals?.activityLevel || 'Unknown'}
                      />
                    </ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Care Schedule
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><Schedule /></ListItemIcon>
                      <ListItemText
                        primary="Next Check-in"
                        secondary={selectedPatient.nextCheckIn || 'Not scheduled'}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Medication /></ListItemIcon>
                      <ListItemText
                        primary="Medications"
                        secondary={[
                          `${selectedPatient.medicationCount || 0} active`,
                          selectedPatient.medicationSummary?.dueToday
                            ? `${selectedPatient.medicationSummary.dueToday} due today`
                            : null,
                          selectedPatient.medicationSummary?.refillRisks
                            ? `${selectedPatient.medicationSummary.refillRisks} refill risks`
                            : null,
                        ].filter(Boolean).join(' | ')}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Event /></ListItemIcon>
                      <ListItemText
                        primary="Next Appointment"
                        secondary={selectedPatient.nextAppointment || 'None scheduled'}
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(false)}>Close</Button>
          <Button variant="outlined" startIcon={<Message />} onClick={() => {
            setDetailDialog(false);
            setMessageDialog(true);
          }}>
            Send Message
          </Button>
        </DialogActions>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={messageDialog} onClose={() => setMessageDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Message to {selectedPatient?.firstName}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Your Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMessageDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<Send />}
            onClick={handleSendMessage}
            disabled={!message.trim()}
          >
            Send Message
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FamilyDashboard;
