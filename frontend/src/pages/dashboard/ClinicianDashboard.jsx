/**
 * CHENGETO Health - Clinician Dashboard
 * Clinical overview, patient vitals, and medical insights
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Favorite,
  Opacity,
  Thermostat,
  Air,
  Speed,
  Warning,
  TrendingUp,
  TrendingDown,
  Remove,
  Person,
  Schedule,
  Notifications,
  Assessment,
  LocalHospital,
  HealthAndSafety,
  MonitorHeart,
  Medication,
  Notes,
  Print,
  Share,
} from '@mui/icons-material';
import { useSocket } from '../../contexts/SocketContext';
import { useSnackbar } from 'notistack';
import { api } from '../../contexts/AuthContext';
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
import { useNavigate } from 'react-router-dom';

// Vitals Card Component
const VitalsCard = ({ title, value, unit, trend, status, icon: Icon, color }) => {
  const statusColors = {
    normal: 'success',
    warning: 'warning',
    critical: 'error',
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={700}>
              {value}
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                {unit}
              </Typography>
            </Typography>
          </Box>
          <Avatar sx={{ bgcolor: `${statusColors[status]}.light`, color: `${statusColors[status]}.dark` }}>
            <Icon />
          </Avatar>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          {trend === 'up' && <TrendingUp fontSize="small" color="warning" />}
          {trend === 'down' && <TrendingDown fontSize="small" color="info" />}
          {trend === 'stable' && <Remove fontSize="small" color="success" />}
          <Chip
            size="small"
            label={status}
            color={statusColors[status]}
            sx={{ ml: 1 }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

const getRiskColor = (level) => {
  if (level === 'critical') return 'error';
  if (level === 'high') return 'warning';
  if (level === 'moderate') return 'info';
  return 'success';
};

// Patient Row Component
const PatientRow = ({ patient, onClick }) => {
  const getAlertStatus = () => {
    if (patient.activeAlerts > 0) return 'critical';
    if (patient.pendingActions > 0) return 'warning';
    return 'normal';
  };

  return (
    <TableRow
      hover
      onClick={() => onClick(patient)}
      sx={{ cursor: 'pointer' }}
    >
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 36, height: 36 }}>
            {patient.firstName?.[0]}{patient.lastName?.[0]}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {patient.firstName} {patient.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ID: {patient.medicalId}
            </Typography>
          </Box>
        </Box>
      </TableCell>
      <TableCell>
        <Box>
          <Typography variant="body2">
            {patient.age} yrs, {patient.gender}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {patient.conditions?.slice(0, 2).join(', ')}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Chip
            size="small"
            icon={<Favorite />}
            label={`${patient.vitals?.heartRate || '--'} bpm`}
            variant="outlined"
            color={patient.vitals?.heartRateStatus || 'default'}
          />
          <Chip
            size="small"
            icon={<Opacity />}
            label={`${patient.vitals?.bloodPressure || '--'}`}
            variant="outlined"
            color={patient.vitals?.bpStatus || 'default'}
          />
        </Box>
      </TableCell>
      <TableCell>
        {patient.lastCheckIn ? (
          <Typography variant="body2">
            {new Date(patient.lastCheckIn).toLocaleDateString()}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Never
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {patient.activeAlerts > 0 && (
            <Chip
              size="small"
              icon={<Warning />}
              label={patient.activeAlerts}
              color="error"
            />
          )}
          {patient.adherenceScore < 80 && (
            <Chip
              size="small"
              label={`${patient.adherenceScore}%`}
              color="warning"
            />
          )}
          {patient.riskLevel && (
            <Chip
              size="small"
              label={`${patient.riskLevel} risk`}
              color={getRiskColor(patient.riskLevel)}
              variant="outlined"
            />
          )}
          {patient.transitionCount > 0 && (
            <Chip
              size="small"
              icon={<Schedule />}
              label={`${patient.transitionCount} transition${patient.transitionCount > 1 ? 's' : ''}`}
              color="info"
              variant="outlined"
            />
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
};

const ClinicianDashboard = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { socket } = useSocket();

  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientDialog, setPatientDialog] = useState(false);
  const [vitalHistory, setVitalHistory] = useState([]);

  useEffect(() => {
    fetchDashboardData();

    if (socket) {
      socket.on('patient:vitals', (data) => {
        setPatients(prev =>
          prev.map(p => p._id === data.patientId ? { ...p, vitals: data.vitals } : p)
        );
      });
      socket.on('alert:new', (alert) => {
        setAlerts(prev => [alert, ...prev.slice(0, 19)]);
        enqueueSnackbar(`New alert: ${alert.type}`, { variant: 'warning' });
      });
    }

    return () => {
      if (socket) {
        socket.off('patient:vitals');
        socket.off('alert:new');
      }
    };
  }, [socket]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, patientsRes, alertsRes] = await Promise.all([
        api.get('/dashboard/clinician/stats'),
        api.get('/dashboard/clinician/patients'),
        api.get('/alerts/active'),
      ]);

      setStats(statsRes.data);
      setPatients(Array.isArray(patientsRes.data) ? patientsRes.data : []);
      setAlerts(alertsRes.data?.data?.alerts || []);
    } catch (error) {
      console.error('Failed to fetch clinician dashboard data:', error);
      enqueueSnackbar('Failed to load dashboard data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientVitalHistory = async (patientId) => {
    try {
      const response = await api.get(`/dashboard/clinician/patient/${patientId}/vitals?days=7`);
      setVitalHistory(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch vital history:', error);
    }
  };

  const handlePatientClick = async (patient) => {
    setSelectedPatient(patient);
    setPatientDialog(true);
    await fetchPatientVitalHistory(patient._id);
  };

  const getPrimaryPatient = () => selectedPatient || patients[0] || null;

  const navigateToPatient = (message) => {
    const patient = getPrimaryPatient();

    if (!patient?._id) {
      navigate('/patients');
      enqueueSnackbar('No patient is selected yet, so the patient list was opened instead.', {
        variant: 'info'
      });
      return;
    }

    setPatientDialog(false);
    navigate(`/patients/${patient._id}`);

    if (message) {
      enqueueSnackbar(message, { variant: 'info' });
    }
  };

  const handleRecordVitals = () => {
    const patient = getPrimaryPatient();

    if (patient?._id) {
      setPatientDialog(false);
      navigate(`/patients/${patient._id}/vitals`);
      return;
    }

    navigate('/patients');
    enqueueSnackbar('Select a patient to review or record vitals.', { variant: 'info' });
  };

  const handleUpdateMedications = () => {
    navigateToPatient('Opened the patient profile so you can review medications there.');
  };

  const handleAddClinicalNote = () => {
    navigateToPatient('Opened the patient profile so you can add a clinical note there.');
  };

  const handleRequestConsultation = () => {
    if (alerts[0]?._id) {
      navigate(`/alerts/${alerts[0]._id}`);
      enqueueSnackbar('Opened the latest alert so you can continue the consultation workflow.', {
        variant: 'info'
      });
      return;
    }

    navigateToPatient('Opened the patient profile so you can prepare a consultation from there.');
  };

  const handleViewAllAlerts = () => {
    navigate('/alerts');
  };

  const handlePrintSummary = () => {
    window.print();
  };

  const handleExportSummary = () => {
    enqueueSnackbar('Export is not available yet, so use Print to capture the current dashboard.', {
      variant: 'info'
    });
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
          Clinician Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Patient monitoring and clinical overview
        </Typography>
      </Box>

      {/* Stats Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <VitalsCard
            title="Total Patients"
            value={stats?.totalPatients || 0}
            unit=""
            trend="stable"
            status="normal"
            icon={Person}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalsCard
            title="Critical Alerts"
            value={stats?.criticalAlerts || 0}
            unit=""
            trend={stats?.criticalAlertsTrend || 'stable'}
            status={stats?.criticalAlerts > 0 ? 'critical' : 'normal'}
            icon={Warning}
            color="error"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalsCard
            title="Avg Adherence"
            value={stats?.avgAdherence || 0}
            unit="%"
            trend={stats?.adherenceTrend || 'stable'}
            status={stats?.avgAdherence >= 80 ? 'normal' : 'warning'}
            icon={HealthAndSafety}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalsCard
            title="High Risk"
            value={stats?.highRiskPatients || 0}
            unit=""
            trend={stats?.highRiskPatients > 0 ? 'up' : 'stable'}
            status={stats?.highRiskPatients > 0 ? 'warning' : 'normal'}
            icon={Warning}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalsCard
            title="Active Transitions"
            value={stats?.activeTransitions || 0}
            unit=""
            trend={stats?.activeTransitions > 0 ? 'up' : 'stable'}
            status={stats?.activeTransitions > 0 ? 'warning' : 'normal'}
            icon={Schedule}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VitalsCard
            title="Pending Reviews"
            value={stats?.pendingReviews || 0}
            unit=""
            trend="stable"
            status={stats?.pendingReviews > 5 ? 'warning' : 'normal'}
            icon={Assessment}
            color="info"
          />
        </Grid>
      </Grid>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Patients Table */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Patient Monitoring
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" startIcon={<Print />} onClick={handlePrintSummary}>Print</Button>
                  <Button size="small" variant="outlined" startIcon={<Share />} onClick={handleExportSummary}>
                    Export
                  </Button>
                </Box>
              </Box>

              <Tabs
                value={tabValue}
                onChange={(e, v) => setTabValue(v)}
                sx={{ mb: 2 }}
              >
                <Tab label="All Patients" />
                <Tab label={`Critical (${stats?.criticalPatients || 0})`} />
                <Tab label="Needs Attention" />
              </Tabs>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Patient</TableCell>
                      <TableCell>Demographics</TableCell>
                      <TableCell>Current Vitals</TableCell>
                      <TableCell>Last Check-in</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {patients
                      .filter(p => {
                        if (tabValue === 1) return p.activeAlerts > 0 || ['high', 'critical'].includes(p.riskLevel);
                        if (tabValue === 2) return p.adherenceScore < 80 || p.pendingActions > 0 || p.transitionCount > 0;
                        return true;
                      })
                      .slice(0, 10)
                      .map((patient) => (
                        <PatientRow
                          key={patient._id}
                          patient={patient}
                          onClick={handlePatientClick}
                        />
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Active Alerts */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Active Alerts
              </Typography>
              <List dense>
                {alerts.slice(0, 5).map((alert, index) => (
                  <React.Fragment key={alert._id}>
                    <ListItem>
                      <ListItemIcon>
                        <Avatar sx={{
                          bgcolor: alert.severity === 'critical' ? 'error.light' : 'warning.light',
                          width: 32,
                          height: 32
                        }}>
                          <Warning fontSize="small" />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={alert.message || alert.type}
                        secondary={`${alert.patient?.firstName} ${alert.patient?.lastName}`}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                      <Chip size="small" label={alert.severity} color={alert.severity === 'critical' ? 'error' : 'warning'} />
                    </ListItem>
                    {index < alerts.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
                {alerts.length === 0 && (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                    No active alerts
                  </Typography>
                )}
              </List>
              {alerts.length > 5 && (
                <Button size="small" fullWidth sx={{ mt: 1 }} onClick={handleViewAllAlerts}>
                  View All Alerts
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button variant="outlined" startIcon={<MonitorHeart />} fullWidth onClick={handleRecordVitals}>
                  Record Vitals
                </Button>
                <Button variant="outlined" startIcon={<Medication />} fullWidth onClick={handleUpdateMedications}>
                  Update Medications
                </Button>
                <Button variant="outlined" startIcon={<Notes />} fullWidth onClick={handleAddClinicalNote}>
                  Add Clinical Note
                </Button>
                <Button variant="outlined" startIcon={<LocalHospital />} fullWidth onClick={handleRequestConsultation}>
                  Request Consultation
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Patient Detail Dialog */}
      <Dialog
        open={patientDialog}
        onClose={() => setPatientDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar>
              {selectedPatient?.firstName?.[0]}{selectedPatient?.lastName?.[0]}
            </Avatar>
            <Box>
              <Typography variant="h6">
                {selectedPatient?.firstName} {selectedPatient?.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ID: {selectedPatient?.medicalId} | {selectedPatient?.age} yrs, {selectedPatient?.gender}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedPatient && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Vitals Trend (Last 7 Days)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip
                  size="small"
                  color={getRiskColor(selectedPatient.riskLevel)}
                  label={`${selectedPatient.riskLevel || 'low'} risk`}
                />
                <Chip
                  size="small"
                  label={`Score ${selectedPatient.riskScore || 0}`}
                  variant="outlined"
                />
                {selectedPatient.transitionCount > 0 && (
                  <Chip
                    size="small"
                    color="info"
                    icon={<Schedule />}
                    label={`${selectedPatient.transitionCount} active transition${selectedPatient.transitionCount > 1 ? 's' : ''}`}
                  />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {selectedPatient.riskSummary || 'No additional risk explanation is available yet.'}
              </Typography>
              <Box sx={{ height: 250, mb: 3 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={vitalHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip />
                    <Area type="monotone" dataKey="heartRate" stroke="#ef4444" fill="#fecaca" name="Heart Rate" />
                    <Area type="monotone" dataKey="systolic" stroke="#3b82f6" fill="#bfdbfe" name="Systolic" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Primary Diagnosis"
                    value={selectedPatient.diagnosis || 'Not specified'}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Care Level"
                    value={selectedPatient.careLevel || 'Standard'}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPatientDialog(false)}>Close</Button>
          <Button variant="outlined" startIcon={<Notes />} onClick={handleAddClinicalNote}>Add Note</Button>
          <Button variant="contained" startIcon={<Person />} onClick={() => navigateToPatient()}>
            View Full Profile
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClinicianDashboard;
