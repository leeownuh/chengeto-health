/**
 * CHENGETO Health - Alert Detail Page
 * Comprehensive view of a single alert with actions and history
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
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert as MuiAlert,
  Tooltip,
} from '@mui/material';
import {
  Warning,
  CheckCircle,
  Schedule,
  Person,
  AccessTime,
  Navigation,
  Phone,
  Email,
  LocalHospital,
  Medication,
  Favorite,
  LocationOn,
  ArrowBack,
  Send,
  PriorityHigh,
  History,
  Notes,
  Block,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';
import { format, formatDistanceToNow } from 'date-fns';

const AlertDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { socket } = useSocket();
  const { api, user } = useAuth();
  const { isOnline, cacheData, getCachedData } = useOffline();

  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [actionDialog, setActionDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [escalateDialog, setEscalateDialog] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  useEffect(() => {
    fetchAlertData();

    // Listen for updates to this alert
    if (socket) {
      socket.on(`alert:update:${id}`, (updatedAlert) => {
        setAlert(updatedAlert);
      });
    }

    return () => {
      if (socket) {
        socket.off(`alert:update:${id}`);
      }
    };
  }, [id, socket]);

  const fetchAlertData = async () => {
    try {
      setLoading(true);
      const [alertRes, historyRes, notesRes] = await Promise.all([
        api.get(`/alerts/${id}`),
        api.get(`/alerts/${id}/history`),
        api.get(`/alerts/${id}/notes`),
      ]);

      const alertPayload = alertRes?.data?.data?.alert || alertRes?.data?.data || alertRes?.data || null;
      setAlert(alertPayload);
      if (alertPayload?._id) {
        await cacheData('alerts', alertPayload);
      }

      setHistory(historyRes?.data?.data?.history || historyRes?.data?.history || []);
      setNotes(notesRes?.data?.data?.notes || notesRes?.data?.notes || []);
    } catch (error) {
      console.error('Failed to fetch alert:', error);
      const cached = await getCachedData('alerts', id);
      if (cached) {
        setAlert(cached);
        enqueueSnackbar('Offline: showing cached alert', { variant: 'warning' });
      } else {
        enqueueSnackbar(isOnline ? 'Failed to load alert data' : 'Offline: alert not cached yet', { variant: 'error' });
        navigate('/alerts');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    try {
      let endpoint = '';
      let data = { notes: actionNotes };

      switch (actionType) {
        case 'acknowledge':
          endpoint = `/alerts/${id}/acknowledge`;
          break;
        case 'resolve':
          endpoint = `/alerts/${id}/resolve`;
          break;
        case 'false_alarm':
          endpoint = `/alerts/${id}/resolve`;
          data.falseAlarm = true;
          break;
        default:
          return;
      }

      if (!isOnline) {
        enqueueSnackbar('Offline: alert actions are unavailable', { variant: 'warning' });
        return;
      }

      await api.patch(endpoint, data);

      setAlert(prev => ({
        ...prev,
        status: actionType === 'resolve' || actionType === 'false_alarm' ? 'resolved' : 'acknowledged',
      }));

      enqueueSnackbar(`Alert ${actionType === 'resolve' ? 'resolved' : 'acknowledged'}`, {
        variant: 'success',
      });

      setActionDialog(false);
      setActionNotes('');
      fetchAlertData();
    } catch (error) {
      enqueueSnackbar(`Failed to ${actionType} alert`, { variant: 'error' });
    }
  };

  const handleEscalate = async () => {
    try {
      if (!isOnline) {
        enqueueSnackbar('Offline: alert escalation is unavailable', { variant: 'warning' });
        return;
      }

      await api.post(`/alerts/${id}/escalate`, {
        reason: escalateReason,
      });

      setAlert(prev => ({
        ...prev,
        status: 'escalated',
        escalationLevel: (prev.escalationLevel || 0) + 1,
      }));

      enqueueSnackbar('Alert escalated successfully', { variant: 'warning' });
      setEscalateDialog(false);
      setEscalateReason('');
      fetchAlertData();
    } catch (error) {
      enqueueSnackbar('Failed to escalate alert', { variant: 'error' });
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      if (!isOnline) {
        enqueueSnackbar('Offline: adding notes is unavailable', { variant: 'warning' });
        return;
      }

      const response = await api.post(`/alerts/${id}/notes`, {
        content: newNote,
      });

      setNotes(prev => [...prev, response.data]);
      setNewNote('');
      enqueueSnackbar('Note added', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to add note', { variant: 'error' });
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
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'error';
      case 'acknowledged':
        return 'warning';
      case 'escalated':
        return 'warning';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  if (!alert) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" color="text.secondary">
          Alert not found
        </Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/alerts')}>
          Back to Alerts
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate(-1)}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight={700}>
            Alert Details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ID: {alert._id}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {alert.status === 'active' && (
            <>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<Schedule />}
                onClick={() => {
                  setActionType('acknowledge');
                  setActionDialog(true);
                }}
              >
                Acknowledge
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<PriorityHigh />}
                onClick={() => setEscalateDialog(true)}
              >
                Escalate
              </Button>
            </>
          )}
          {alert.status !== 'resolved' && (
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircle />}
              onClick={() => {
                setActionType('resolve');
                setActionDialog(true);
              }}
            >
              Resolve
            </Button>
          )}
        </Box>
      </Box>

      {/* Alert Banner */}
      {alert.status === 'active' && alert.severity === 'critical' && (
        <MuiAlert severity="error" sx={{ mb: 3 }}>
          This is a critical alert that requires immediate attention!
        </MuiAlert>
      )}

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid item xs={12} lg={8}>
          {/* Alert Overview */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="h5" fontWeight={600} gutterBottom>
                    {alert.message || alert.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      icon={<Warning />}
                      label={alert.severity}
                      color={getSeverityColor(alert.severity)}
                    />
                    <Chip
                      label={alert.status}
                      color={getStatusColor(alert.status)}
                    />
                    <Chip
                      label={alert.type.replace('_', ' ')}
                      variant="outlined"
                    />
                  </Box>
                </Box>
                {alert.escalationLevel > 0 && (
                  <Chip
                    label={`Escalation Level ${alert.escalationLevel}`}
                    color="warning"
                    variant="outlined"
                  />
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body1">
                    {alert.timestamp ? format(new Date(alert.timestamp), 'PPpp') : '--'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {alert.timestamp ? formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true }) : ''}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Duration
                  </Typography>
                  <Typography variant="body1">
                    {alert.timestamp
                      ? formatDistanceToNow(new Date(alert.timestamp))
                      : '--'}
                  </Typography>
                </Grid>
                {alert.acknowledgedAt && (
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Acknowledged
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(alert.acknowledgedAt), 'PPpp')}
                    </Typography>
                  </Grid>
                )}
                {alert.resolvedAt && (
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Resolved
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(alert.resolvedAt), 'PPpp')}
                    </Typography>
                  </Grid>
                )}
              </Grid>

              {alert.details && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Details
                  </Typography>
                  <Typography variant="body1">
                    {alert.details}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Patient Info */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Patient Information
              </Typography>
              {alert.patient ? (
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      p: 1,
                      borderRadius: 1,
                    }}
                    onClick={() => navigate(`/patients/${alert.patient._id}`)}
                  >
                    <Avatar sx={{ width: 56, height: 56 }}>
                      {alert.patient.firstName?.[0]}{alert.patient.lastName?.[0]}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6">
                        {alert.patient.firstName} {alert.patient.lastName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ID: {alert.patient.medicalId}
                      </Typography>
                    </Box>
                    <Button variant="outlined" size="small">
                      View Profile
                    </Button>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Phone
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Phone fontSize="small" />
                        <Typography variant="body2">
                          {alert.patient.phone || '--'}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Care Level
                      </Typography>
                      <Chip
                        size="small"
                        label={alert.patient.careLevel || 'Standard'}
                      />
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Assigned CHW
                      </Typography>
                      <Typography variant="body2">
                        {alert.patient.assignedCHW
                          ? `${alert.patient.assignedCHW.firstName} ${alert.patient.assignedCHW.lastName}`
                          : 'Unassigned'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Location
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<LocationOn />}
                        onClick={() => {
                          if (alert.patient.location?.coordinates) {
                            const [lng, lat] = alert.patient.location.coordinates;
                            window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
                          }
                        }}
                      >
                        View on Map
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No patient information available
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Alert Timeline
              </Typography>
              {history.length > 0 ? (
                <List disablePadding>
                  {history.map((event, index) => (
                    <React.Fragment key={`${event.timestamp || index}-${event.action}`}>
                      <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                        <ListItemAvatar>
                          <Avatar
                            sx={{
                              bgcolor:
                                event.action === 'created'
                                  ? 'error.main'
                                  : event.action === 'acknowledged'
                                    ? 'warning.main'
                                    : event.action === 'resolved'
                                      ? 'success.main'
                                      : 'primary.main',
                            }}
                          >
                            {event.action === 'created' ? (
                              <Warning />
                            ) : event.action === 'acknowledged' ? (
                              <Schedule />
                            ) : event.action === 'resolved' ? (
                              <CheckCircle />
                            ) : (
                              <History />
                            )}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight={500}>
                              {event.action
                                ? event.action.charAt(0).toUpperCase() + event.action.slice(1)
                                : 'Event'}
                            </Typography>
                          }
                          secondary={
                            <>
                              <Typography component="span" variant="caption" color="text.secondary">
                                {event.timestamp ? format(new Date(event.timestamp), 'PPpp') : '--'}
                              </Typography>
                              {event.user && (
                                <Typography component="span" variant="caption" display="block">
                                  by {event.user.firstName} {event.user.lastName}
                                </Typography>
                              )}
                              {event.notes && (
                                <Typography component="span" variant="body2" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                  {event.notes}
                                </Typography>
                              )}
                            </>
                          }
                        />
                      </ListItem>
                      {index < history.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No timeline events available yet.
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Notes
              </Typography>
              <List>
                {notes.map((note, index) => (
                  <React.Fragment key={index}>
                    <ListItem alignItems="flex-start">
                      <ListItemAvatar>
                        <Avatar>{note.user?.firstName?.[0]}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" fontWeight={500}>
                              {note.user?.firstName} {note.user?.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {note.timestamp ? format(new Date(note.timestamp), 'PPp') : ''}
                            </Typography>
                          </Box>
                        }
                        secondary={note.content}
                      />
                    </ListItem>
                    {index < notes.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
                {notes.length === 0 && (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                    No notes yet
                  </Typography>
                )}
              </List>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <IconButton
                  color="primary"
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                >
                  <Send />
                </IconButton>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Quick Actions */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Phone />}
                  fullWidth
                  href={`tel:${alert.patient?.phone}`}
                >
                  Call Patient
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Person />}
                  fullWidth
                  onClick={() => navigate(`/patients/${alert.patient?._id}`)}
                >
                  View Patient Profile
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Favorite />}
                  fullWidth
                  onClick={() => navigate(`/patients/${alert.patient?._id}/vitals`)}
                >
                  View Vitals
                </Button>
                {alert.status !== 'resolved' && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Block />}
                    fullWidth
                    onClick={() => {
                      setActionType('false_alarm');
                      setActionDialog(true);
                    }}
                  >
                    Mark as False Alarm
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Blockchain Record */}
          {alert.blockchainRecord && (
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Blockchain Record
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Transaction Hash
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    bgcolor: 'grey.100',
                    p: 1,
                    borderRadius: 1,
                  }}
                >
                  {alert.blockchainRecord.transactionHash}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Block: {alert.blockchainRecord.blockNumber}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Recorded: {alert.blockchainRecord.timestamp
                    ? format(new Date(alert.blockchainRecord.timestamp), 'PPpp')
                    : '--'}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Action Dialog */}
      <Dialog open={actionDialog} onClose={() => setActionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionType === 'acknowledge' && 'Acknowledge Alert'}
          {actionType === 'resolve' && 'Resolve Alert'}
          {actionType === 'false_alarm' && 'Mark as False Alarm'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notes (optional)"
            value={actionNotes}
            onChange={(e) => setActionNotes(e.target.value)}
            placeholder="Add any relevant notes..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={actionType === 'resolve' ? 'success' : 'primary'}
            onClick={handleAction}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Escalate Dialog */}
      <Dialog open={escalateDialog} onClose={() => setEscalateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Escalate Alert</DialogTitle>
        <DialogContent>
          <MuiAlert severity="warning" sx={{ mb: 2 }}>
            Escalating will notify the next level of care providers.
          </MuiAlert>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Reason for Escalation"
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
            placeholder="Explain why this alert needs to be escalated..."
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEscalateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleEscalate}
            disabled={!escalateReason.trim()}
          >
            Escalate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AlertDetailPage;
