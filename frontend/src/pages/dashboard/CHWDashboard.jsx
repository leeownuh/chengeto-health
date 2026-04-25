/**
 * CHENGETO Health - Community Health Worker Dashboard
 * Workflow-first field dashboard with visit completion and handoff support
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fab,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AccessTime,
  Add,
  Assignment,
  CheckCircle,
  DirectionsWalk,
  HealthAndSafety,
  Home,
  LocationOn,
  Map,
  Navigation,
  Person,
  Phone,
  SensorsOff,
  SpeakerNotes,
  Today,
  Warning,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useSnackbar } from 'notistack';
import { api } from '../../contexts/AuthContext';

const priorityColors = {
  urgent: 'error',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

const statusColors = {
  pending: 'default',
  'in-progress': 'primary',
  completed: 'success',
};

const mapWorkflowTasksToVisits = (workflow = {}) => {
  const queue = [
    ...(workflow.overdue || []),
    ...(workflow.dueNow || []),
    ...(workflow.upcoming || []),
    ...(workflow.completedToday || [])
  ];

  return queue.map((task) => ({
    ...task,
    status: task.workflowStatus === 'completed' ? 'completed' : 'pending'
  }));
};

const VisitCard = ({ visit, onStatusChange, onNavigate, onCallPatient }) => {
  const currentStatus = visit.status || 'pending';

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: visit.workflowStatus === 'overdue' ? 'error.light' : 'primary.light' }}>
              <Person />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {visit.patient?.name || `${visit.patient?.firstName || ''} ${visit.patient?.lastName || ''}`.trim()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {visit.patient?.patientId || 'No medical ID'}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Chip
              size="small"
              label={visit.priority}
              color={priorityColors[visit.priority] || 'default'}
              variant="outlined"
            />
            <Chip
              size="small"
              label={visit.workflowStatus.replace('_', ' ')}
              color={visit.workflowStatus === 'overdue' ? 'error' : visit.workflowStatus === 'due_now' ? 'warning' : visit.workflowStatus === 'completed' ? 'success' : 'default'}
            />
            <Chip
              size="small"
              label={currentStatus}
              color={statusColors[currentStatus] || 'default'}
            />
          </Box>
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Home fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary" noWrap>
                {visit.patient?.address?.area || 'Unknown area'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTime fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {visit.startTime || 'Any time'}{visit.endTime ? ` - ${visit.endTime}` : ''}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {currentStatus === 'pending' && visit.workflowStatus !== 'completed' && (
            <Button
              size="small"
              variant="contained"
              onClick={() => onStatusChange(visit._id, 'in-progress')}
              startIcon={<DirectionsWalk />}
            >
              Start Visit
            </Button>
          )}
          {currentStatus === 'in-progress' && (
            <Button
              size="small"
              variant="contained"
              color="success"
              onClick={() => onStatusChange(visit._id, 'completed')}
              startIcon={<CheckCircle />}
            >
              Complete
            </Button>
          )}
          {currentStatus === 'pending' && visit.workflowStatus !== 'completed' && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onStatusChange(visit._id, 'completed')}
            >
              Complete Now
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            onClick={() => onNavigate(visit.patient?.location)}
            startIcon={<Navigation />}
          >
            Navigate
          </Button>
          <IconButton size="small" onClick={() => onCallPatient(visit.patient)}>
            <Phone />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

const StatsCard = ({ title, value, subtitle, icon: Icon, color }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: `${color}.light`, color: `${color}.dark` }}>
          <Icon />
        </Avatar>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const CHWDashboard = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { enqueueSnackbar } = useSnackbar();
  const { socket } = useSocket();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [stats, setStats] = useState(null);
  const [workflowData, setWorkflowData] = useState(null);
  const [todayVisits, setTodayVisits] = useState([]);
  const [location, setLocation] = useState(null);
  const [checkInDialog, setCheckInDialog] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [checkInForm, setCheckInForm] = useState({
    notes: '',
    wellnessScore: 5,
    handoffTargetRole: 'caregiver',
    handoffPriority: 'medium',
    handoffNote: '',
  });

  useEffect(() => {
    fetchDashboardData();
    requestLocation();

    if (socket) {
      socket.on('visit:update', fetchDashboardData);
      socket.on('alert:new', fetchDashboardData);
    }

    return () => {
      if (socket) {
        socket.off('visit:update', fetchDashboardData);
        socket.off('alert:new', fetchDashboardData);
      }
    };
  }, [socket]);

  const workflowQueue = useMemo(
    () => (todayVisits || []).filter((visit) => visit.workflowStatus !== 'completed'),
    [todayVisits]
  );

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const dashboardRes = await api.get('/dashboard/chw');
      const dashboardData = dashboardRes.data.data || {};

      setDashboardData(dashboardData);
      setStats({
        ...(dashboardData.summary || {}),
        urgentPatients: dashboardData.urgentPatients || [],
        totalPatients: dashboardData.totalPatients || dashboardData.summary?.totalPatients || 0,
        activeAlerts: dashboardData.activeAlerts || 0,
        criticalAlerts: dashboardData.criticalAlerts || 0,
      });
      setWorkflowData(dashboardData.workflow || null);
      setTodayVisits(Array.isArray(dashboardData.visits) ? dashboardData.visits : mapWorkflowTasksToVisits(dashboardData.workflow));
    } catch (error) {
      console.error('Failed to fetch CHW dashboard data:', error);
      enqueueSnackbar('Failed to load dashboard data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Location error:', error);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleStatusChange = async (visitId, newStatus) => {
    if (newStatus === 'completed') {
      const visit = todayVisits.find((entry) => entry._id === visitId);
      setSelectedVisit(visit);
      setCheckInDialog(true);
      return;
    }

    setTodayVisits((prev) =>
      prev.map((visit) => visit._id === visitId ? { ...visit, status: newStatus } : visit)
    );
    enqueueSnackbar('Visit moved into progress', { variant: 'success' });
  };

  const handleNavigate = (patientLocation) => {
    const coordinates = patientLocation?.coordinates;

    if (Array.isArray(coordinates) && location) {
      const url = `https://www.google.com/maps/dir/${location.lat},${location.lng}/${coordinates[1]},${coordinates[0]}`;
      window.open(url, '_blank');
      return;
    }

    enqueueSnackbar('Location not available', { variant: 'warning' });
  };

  const handleCallPatient = (patient) => {
    if (patient?.phone) {
      window.location.href = `tel:${patient.phone}`;
      return;
    }

    enqueueSnackbar('Phone number not available for this patient.', { variant: 'info' });
  };

  const handleMapView = () => {
    const visitWithLocation = workflowQueue.find((visit) => visit?.patient?.location?.coordinates);

    if (visitWithLocation) {
      handleNavigate(visitWithLocation.patient.location);
      return;
    }

    enqueueSnackbar('No mapped visit is available right now.', { variant: 'info' });
  };

  const resetCheckInForm = () => {
    setCheckInForm({
      notes: '',
      wellnessScore: 5,
      handoffTargetRole: 'caregiver',
      handoffPriority: 'medium',
      handoffNote: '',
    });
  };

  const handleCheckInSubmit = async () => {
    try {
      const handoff = checkInForm.handoffNote.trim()
        ? {
            note: checkInForm.handoffNote.trim(),
            targetRole: checkInForm.handoffTargetRole,
            priority: checkInForm.handoffPriority,
          }
        : undefined;

      if (selectedVisit?.scheduleId) {
        await api.post(`/schedules/${selectedVisit.scheduleId}/complete`, {
          notes: checkInForm.notes,
          concerns: checkInForm.notes ? [checkInForm.notes] : [],
          wellnessScore: checkInForm.wellnessScore,
          handoff,
        });
      } else {
        await api.post('/checkins/manual', {
          patientId: selectedVisit?.patient?._id,
          method: 'manual_override',
          location: location
            ? {
                latitude: location.lat,
                longitude: location.lng
              }
            : undefined,
          wellnessScore: checkInForm.wellnessScore,
          notes: checkInForm.notes,
          observations: checkInForm.notes ? [checkInForm.notes] : [],
          handoff,
        });
      }

      setCheckInDialog(false);
      setSelectedVisit(null);
      resetCheckInForm();
      await fetchDashboardData();
      enqueueSnackbar(
        handoff ? 'Visit completed and handoff created' : 'Visit completed successfully',
        { variant: 'success' }
      );
    } catch (error) {
      enqueueSnackbar('Failed to complete visit', { variant: 'error' });
    }
  };

  const handleRecordVitals = () => {
    const patientId = selectedVisit?.patient?._id || workflowQueue[0]?.patient?._id;

    if (patientId) {
      navigate(`/patients/${patientId}/vitals`);
      return;
    }

    navigate('/patients');
    enqueueSnackbar('Select a patient to review or record vitals.', { variant: 'info' });
  };

  const handleNewCheckIn = () => {
    const visit = workflowQueue[0];

    if (visit) {
      setSelectedVisit(visit);
      setCheckInDialog(true);
      return;
    }

    navigate('/checkin');
    enqueueSnackbar('No visit is queued, so the full check-in page was opened instead.', {
      variant: 'info'
    });
  };

  const handleViewAllPatients = () => {
    navigate('/patients');
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  const workflowSummary = workflowData?.summary || {};
  const totalVisitCount =
    (workflowSummary.completedToday || 0) +
    (workflowSummary.dueNow || 0) +
    (workflowSummary.overdue || 0) +
    (workflowSummary.upcoming || 0);
  const {
    rankedPatients = [],
    transitionTasks = [],
  } = dashboardData || {};
  const highRiskCount = rankedPatients.filter((patient) => ['high', 'critical'].includes(patient.riskLevel)).length;
  const activeTransitionCount = new Set(
    transitionTasks
      .map((task) => task.transitionId)
      .filter(Boolean)
  ).size;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          CHW Workflow
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Field visits, overdue check-ins, handoffs, and device follow-up
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} md={3}>
          <StatsCard
            title="Due Now"
            value={workflowSummary?.dueNow || 0}
            icon={Today}
            color="warning"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatsCard
            title="Overdue"
            value={workflowSummary?.overdue || 0}
            icon={Warning}
            color="error"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatsCard
            title="Completed"
            value={workflowSummary?.completedToday || 0}
            icon={CheckCircle}
            color="success"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatsCard
            title="Assigned Patients"
            value={stats?.totalPatients || 0}
            subtitle={`${workflowSummary?.handoffNotes || 0} pending handoffs`}
            icon={Person}
            color="info"
          />
        </Grid>
      </Grid>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body1" fontWeight={600}>
              Today&apos;s Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {workflowSummary?.completedToday || 0} / {totalVisitCount || 0} visits
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={totalVisitCount > 0 ? ((workflowSummary?.completedToday || 0) / totalVisitCount) * 100 : 0}
            sx={{ height: 10, borderRadius: 5 }}
          />
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Workflow Queue
                </Typography>
                <Button size="small" startIcon={<Map />} onClick={handleMapView}>
                  Map View
                </Button>
              </Box>

              {workflowQueue.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Assignment sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">
                    No visits scheduled right now
                  </Typography>
                </Box>
              ) : (
                workflowQueue.map((visit) => (
                  <VisitCard
                    key={visit._id}
                    visit={visit}
                    onStatusChange={handleStatusChange}
                    onNavigate={handleNavigate}
                    onCallPatient={handleCallPatient}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Location Status
              </Typography>
              {location ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationOn color="success" />
                  <Typography variant="body2" color="success.main">
                    GPS Active
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" color="warning.main" gutterBottom>
                    Location not available
                  </Typography>
                  <Button size="small" onClick={requestLocation}>
                    Enable Location
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Urgent Patients
              </Typography>
              <List dense>
                {stats?.urgentPatients?.map((patient) => (
                  <ListItem key={patient._id}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'error.light' }}>
                        <Warning />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${patient.firstName} ${patient.lastName}`}
                      secondary={patient.alertReason}
                    />
                    <IconButton size="small" onClick={() => handleCallPatient(patient)}>
                      <Phone fontSize="small" />
                    </IconButton>
                  </ListItem>
                ))}
                {(!stats?.urgentPatients || stats.urgentPatients.length === 0) && (
                  <Typography variant="body2" color="text.secondary" align="center">
                    No urgent cases
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Highest Risk Patients
                </Typography>
                <Chip
                  size="small"
                  color={highRiskCount > 0 ? 'error' : 'default'}
                  label={`${highRiskCount} priority`}
                />
              </Box>
              <List dense>
                {rankedPatients.slice(0, 4).map((patient) => (
                  <ListItem
                    key={patient._id}
                    sx={{ px: 0 }}
                    secondaryAction={
                      <Button size="small" variant="outlined" onClick={() => navigate(`/patients/${patient._id}`)}>
                        Review
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: patient.riskLevel === 'critical' ? 'error.light' : patient.riskLevel === 'high' ? 'warning.light' : 'primary.light' }}>
                        <Warning />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient'}
                      secondary={
                        [
                          `${(patient.riskLevel || 'low').toUpperCase()} risk`,
                          Number.isFinite(patient.riskScore) ? `score ${patient.riskScore}` : null,
                          patient.riskSummary || null,
                        ].filter(Boolean).join(' | ')
                      }
                    />
                  </ListItem>
                ))}
                {rankedPatients.length === 0 && (
                  <Typography variant="body2" color="text.secondary" align="center">
                    Risk ranking will appear as patient signals come in
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Post-Discharge Follow-up
                </Typography>
                <Chip
                  size="small"
                  color={activeTransitionCount > 0 ? 'warning' : 'default'}
                  label={`${activeTransitionCount} active`}
                />
              </Box>
              <List dense>
                {transitionTasks.slice(0, 4).map((task, index) => (
                  <ListItem
                    key={`${task.transitionId || 'transition'}-${task.taskId || index}`}
                    sx={{ px: 0 }}
                    secondaryAction={
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/patients/${task.patient?._id}`)}
                      >
                        Open
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: task.status === 'overdue' ? 'error.light' : 'warning.light' }}>
                        <Assignment />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={task.patient?.name || 'Transition follow-up'}
                      secondary={
                        [
                          task.title || 'Follow-up task',
                          task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : null,
                          task.status || null,
                        ].filter(Boolean).join(' | ')
                      }
                    />
                  </ListItem>
                ))}
                {transitionTasks.length === 0 && (
                  <Typography variant="body2" color="text.secondary" align="center">
                    No active transition follow-up tasks
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Pending Handoffs
              </Typography>
              <List dense>
                {(workflowData?.handoffNotes || []).slice(0, 4).map((handoff, index) => (
                  <ListItem key={`${handoff.checkInId}-${index}`} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'info.light' }}>
                        <SpeakerNotes />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={handoff.patient?.name || 'Patient handoff'}
                      secondary={`${handoff.note} | ${handoff.fromRole} -> ${handoff.targetRole}`}
                    />
                  </ListItem>
                ))}
                {(!workflowData?.handoffNotes || workflowData.handoffNotes.length === 0) && (
                  <Typography variant="body2" color="text.secondary" align="center">
                    No pending handoffs
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Device Follow-up
              </Typography>
              <List dense>
                {(workflowData?.staleDevices || []).slice(0, 4).map((device) => (
                  <ListItem key={device._id} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'warning.light' }}>
                        <SensorsOff />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={device.patient?.name || device.deviceId}
                      secondary={device.lastSeen ? `Last seen ${new Date(device.lastSeen).toLocaleString()}` : 'No recent heartbeat'}
                    />
                  </ListItem>
                ))}
                {(!workflowData?.staleDevices || workflowData.staleDevices.length === 0) && (
                  <Typography variant="body2" color="text.secondary" align="center">
                    No stale devices
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button variant="outlined" startIcon={<HealthAndSafety />} fullWidth onClick={handleRecordVitals}>
                  Record Vitals
                </Button>
                <Button variant="outlined" startIcon={<Add />} fullWidth onClick={handleNewCheckIn}>
                  Complete Next Visit
                </Button>
                <Button variant="outlined" startIcon={<Assignment />} fullWidth onClick={handleViewAllPatients}>
                  View All Patients
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {isMobile && (
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
          }}
          onClick={handleNewCheckIn}
        >
          <Add />
        </Fab>
      )}

      <Dialog open={checkInDialog} onClose={() => setCheckInDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Complete Visit</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Patient: {selectedVisit?.patient?.name}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Wellness Score (1-10)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                <Button
                  key={score}
                  variant={checkInForm.wellnessScore === score ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setCheckInForm((prev) => ({ ...prev, wellnessScore: score }))}
                  sx={{ minWidth: 36, p: 0.5 }}
                >
                  {score}
                </Button>
              ))}
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes & Observations"
              value={checkInForm.notes}
              onChange={(e) => setCheckInForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Record any observations about the patient's condition..."
              sx={{ mb: 2 }}
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Optional Handoff
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Target Role"
                  value={checkInForm.handoffTargetRole}
                  onChange={(e) => setCheckInForm((prev) => ({ ...prev, handoffTargetRole: e.target.value }))}
                >
                  <MenuItem value="caregiver">Caregiver</MenuItem>
                  <MenuItem value="clinician">Clinician</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="family">Family</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Priority"
                  value={checkInForm.handoffPriority}
                  onChange={(e) => setCheckInForm((prev) => ({ ...prev, handoffPriority: e.target.value }))}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Handoff Note"
                  value={checkInForm.handoffNote}
                  onChange={(e) => setCheckInForm((prev) => ({ ...prev, handoffNote: e.target.value }))}
                  placeholder="Add a note if this visit needs follow-up from another role..."
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCheckInDialog(false);
              setSelectedVisit(null);
              resetCheckInForm();
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCheckInSubmit}>
            Submit Visit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CHWDashboard;
