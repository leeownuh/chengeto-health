/**
 * CHENGETO Health - Patient Detail Page
 * Comprehensive patient view with vitals, history, and care management
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
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Tooltip,
  Skeleton,
} from '@mui/material';
import {
  Person,
  Edit,
  Delete,
  Phone,
  Email,
  LocationOn,
  Schedule,
  Favorite,
  Opacity,
  Thermostat,
  Air,
  Accessibility,
  Medication,
  Warning,
  CheckCircle,
  History,
  Assignment,
  Devices,
  Share,
  Print,
  Add,
  Refresh,
  HealthAndSafety,
  LocalHospital,
  FamilyRestroom,
  Notifications,
  CalendarToday,
  MonitorWeight,
  Bloodtype,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';
import { getElderlyNcdMonitoringSummary } from '../../constants/elderlyNcdProfiles';
import {
  buildFunctionalSummary,
  formatFunctionalValue,
  getFunctionalConcernLabels,
} from '../../utils/functionalStatus';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Info Card Component
const InfoCard = ({ title, children, action }) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </CardContent>
  </Card>
);

// Vitals Display Component
const VitalDisplay = ({ label, value, unit, status, icon: Icon, trend }) => {
  const statusColors = {
    normal: 'success',
    warning: 'warning',
    critical: 'error',
  };

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Avatar sx={{ bgcolor: `${statusColors[status] || 'info'}.light` }}>
        <Icon />
      </Avatar>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h6" fontWeight={600}>
          {value} <Typography component="span" variant="body2">{unit}</Typography>
        </Typography>
      </Box>
      <Chip size="small" label={status} color={statusColors[status]} />
    </Box>
  );
};

const getResponsePayload = (response) => response?.data?.data || response?.data || {};

const PatientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { socket } = useSocket();
  const { api } = useAuth();
  const { isOnline, cacheData, getCachedData } = useOffline();

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [vitalHistory, setVitalHistory] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [medications, setMedications] = useState([]);
  const [medicationSummary, setMedicationSummary] = useState({});
  const [devices, setDevices] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [transitions, setTransitions] = useState([]);

  const [tabValue, setTabValue] = useState(0);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [addDeviceDialog, setAddDeviceDialog] = useState(false);
  const monitoringSummary = getElderlyNcdMonitoringSummary(patient?.ncdConditions || []);
  const carePlan = patient?.carePlan || {};
  const riskStratification = patient?.riskStratification || {};
  const functionalSummary = buildFunctionalSummary(patient, checkIns);

  useEffect(() => {
    fetchPatientData();

    if (socket) {
      socket.emit('patient:subscribe', id);

      socket.on('telemetry:update', (data) => {
        const patientId = String(data?.patientId || '');
        if (!patientId || patientId !== String(id)) return;

        const nextVitals = {
          heartRate: data?.vitals?.heartRate ?? null,
          oxygenSaturation: data?.vitals?.oxygenSaturation ?? null,
          temperature: data?.vitals?.temperature ?? null,
          timestamp: data?.timestamp || new Date().toISOString()
        };

        setPatient((prev) => ({ ...(prev || {}), vitals: nextVitals }));
        setVitalHistory((prev) => [...prev.slice(-99), nextVitals]);
      });

      socket.on('alert:new', (alert) => {
        const alertPatientId =
          alert?.patientId ||
          alert?.patient?.id ||
          alert?.patient?._id ||
          alert?.patient ||
          alert?.patient?.patientId;

        if (String(alertPatientId || '') !== String(id)) return;

        setAlerts((prev) => [alert, ...prev]);
        enqueueSnackbar(`New alert: ${alert.type || 'alert'}`, { variant: 'warning' });
      });
    }

    return () => {
      if (socket) {
        socket.emit('patient:unsubscribe', id);
        socket.off('telemetry:update');
        socket.off('alert:new');
      }
    };
  }, [id, socket]);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const [
        patientRes,
        vitalsRes,
        checkinsRes,
        alertsRes,
        medicationsRes,
        devicesRes,
        familyRes,
        transitionsRes,
      ] = await Promise.all([
        api.get(`/patients/${id}`),
        api.get(`/patients/${id}/vitals/history`, { params: { days: 7 } }),
        api.get(`/patients/${id}/checkins`, { params: { limit: 10 } }),
        api.get(`/patients/${id}/alerts`, { params: { limit: 10 } }),
        api.get(`/patients/${id}/medications`),
        api.get(`/patients/${id}/devices`),
        api.get(`/patients/${id}/family`),
        api.get(`/transitions/patient/${id}`),
      ]);

      const patientPayload = getResponsePayload(patientRes);
      const vitalsPayload = getResponsePayload(vitalsRes);
      const checkinsPayload = getResponsePayload(checkinsRes);
      const alertsPayload = getResponsePayload(alertsRes);
      const medicationsPayload = getResponsePayload(medicationsRes);
      const devicesPayload = getResponsePayload(devicesRes);
      const familyPayload = getResponsePayload(familyRes);
      const transitionsPayload = getResponsePayload(transitionsRes);

      setPatient(patientPayload);
      await cacheData('patients', patientPayload);
      setVitalHistory(vitalsPayload.history || vitalsRes.data?.history || []);
      setCheckIns(checkinsPayload.checkins || checkinsRes.data?.checkins || []);
      setAlerts(alertsPayload.alerts || alertsRes.data?.alerts || []);
      setMedications(medicationsPayload.medications || medicationsRes.data?.medications || []);
      setMedicationSummary(medicationsPayload.summary || {});
      setDevices(devicesPayload.devices || devicesRes.data?.devices || []);
      setFamilyMembers(familyPayload.family || familyRes.data?.family || []);
      setTransitions(transitionsPayload.transitions || transitionsRes.data?.transitions || []);
    } catch (error) {
      console.error('Failed to fetch patient data:', error);
      const cachedPatient = await getCachedData('patients', id);
      if (cachedPatient) {
        setPatient(cachedPatient);
        enqueueSnackbar('Offline: showing cached patient profile', { variant: 'warning' });
      } else {
        enqueueSnackbar(isOnline ? 'Failed to load patient data' : 'Offline: patient not cached yet', { variant: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (!isOnline) {
        enqueueSnackbar('Offline: patient deletion is unavailable', { variant: 'warning' });
        return;
      }

      await api.delete(`/patients/${id}`);
      enqueueSnackbar('Patient deleted successfully', { variant: 'success' });
      navigate('/patients');
    } catch (error) {
      enqueueSnackbar('Failed to delete patient', { variant: 'error' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: `${patient.firstName} ${patient.lastName} - Patient Record`,
        text: `Patient ID: ${patient.medicalId}`,
        url: window.location.href,
      });
    } catch (error) {
      enqueueSnackbar('Sharing not supported on this device', { variant: 'info' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Skeleton variant="rectangular" height={200} sx={{ mt: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ mt: 2, borderRadius: 2 }} />
      </Box>
    );
  }

  if (!patient) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" color="text.secondary">
          Patient not found
        </Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/patients')}>
          Back to Patients
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            sx={{
              width: 72,
              height: 72,
              bgcolor: 'primary.light',
              fontSize: '1.75rem',
            }}
          >
            {patient.firstName?.[0]}{patient.lastName?.[0]}
          </Avatar>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              {patient.firstName} {patient.lastName}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Chip
                size="small"
                label={patient.status || 'Active'}
                color={patient.status === 'active' ? 'success' : 'default'}
              />
              <Chip
                size="small"
                label={patient.careLevel || 'Standard'}
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                ID: {patient.medicalId}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchPatientData}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Print">
            <IconButton onClick={handlePrint}>
              <Print />
            </IconButton>
          </Tooltip>
          <Tooltip title="Share">
            <IconButton onClick={handleShare}>
              <Share />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<Edit />}
            onClick={() => navigate(`/patients/${id}/edit`)}
          >
            Edit
          </Button>
        </Box>
      </Box>

      {/* Active Alerts */}
      {patient.activeAlerts > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          This patient has {patient.activeAlerts} active alert(s) that require attention.
          <Button size="small" sx={{ ml: 2 }} onClick={() => setTabValue(4)}>
            View Alerts
          </Button>
        </Alert>
      )}

      {(riskStratification.level || transitions.length > 0) && (
        <Alert
          severity={riskStratification.level === 'critical' ? 'error' : riskStratification.level === 'high' ? 'warning' : 'info'}
          sx={{ mb: 3 }}
        >
          {riskStratification.summary || 'Risk stratification is available for this patient.'}
          {transitions.length > 0 ? ` ${transitions.length} care transition workflow(s) are active.` : ''}
          <Button size="small" sx={{ ml: 2 }} onClick={() => setTabValue(6)}>
            View Transitions
          </Button>
        </Alert>
      )}

      {/* Quick Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Age</Typography>
              <Typography variant="h5" fontWeight={600}>
                {patient.dateOfBirth
                  ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} yrs`
                  : '--'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Gender</Typography>
              <Typography variant="h5" fontWeight={600}>
                {patient.gender || '--'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Blood Type</Typography>
              <Typography variant="h5" fontWeight={600}>
                {patient.bloodType || '--'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Check-in Streak</Typography>
              <Typography variant="h5" fontWeight={600}>
                {patient.checkInStreak || 0} days
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Risk Score</Typography>
              <Typography variant="h5" fontWeight={600}>
                {riskStratification.score ?? '--'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Active Transitions</Typography>
              <Typography variant="h5" fontWeight={600}>
                {transitions.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Overview" icon={<Person />} iconPosition="start" />
          <Tab label="Care Plan" icon={<Assignment />} iconPosition="start" />
          <Tab label="Vitals" icon={<Favorite />} iconPosition="start" />
          <Tab label="Check-ins" icon={<CheckCircle />} iconPosition="start" />
          <Tab label="Alerts" icon={<Warning />} iconPosition="start" />
          <Tab label="Medications" icon={<Medication />} iconPosition="start" />
          <Tab label="Transitions" icon={<Schedule />} iconPosition="start" />
          <Tab label="Devices" icon={<Devices />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <InfoCard title="Risk Stratification">
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip
                  size="small"
                  color={riskStratification.level === 'critical' ? 'error' : riskStratification.level === 'high' ? 'warning' : riskStratification.level === 'moderate' ? 'info' : 'success'}
                  label={`${riskStratification.level || 'low'} risk`}
                />
                <Chip size="small" variant="outlined" label={`Score ${riskStratification.score ?? 0}`} />
                <Chip size="small" variant="outlined" label={`${transitions.length} active transitions`} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {riskStratification.summary || 'No major risk drivers are currently recorded.'}
              </Typography>
              <List dense>
                {(riskStratification.reasons || []).slice(0, 4).map((reason, index) => (
                  <React.Fragment key={`${reason.title}-${index}`}>
                    <ListItem>
                      <ListItemIcon><Warning /></ListItemIcon>
                      <ListItemText
                        primary={reason.title}
                        secondary={[reason.detail, `${reason.points} pts`, reason.category].filter(Boolean).join(' | ')}
                      />
                    </ListItem>
                    {index < Math.min((riskStratification.reasons || []).length, 4) - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
                {(!riskStratification.reasons || riskStratification.reasons.length === 0) && (
                  <Typography variant="body2" color="text.secondary">
                    Stable today with no major risk signals detected.
                  </Typography>
                )}
              </List>
            </InfoCard>
          </Grid>

          {/* Contact Info */}
          <Grid item xs={12} md={6}>
            <InfoCard title="Contact Information">
              <List dense>
                <ListItem>
                  <ListItemIcon><Phone /></ListItemIcon>
                  <ListItemText primary={patient.phone || 'Not provided'} secondary="Phone" />
                  <ListItemSecondaryAction>
                    <IconButton size="small" href={`tel:${patient.phone}`}>
                      <Phone fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><Email /></ListItemIcon>
                  <ListItemText primary={patient.email || 'Not provided'} secondary="Email" />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><LocationOn /></ListItemIcon>
                  <ListItemText
                    primary={patient.address?.formatted || 'Not provided'}
                    secondary="Address"
                  />
                </ListItem>
              </List>
            </InfoCard>
          </Grid>

          {/* Medical Info */}
          <Grid item xs={12} md={6}>
            <InfoCard title="Medical Information">
              <List dense>
                <ListItem>
                  <ListItemIcon><LocalHospital /></ListItemIcon>
                  <ListItemText
                    primary={patient.primaryDiagnosis || 'Not specified'}
                    secondary="Primary Diagnosis"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><HealthAndSafety /></ListItemIcon>
                  <ListItemText
                    primary={patient.ncdConditionLabels?.join(', ') || 'No structured elderly NCD profile selected'}
                    secondary="Older Adult Chronic Conditions"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><HealthAndSafety /></ListItemIcon>
                  <ListItemText
                    primary={patient.allergies?.join(', ') || 'None known'}
                    secondary="Allergies"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><Devices /></ListItemIcon>
                  <ListItemText
                    primary={monitoringSummary.signalLabels?.join(', ') || 'General home monitoring only'}
                    secondary="Recommended Device Inputs"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><Accessibility /></ListItemIcon>
                  <ListItemText
                    primary={functionalSummary.currentMobility || patient.mobilityStatus || 'Independent'}
                    secondary="Mobility Status"
                  />
                </ListItem>
              </List>
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <InfoCard title="Functional Baseline">
              <List dense>
                <ListItem>
                  <ListItemIcon><Accessibility /></ListItemIcon>
                  <ListItemText
                    primary={formatFunctionalValue('mobility', patient.functionalBaseline?.mobility)}
                    secondary="Baseline Mobility"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><Accessibility /></ListItemIcon>
                  <ListItemText
                    primary={formatFunctionalValue('gait', patient.functionalBaseline?.gait)}
                    secondary="Gait"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><Accessibility /></ListItemIcon>
                  <ListItemText
                    primary={formatFunctionalValue('balance', patient.functionalBaseline?.balance)}
                    secondary="Balance"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><Accessibility /></ListItemIcon>
                  <ListItemText
                    primary={formatFunctionalValue('assistiveDevice', patient.functionalBaseline?.assistiveDevice)}
                    secondary="Assistive Device"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><HealthAndSafety /></ListItemIcon>
                  <ListItemText
                    primary={formatFunctionalValue('frailty', patient.functionalBaseline?.frailty)}
                    secondary="Frailty"
                  />
                </ListItem>
              </List>
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <InfoCard title="Fall and Decline Summary">
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip size="small" color={functionalSummary.riskLevel === 'high' ? 'error' : functionalSummary.riskLevel === 'moderate' ? 'warning' : 'success'} label={`Fall risk: ${functionalSummary.riskLevel}`} />
                <Chip size="small" color={functionalSummary.trend === 'worsening' ? 'warning' : 'default'} label={`Trend: ${functionalSummary.trend.replace(/_/g, ' ')}`} />
                <Chip size="small" label={`Falls 30d: ${functionalSummary.recentFalls30Days}`} />
                <Chip size="small" label={`Near falls 30d: ${functionalSummary.nearFalls30Days}`} />
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Current status: {[
                  functionalSummary.currentMobility,
                  functionalSummary.currentGait,
                  functionalSummary.currentBalance,
                  functionalSummary.currentAssistiveDevice !== 'None' ? functionalSummary.currentAssistiveDevice : null,
                ].filter(Boolean).join(' | ') || 'Not assessed'}
              </Typography>

              {functionalSummary.concernLabels.length > 0 ? (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {functionalSummary.concernLabels.map((label) => (
                    <Chip key={label} size="small" color="warning" label={label} />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent fall or decline concerns recorded.
                </Typography>
              )}
            </InfoCard>
          </Grid>

          {/* Care Team */}
          <Grid item xs={12} md={6}>
            <InfoCard
              title="Care Team"
              action={
                <Button size="small" startIcon={<Add />}>Add</Button>
              }
            >
              <List dense>
                {patient.careTeam?.map((member, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar>{member.firstName?.[0]}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`${member.firstName} ${member.lastName}`}
                        secondary={member.role}
                      />
                    </ListItem>
                    {index < patient.careTeam.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
                {(!patient.careTeam || patient.careTeam.length === 0) && (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                    No care team members assigned
                  </Typography>
                )}
              </List>
            </InfoCard>
          </Grid>

          {/* Family Members */}
          <Grid item xs={12} md={6}>
            <InfoCard
              title="Family Members"
              action={
                <Button size="small" startIcon={<Add />}>Invite</Button>
              }
            >
              <List dense>
                {familyMembers.map((member, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar>{member.firstName?.[0]}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`${member.firstName} ${member.lastName}`}
                        secondary={member.relationship}
                      />
                      <ListItemSecondaryAction>
                        <IconButton size="small">
                          <Phone fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < familyMembers.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
                {familyMembers.length === 0 && (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                    No family members connected
                  </Typography>
                )}
              </List>
            </InfoCard>
          </Grid>
        </Grid>
      )}

      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <InfoCard title="Care Goals">
              {carePlan.goals?.length ? (
                <List dense>
                  {carePlan.goals.map((goal, index) => (
                    <React.Fragment key={`${goal.title || 'goal'}-${index}`}>
                      <ListItem>
                        <ListItemIcon><Assignment /></ListItemIcon>
                        <ListItemText
                          primary={goal.title || 'Untitled goal'}
                          secondary={
                            [
                              goal.status ? `Status: ${goal.status}` : null,
                              goal.targetDate ? `Target: ${new Date(goal.targetDate).toLocaleDateString()}` : null,
                              goal.notes || null,
                            ].filter(Boolean).join(' | ')
                          }
                        />
                      </ListItem>
                      {index < carePlan.goals.length - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No structured care goals have been recorded yet.
                </Typography>
              )}
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <InfoCard title="Risk Profile">
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {carePlan.riskProfile?.summary || 'No risk summary recorded yet.'}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip size="small" color="warning" label={`Fall: ${carePlan.riskProfile?.fallRisk || 'moderate'}`} />
                <Chip size="small" color="warning" label={`Medication: ${carePlan.riskProfile?.medicationRisk || 'moderate'}`} />
                <Chip size="small" color="warning" label={`Cognitive: ${carePlan.riskProfile?.cognitiveRisk || 'moderate'}`} />
                <Chip size="small" color="warning" label={`Social: ${carePlan.riskProfile?.socialRisk || 'moderate'}`} />
              </Box>
              <Typography variant="subtitle2" gutterBottom>
                Caregiver Instructions
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {carePlan.riskProfile?.caregiverInstructions || 'No caregiver instructions recorded yet.'}
              </Typography>
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <InfoCard title="Visit Cadence">
              <List dense>
                <ListItem>
                  <ListItemIcon><Schedule /></ListItemIcon>
                  <ListItemText
                    primary={(carePlan.visitCadence?.frequency || patient.checkInFrequency || 'daily').replace('-', ' ')}
                    secondary="Check-in Frequency"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><CalendarToday /></ListItemIcon>
                  <ListItemText
                    primary={carePlan.visitCadence?.preferredWindow || 'morning'}
                    secondary="Preferred Visit Window"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><Assignment /></ListItemIcon>
                  <ListItemText
                    primary={carePlan.visitCadence?.notes || 'No cadence notes recorded'}
                    secondary="Cadence Notes"
                  />
                </ListItem>
              </List>
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <InfoCard title="Escalation and Consent">
              <List dense>
                <ListItem>
                  <ListItemIcon><Notifications /></ListItemIcon>
                  <ListItemText
                    primary={(carePlan.escalationPreferences?.primaryResponderRole || 'caregiver').toUpperCase()}
                    secondary="Primary Responder"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><Warning /></ListItemIcon>
                  <ListItemText
                    primary={`${carePlan.escalationPreferences?.maxResponseMinutes || 30} minutes`}
                    secondary="Response Target"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><FamilyRestroom /></ListItemIcon>
                  <ListItemText
                    primary={carePlan.consentSettings?.familyAccessLevel || 'limited'}
                    secondary="Family Access Level"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><CheckCircle /></ListItemIcon>
                  <ListItemText
                    primary={
                      [
                        carePlan.escalationPreferences?.notifyFamily ? 'Notify family' : 'Do not notify family',
                        carePlan.escalationPreferences?.notifyClinicianOnHighRisk
                          ? 'Notify clinician on high risk'
                          : 'No automatic clinician escalation',
                        carePlan.consentSettings?.emergencySharing
                          ? 'Emergency sharing enabled'
                          : 'Emergency sharing disabled',
                      ].join(' | ')
                    }
                    secondary="Escalation Rules"
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon><History /></ListItemIcon>
                  <ListItemText
                    primary={
                      carePlan.review?.nextReviewDate
                        ? new Date(carePlan.review.nextReviewDate).toLocaleDateString()
                        : 'Not scheduled'
                    }
                    secondary="Next Review Date"
                  />
                </ListItem>
              </List>
            </InfoCard>
          </Grid>
        </Grid>
      )}

      {tabValue === 2 && (
        <Box>
          {/* Current Vitals */}
          <Typography variant="h6" gutterBottom fontWeight={600}>
            Current Vitals
          </Typography>
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <VitalDisplay
                label="Heart Rate"
                value={patient.vitals?.heartRate || '--'}
                unit="bpm"
                status={patient.vitals?.heartRateStatus || 'normal'}
                icon={Favorite}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <VitalDisplay
                label="Blood Pressure"
                value={patient.vitals?.bloodPressure || '--/--'}
                unit="mmHg"
                status={patient.vitals?.bpStatus || 'normal'}
                icon={Opacity}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <VitalDisplay
                label="Temperature"
                value={patient.vitals?.temperature || '--'}
                unit="deg C"
                status={patient.vitals?.tempStatus || 'normal'}
                icon={Thermostat}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <VitalDisplay
                label="SpO2"
                value={patient.vitals?.spo2 || '--'}
                unit="%"
                status={patient.vitals?.spo2Status || 'normal'}
                icon={Air}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={4}>
              <VitalDisplay
                label="Respiratory Rate"
                value={patient.vitals?.respiratoryRate || '--'}
                unit="/min"
                status={patient.vitals?.respiratoryRateStatus || 'normal'}
                icon={Air}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <VitalDisplay
                label="Blood Glucose"
                value={patient.vitals?.bloodGlucose || '--'}
                unit="mg/dL"
                status={patient.vitals?.bloodGlucoseStatus || 'normal'}
                icon={Bloodtype}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <VitalDisplay
                label="Weight"
                value={patient.vitals?.weight || '--'}
                unit="kg"
                status={patient.vitals?.weightStatus || 'normal'}
                icon={MonitorWeight}
              />
            </Grid>
          </Grid>

          {patient.vitals?.rhythmIrregularity !== null && patient.vitals?.rhythmIrregularity !== undefined && (
            <Box sx={{ mb: 3 }}>
              <Chip
                color={patient.vitals.rhythmIrregularity ? 'warning' : 'success'}
                label={patient.vitals.rhythmIrregularity ? 'Irregular rhythm flagged' : 'Rhythm appears regular'}
              />
            </Box>
          )}

          {/* Vitals Chart */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Vitals Trend (Last 7 Days)
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vitalHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <ChartTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="heartRate" stroke="#ef4444" name="Heart Rate" />
                    <Line type="monotone" dataKey="systolic" stroke="#3b82f6" name="Systolic" />
                    <Line type="monotone" dataKey="diastolic" stroke="#10b981" name="Diastolic" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {tabValue === 3 && (
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Caregiver</TableCell>
                    <TableCell>Wellness Score</TableCell>
                    <TableCell>Mobility</TableCell>
                    <TableCell>Fall / Decline</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {checkIns.map((checkIn) => (
                    <TableRow key={checkIn._id}>
                      <TableCell>
                        {new Date(checkIn.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={checkIn.method} />
                      </TableCell>
                      <TableCell>
                        {checkIn.caregiver?.firstName} {checkIn.caregiver?.lastName}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={checkIn.wellnessScore || '--'}
                          color={checkIn.wellnessScore >= 7 ? 'success' : checkIn.wellnessScore >= 4 ? 'warning' : 'error'}
                        />
                      </TableCell>
                      <TableCell>
                        {formatFunctionalValue('mobility', checkIn.functionalStatus?.mobility, '--')}
                      </TableCell>
                      <TableCell>
                        {(getFunctionalConcernLabels(checkIn.functionalStatus || {}).slice(0, 2).join(' | ')) || '--'}
                      </TableCell>
                      <TableCell>{checkIn.notes || '--'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={checkIn.status}
                          color={checkIn.status === 'completed' ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {checkIns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        No check-ins recorded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {tabValue === 4 && (
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert._id}>
                      <TableCell>
                        {new Date(alert.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={alert.type} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={alert.severity}
                          color={alert.severity === 'critical' ? 'error' : 'warning'}
                        />
                      </TableCell>
                      <TableCell>{alert.message}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={alert.status}
                          color={alert.status === 'resolved' ? 'success' : 'warning'}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined">
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {alerts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No alerts
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {tabValue === 5 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Medication Adherence
              </Typography>
              <Button variant="outlined" startIcon={<Edit />} onClick={() => navigate(`/patients/${id}/edit`)}>
                Update Medications
              </Button>
            </Box>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">Active</Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {medicationSummary.totalActive || 0}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">Due Today</Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {medicationSummary.dueToday || 0}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">Taken Today</Typography>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {medicationSummary.takenToday || 0}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">Refill Risks</Typography>
                  <Typography variant="h5" fontWeight={700} color={(medicationSummary.refillRisks || 0) > 0 ? 'warning.main' : 'text.primary'}>
                    {medicationSummary.refillRisks || 0}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <List>
              {medications.map((med, index) => (
                <React.Fragment key={index}>
                  <ListItem>
                    <ListItemIcon><Medication /></ListItemIcon>
                    <ListItemText
                      primary={med.name}
                      secondary={[
                        [med.dosage, med.frequency].filter(Boolean).join(' - '),
                        med.scheduledTime ? `Due ${med.scheduledTime}` : null,
                        med.lastConfirmedAt ? `Last confirmed ${new Date(med.lastConfirmedAt).toLocaleString()}` : null,
                        med.recentMissReason || null,
                      ].filter(Boolean).join(' | ')}
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {med.dueToday && (
                          <Chip
                            size="small"
                            label={med.todayStatus || 'due today'}
                            color={med.todayStatus === 'missed' ? 'warning' : med.todayStatus === 'taken' ? 'success' : 'info'}
                          />
                        )}
                        <Chip
                          size="small"
                          label={med.refillStatus || med.status}
                          color={med.refillStatus === 'overdue' ? 'error' : med.refillStatus === 'due_soon' ? 'warning' : 'success'}
                        />
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {(med.sideEffectPrompts?.length > 0 || med.recentSideEffects?.length > 0) && (
                    <Box sx={{ pl: 9, pr: 2, pb: 2 }}>
                      {med.sideEffectPrompts?.length > 0 && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Watch for: {med.sideEffectPrompts.join(', ')}
                        </Typography>
                      )}
                      {med.recentSideEffects?.length > 0 && (
                        <Typography variant="caption" color="warning.main" display="block">
                          Recent side effects: {med.recentSideEffects.join(', ')}
                        </Typography>
                      )}
                    </Box>
                  )}
                  {index < medications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              {medications.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                  No medications on record
                </Typography>
              )}
            </List>
          </CardContent>
        </Card>
      )}

      {tabValue === 6 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Care Transitions
              </Typography>
              <Chip
                size="small"
                color={transitions.length > 0 ? 'warning' : 'default'}
                label={`${transitions.length} active`}
              />
            </Box>

            <List>
              {transitions.map((transition, index) => (
                <React.Fragment key={transition._id || transition.transitionId || index}>
                  <ListItem alignItems="flex-start">
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: transition.status === 'active' ? 'warning.light' : 'success.light' }}>
                        <Schedule />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Typography variant="body1" fontWeight={600}>
                            {transition.transitionType?.replace(/_/g, ' ') || 'care transition'}
                          </Typography>
                          <Chip size="small" label={transition.status || 'active'} color={transition.status === 'active' ? 'warning' : 'success'} />
                          <Chip size="small" variant="outlined" label={transition.transitionId || 'Transition'} />
                        </Box>
                      }
                      secondary={
                        <Box component="span" sx={{ display: 'block', mt: 1 }}>
                          <Typography component="span" variant="body2" color="text.secondary" display="block">
                            {[
                              transition.dischargeFacility || null,
                              transition.dischargeDate ? `Discharged ${new Date(transition.dischargeDate).toLocaleDateString()}` : null,
                              transition.nextReviewDate ? `Next review ${new Date(transition.nextReviewDate).toLocaleDateString()}` : null,
                            ].filter(Boolean).join(' | ')}
                          </Typography>
                          <Typography component="span" variant="body2" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            {transition.diagnosisSummary || transition.summary?.summary || 'No transition summary recorded yet.'}
                          </Typography>
                          {(transition.redFlags || []).length > 0 && (
                            <Typography component="span" variant="body2" color="warning.main" display="block" sx={{ mt: 0.5 }}>
                              Red flags: {transition.redFlags.join(', ')}
                            </Typography>
                          )}
                          {(transition.followUpTasks || []).length > 0 && (
                            <Box component="span" sx={{ display: 'block', mt: 1 }}>
                              {(transition.followUpTasks || []).slice(0, 3).map((task, taskIndex) => (
                                <Chip
                                  key={`${transition._id || transition.transitionId}-task-${taskIndex}`}
                                  size="small"
                                  sx={{ mr: 1, mb: 1 }}
                                  color={task.status === 'overdue' ? 'error' : task.status === 'completed' ? 'success' : 'info'}
                                  label={[
                                    task.title || 'Follow-up task',
                                    task.dueDate ? new Date(task.dueDate).toLocaleDateString() : null,
                                    task.status || null,
                                  ].filter(Boolean).join(' | ')}
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < transitions.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              {transitions.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                  No active care transitions for this patient
                </Typography>
              )}
            </List>
          </CardContent>
        </Card>
      )}

      {tabValue === 7 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Connected Devices
              </Typography>
              <Button variant="outlined" startIcon={<Add />} onClick={() => setAddDeviceDialog(true)}>
                Add Device
              </Button>
            </Box>
            <List>
              {devices.map((device, index) => (
                <React.Fragment key={index}>
                  <ListItem>
                    <ListItemIcon><Devices /></ListItemIcon>
                    <ListItemText
                      primary={device.name || device.type}
                      secondary={`ID: ${device.deviceId} | Last seen: ${device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}`}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        size="small"
                        label={device.status}
                        color={device.status === 'online' ? 'success' : 'default'}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < devices.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              {devices.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                  No devices connected
                </Typography>
              )}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Patient</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {patient.firstName} {patient.lastName}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientDetailPage;
