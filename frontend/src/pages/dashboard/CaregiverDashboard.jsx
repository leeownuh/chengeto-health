/**
 * CHENGETO Health - Caregiver Dashboard
 * Workflow-first dashboard for assigned patients, check-ins, alerts, and handoffs
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
  Favorite as HeartIcon,
  Medication as MedicationIcon,
  NotificationsActive as NotificationsActiveIcon,
  People as PeopleIcon,
  Route as RouteIcon,
  Schedule as ScheduleIcon,
  SensorsOff as SensorsOffIcon,
  SpeakerNotes as SpeakerNotesIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../contexts/AuthContext';

const CaregiverDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [workflowData, setWorkflowData] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const dashboardResponse = await api.get('/dashboard/caregiver');

      setDashboardData(dashboardResponse.data.data);
      setWorkflowData(dashboardResponse.data.data.workflow || null);
    } catch (error) {
      console.error('Failed to fetch caregiver workflow data:', error);
      enqueueSnackbar('Failed to load caregiver workflow', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'taken':
        return 'success';
      case 'missed':
      case 'overdue':
        return 'error';
      case 'due_now':
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'default';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'default';
    }
  };

  const getPatientRouteId = (patient) => patient?._id || patient?.id;

  const workflowQueue = useMemo(() => {
    const overdue = workflowData?.overdue || [];
    const dueNow = workflowData?.dueNow || [];
    const upcoming = workflowData?.upcoming || [];
    return [...overdue, ...dueNow, ...upcoming];
  }, [workflowData]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  const {
    assignedPatients = [],
    rankedPatients = [],
    medicationTasks = [],
    activeAlerts = [],
    latestVitals = [],
    transitionTasks = [],
    summary = {},
    completedToday = 0
  } = dashboardData || {};
  const workflowSummary = workflowData?.summary || {};

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Good {currentTime.getHours() < 12 ? 'Morning' : currentTime.getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.firstName}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    My Patients
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {summary?.totalPatients || assignedPatients.length}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.light' }}>
                  <PeopleIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Due Now
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: (workflowSummary?.dueNow || 0) > 0 ? 'warning.main' : 'text.primary' }}>
                    {workflowSummary?.dueNow || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.light' }}>
                  <ScheduleIcon />
                </Avatar>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                {completedToday} completed today
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Overdue Visits
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: (workflowSummary?.overdue || 0) > 0 ? 'error.main' : 'text.primary' }}>
                    {workflowSummary?.overdue || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: (workflowSummary?.overdue || 0) > 0 ? 'error.light' : 'grey.300' }}>
                  <ErrorOutlineIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Pending Handoffs
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: (workflowSummary?.handoffNotes || 0) > 0 ? 'info.main' : 'text.primary' }}>
                    {workflowSummary?.handoffNotes || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'info.light' }}>
                  <SpeakerNotesIcon />
                </Avatar>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                {workflowSummary?.staleDevices || 0} device follow-ups
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Today&apos;s Workflow Queue
                </Typography>
                <Chip
                  size="small"
                  color={(workflowSummary?.overdue || 0) > 0 ? 'error' : 'default'}
                  label={`${workflowQueue.length} tasks`}
                />
              </Box>
              <Divider sx={{ mb: 2 }} />

              <List>
                {workflowQueue.slice(0, 8).map((task) => (
                  <ListItem
                    key={task._id}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      alignItems: 'flex-start',
                      bgcolor: task.workflowStatus === 'overdue' ? 'error.lighter' : 'action.hover',
                    }}
                    secondaryAction={
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => navigate(`/checkin?patient=${getPatientRouteId(task.patient)}`)}
                      >
                        Check In
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: task.workflowStatus === 'overdue' ? 'error.light' : 'primary.light' }}>
                        <RouteIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {task.patient?.name || 'Unknown patient'}
                          </Typography>
                          <Chip label={task.workflowStatus.replace('_', ' ')} size="small" color={getStatusColor(task.workflowStatus)} />
                          <Chip label={task.priority} size="small" variant="outlined" color={getPriorityColor(task.priority)} />
                        </Box>
                      }
                      secondary={[
                        `${task.windowName || 'Check-in'} ${task.startTime || '--'} - ${task.endTime || '--'}`,
                        task.activeAlertsCount ? `${task.activeAlertsCount} active alerts` : null,
                        task.patient?.riskLevel ? `Risk: ${task.patient.riskLevel}` : null
                      ].filter(Boolean).join(' | ')}
                    />
                  </ListItem>
                ))}

                {workflowQueue.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No check-ins are queued right now
                    </Typography>
                  </Box>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Pending Handoffs
                </Typography>
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/patients')}>
                  Review Patients
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />

              <List>
                {(workflowData?.handoffNotes || []).slice(0, 5).map((handoff, index) => (
                  <ListItem
                    key={`${handoff.checkInId}-${index}`}
                    sx={{ borderRadius: 2, mb: 1, bgcolor: 'action.hover', alignItems: 'flex-start' }}
                    secondaryAction={
                      handoff.patient?._id ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(`/patients/${handoff.patient._id}`)}
                        >
                          Open
                        </Button>
                      ) : null
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'info.light' }}>
                        <SpeakerNotesIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {handoff.patient?.name || 'Patient handoff'}
                          </Typography>
                          <Chip size="small" label={handoff.priority} color={getPriorityColor(handoff.priority)} />
                        </Box>
                      }
                      secondary={[
                        `${handoff.from} to ${handoff.targetRole}`,
                        handoff.note,
                        handoff.createdAt ? new Date(handoff.createdAt).toLocaleString() : null
                      ].filter(Boolean).join(' | ')}
                    />
                  </ListItem>
                ))}

                {(!workflowData?.handoffNotes || workflowData.handoffNotes.length === 0) && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No pending handoffs for caregivers right now
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Highest Risk Patients
                </Typography>
                <Chip
                  size="small"
                  color={(summary?.highRiskPatients || 0) > 0 ? 'error' : 'default'}
                  label={`${summary?.highRiskPatients || 0} high priority`}
                />
              </Box>
              <Divider sx={{ mb: 2 }} />

              <List>
                {rankedPatients.slice(0, 5).map((patient) => (
                  <ListItem
                    key={patient._id}
                    sx={{ borderRadius: 2, mb: 1, bgcolor: 'action.hover' }}
                    secondaryAction={
                      <Button size="small" variant="outlined" onClick={() => navigate(`/patients/${patient._id}`)}>
                        Review
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: patient.riskLevel === 'critical' ? 'error.light' : patient.riskLevel === 'high' ? 'warning.light' : 'primary.light' }}>
                        <WarningIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {patient.name}
                          </Typography>
                          <Chip size="small" color={getPriorityColor(patient.riskLevel === 'critical' ? 'urgent' : patient.riskLevel === 'high' ? 'high' : 'medium')} label={`${patient.riskLevel} ${patient.riskScore || 0}`} />
                          {patient.hasActiveTransition ? <Chip size="small" variant="outlined" label="Transition" /> : null}
                        </Box>
                      }
                      secondary={patient.riskSummary || 'No additional risk explanation yet.'}
                    />
                  </ListItem>
                ))}

                {rankedPatients.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No ranked patients are available yet
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Post-Discharge Follow-up
                </Typography>
                <Chip
                  size="small"
                  color={(summary?.transitionTasks || 0) > 0 ? 'warning' : 'default'}
                  label={`${summary?.activeTransitions || 0} active transitions`}
                />
              </Box>
              <Divider sx={{ mb: 2 }} />

              <List>
                {transitionTasks.slice(0, 5).map((task, index) => (
                  <ListItem
                    key={`${task.transitionId}-${task.title}-${index}`}
                    sx={{ borderRadius: 2, mb: 1, bgcolor: task.status === 'overdue' ? 'error.lighter' : 'action.hover' }}
                    secondaryAction={
                      <Button size="small" variant="outlined" onClick={() => navigate(`/patients/${task.patient?._id}`)}>
                        Open
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: task.status === 'overdue' ? 'error.light' : 'warning.light' }}>
                        <ScheduleIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {task.patient?.name}
                          </Typography>
                          <Chip size="small" label={task.status} color={getStatusColor(task.status)} />
                        </Box>
                      }
                      secondary={[
                        task.title,
                        task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : null,
                        task.transitionType ? task.transitionType.replace(/_/g, ' ') : null
                      ].filter(Boolean).join(' | ')}
                    />
                  </ListItem>
                ))}

                {transitionTasks.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No post-discharge follow-up tasks are open right now
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Medication Follow-up
                </Typography>
                <Chip
                  size="small"
                  color={(summary?.missedMedicationsToday || 0) > 0 ? 'warning' : 'default'}
                  label={`${summary?.medicationsDueToday || medicationTasks.length} due today`}
                />
              </Box>
              <Divider sx={{ mb: 2 }} />

              <List>
                {medicationTasks.slice(0, 5).map((task, index) => (
                  <ListItem
                    key={`${task.patient?._id || task.patient?.id}-${task.name}-${task.scheduledTime || index}`}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      bgcolor: task.status === 'missed' ? 'warning.light' : 'action.hover',
                    }}
                    secondaryAction={
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => navigate(`/checkin?patient=${getPatientRouteId(task.patient)}`)}
                      >
                        Review
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: task.refillConcern ? 'warning.light' : 'primary.light' }}>
                        <MedicationIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${task.patient?.name || 'Patient'} - ${task.name}`}
                      secondary={[
                        task.dosage || null,
                        task.scheduledTime ? `Due ${task.scheduledTime}` : null,
                        task.refillConcern ? 'Refill follow-up needed' : null,
                      ].filter(Boolean).join(' | ')}
                    />
                    <Chip label={task.status} size="small" color={getStatusColor(task.status)} sx={{ mr: 2 }} />
                  </ListItem>
                ))}

                {medicationTasks.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No medication follow-up tasks due right now
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Active Alerts
                </Typography>
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/alerts')}>
                  View All
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />

              <List>
                {activeAlerts.slice(0, 5).map((alert) => (
                  <ListItem
                    key={alert._id}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      bgcolor: alert.severity === 'critical' ? 'error.lighter' : 'action.hover',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/alerts/${alert._id}`)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: alert.severity === 'critical' ? 'error.main' : 'warning.main' }}>
                        <NotificationsActiveIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {alert.type?.replace('_', ' ').toUpperCase()}
                          </Typography>
                          <Chip label={alert.severity} size="small" color={getSeverityColor(alert.severity)} />
                        </Box>
                      }
                      secondary={`${alert.patient?.firstName} ${alert.patient?.lastName} | ${new Date(alert.createdAt).toLocaleTimeString()}`}
                    />
                  </ListItem>
                ))}

                {activeAlerts.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No active alerts
                    </Typography>
                  </Box>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Device Follow-up
                </Typography>
                <Chip size="small" color={(workflowSummary?.staleDevices || 0) > 0 ? 'warning' : 'default'} label={`${workflowSummary?.staleDevices || 0} stale`} />
              </Box>
              <Divider sx={{ mb: 2 }} />

              <List>
                {(workflowData?.staleDevices || []).slice(0, 5).map((device) => (
                  <ListItem
                    key={device._id}
                    sx={{ borderRadius: 2, mb: 1, bgcolor: 'action.hover' }}
                    secondaryAction={
                      device.patient?._id ? (
                        <Button size="small" variant="outlined" onClick={() => navigate(`/patients/${device.patient._id}`)}>
                          Open
                        </Button>
                      ) : null
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'warning.light' }}>
                        <SensorsOffIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${device.deviceId} ${device.patient?.name ? `- ${device.patient.name}` : ''}`}
                      secondary={[
                        device.status ? `Status: ${device.status}` : null,
                        device.lastSeen ? `Last seen ${new Date(device.lastSeen).toLocaleString()}` : 'No recent heartbeat',
                        Number.isFinite(device.batteryLevel) ? `Battery ${device.batteryLevel}%` : null
                      ].filter(Boolean).join(' | ')}
                    />
                  </ListItem>
                ))}

                {(!workflowData?.staleDevices || workflowData.staleDevices.length === 0) && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No device follow-up needed right now
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Latest Vitals Overview
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                {latestVitals.map((patientVitals) => (
                  <Grid item xs={12} sm={6} key={patientVitals.patientId}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, cursor: 'pointer' }}
                      onClick={() => navigate(`/patients/${patientVitals.patientId}/vitals`)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Avatar>
                          {patientVitals.patientName?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {patientVitals.patientName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Tap to open vitals
                          </Typography>
                        </Box>
                      </Box>

                      {patientVitals.vitals ? (
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <HeartIcon fontSize="small" color="error" />
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Heart Rate
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {patientVitals.vitals.heartRate || '--'} bpm
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <WarningIcon fontSize="small" color="primary" />
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  SpO2
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {patientVitals.vitals.oxygenSaturation || '--'}%
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No recent vitals data
                        </Typography>
                      )}

                      {patientVitals.lastUpdated && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          Last updated: {new Date(patientVitals.lastUpdated).toLocaleString()}
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                ))}

                {latestVitals.length === 0 && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                      No recent vitals are available for assigned patients
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CaregiverDashboard;
