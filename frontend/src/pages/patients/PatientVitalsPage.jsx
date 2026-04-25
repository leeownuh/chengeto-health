/**
 * CHENGETO Health - Patient Vitals Page
 * Real-time and historical vital signs monitoring
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  Avatar,
} from '@mui/material';
import {
  Favorite,
  Opacity,
  Thermostat,
  Air,
  Speed,
  Refresh,
  Print,
  GetApp,
  Add,
  History,
  TrendingUp,
  Warning,
  CheckCircle,
  Schedule,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';
import { buildFunctionalSummary } from '../../utils/functionalStatus';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';
import { format, subDays, subHours, subMinutes } from 'date-fns';

// Vital Card Component
const VitalCard = ({ title, value, unit, status, icon: Icon, min, max, onChange, editable }) => {
  const statusColors = {
    normal: 'success',
    warning: 'warning',
    critical: 'error',
  };

  const getStatusValue = () => {
    if (!value) return 'normal';
    if (min !== undefined && max !== undefined) {
      if (value < min || value > max) return 'critical';
    }
    return 'normal';
  };

  const currentStatus = status || getStatusValue();

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h3" fontWeight={700}>
              {value !== null && value !== undefined ? value : '--'}
              <Typography component="span" variant="h6" color="text.secondary" sx={{ ml: 0.5 }}>
                {unit}
              </Typography>
            </Typography>
            {min !== undefined && max !== undefined && (
              <Typography variant="caption" color="text.secondary">
                Normal: {min} - {max}
              </Typography>
            )}
          </Box>
          <Avatar sx={{
            bgcolor: `${statusColors[currentStatus]}.light`,
            color: `${statusColors[currentStatus]}.dark`,
            width: 48,
            height: 48
          }}>
            <Icon />
          </Avatar>
        </Box>
        <Chip
          size="small"
          label={currentStatus}
          color={statusColors[currentStatus]}
          sx={{ mt: 1 }}
        />
      </CardContent>
    </Card>
  );
};

const PatientVitalsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { socket } = useSocket();
  const { api } = useAuth();
  const { isOnline, cacheData, getCachedData } = useOffline();

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [currentVitals, setCurrentVitals] = useState(null);
  const [vitalHistory, setVitalHistory] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [selectedVital, setSelectedVital] = useState('heartRate');
  const [timeRange, setTimeRange] = useState('24h');
  const [manualEntryDialog, setManualEntryDialog] = useState(false);
  const [manualVitals, setManualVitals] = useState({
    heartRate: '',
    systolic: '',
    diastolic: '',
    temperature: '',
    spo2: '',
    notes: '',
  });

  useEffect(() => {
    fetchPatientData();
    fetchVitalHistory();
    fetchCheckInHistory();

    // Subscribe to real-time vitals
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

        setCurrentVitals(nextVitals);
        setVitalHistory((prev) => [...prev.slice(-287), nextVitals]);
      });
    }

    return () => {
      if (socket) {
        socket.emit('patient:unsubscribe', id);
        socket.off('telemetry:update');
      }
    };
  }, [id, socket]);

  useEffect(() => {
    fetchVitalHistory();
  }, [timeRange]);

  const fetchPatientData = async () => {
    try {
      const response = await api.get(`/patients/${id}`);
      const payload = response?.data?.data?.patient || response?.data?.data || response?.data || null;
      setPatient(payload);
      if (payload?._id) {
        await cacheData('patients', payload);
      }
    } catch (error) {
      console.error('Failed to fetch patient:', error);
      const cached = await getCachedData('patients', id);
      if (cached) {
        setPatient(cached);
        enqueueSnackbar('Offline: showing cached patient profile', { variant: 'warning' });
      } else {
        enqueueSnackbar(isOnline ? 'Failed to load patient data' : 'Offline: patient not cached yet', { variant: 'error' });
      }
    }
  };

  const fetchVitalHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/patients/${id}/vitals/history`, { params: { range: timeRange } });
      const payload = response?.data?.data || response?.data || {};
      setCurrentVitals(payload.current || payload.vitals || payload.currentVitals || null);
      setVitalHistory(payload.history || payload.records || []);
    } catch (error) {
      console.error('Failed to fetch vital history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCheckInHistory = async () => {
    try {
      const response = await api.get(`/patients/${id}/checkins`, { params: { limit: 12 } });
      setCheckIns(response.data?.data?.checkins || response.data?.checkins || []);
    } catch (error) {
      console.error('Failed to fetch check-in history:', error);
    }
  };

  const handleManualEntry = async () => {
    try {
      if (!isOnline) {
        enqueueSnackbar('Offline: manual vitals entry is unavailable', { variant: 'warning' });
        return;
      }

      await api.post(`/patients/${id}/vitals`, {
        ...manualVitals,
        source: 'manual',
        timestamp: new Date().toISOString(),
      });
      enqueueSnackbar('Vitals recorded successfully', { variant: 'success' });
      setManualEntryDialog(false);
      setManualVitals({
        heartRate: '',
        systolic: '',
        diastolic: '',
        temperature: '',
        spo2: '',
        notes: '',
      });
      fetchVitalHistory();
    } catch (error) {
      enqueueSnackbar('Failed to record vitals', { variant: 'error' });
    }
  };

  const handleExport = async () => {
    try {
      if (!isOnline) {
        enqueueSnackbar('Offline: exporting vitals is unavailable', { variant: 'warning' });
        return;
      }

      const response = await api.get(`/patients/${id}/vitals/export`, {
        params: { range: timeRange },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `vitals-${patient?.lastName}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      enqueueSnackbar('Export failed', { variant: 'error' });
    }
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case '1h': return 'Last Hour';
      case '6h': return 'Last 6 Hours';
      case '24h': return 'Last 24 Hours';
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      default: return 'Last 24 Hours';
    }
  };

  const chartData = vitalHistory.map((v) => ({
    timestamp: v.timestamp ? format(new Date(v.timestamp), 'HH:mm') : '',
    time: v.timestamp,
    heartRate: v.heartRate,
    systolic: v.systolic,
    diastolic: v.diastolic,
    temperature: v.temperature,
    spo2: v.spo2,
  }));

  const thresholds = patient?.vitalThresholds || {};
  const functionalSummary = buildFunctionalSummary(patient, checkIns);

  if (loading && !patient) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Vital Signs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {patient?.firstName} {patient?.lastName} • Real-time monitoring
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchVitalHistory}>
            Refresh
          </Button>
          <Button variant="outlined" startIcon={<GetApp />} onClick={handleExport}>
            Export
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setManualEntryDialog(true)}>
            Record Vitals
          </Button>
        </Box>
      </Box>

      {/* Current Vitals */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} md={3}>
          <VitalCard
            title="Heart Rate"
            value={currentVitals?.heartRate}
            unit="bpm"
            icon={Favorite}
            min={thresholds.heartRateMin || 60}
            max={thresholds.heartRateMax || 100}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <VitalCard
            title="Blood Pressure"
            value={currentVitals ? `${currentVitals.systolic}/${currentVitals.diastolic}` : null}
            unit="mmHg"
            icon={Opacity}
            min={thresholds.systolicMin || 90}
            max={thresholds.systolicMax || 140}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <VitalCard
            title="Temperature"
            value={currentVitals?.temperature}
            unit="°C"
            icon={Thermostat}
            min={thresholds.temperatureMin || 36.0}
            max={thresholds.temperatureMax || 37.5}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <VitalCard
            title="SpO2"
            value={currentVitals?.spo2}
            unit="%"
            icon={Air}
            min={thresholds.spo2Min || 95}
            max={thresholds.spo2Max || 100}
          />
        </Grid>
      </Grid>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                Functional Decline Trend
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Fall events, mobility changes, and caregiver-reported decline from recent check-ins.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Chip size="small" color={functionalSummary.riskLevel === 'high' ? 'error' : functionalSummary.riskLevel === 'moderate' ? 'warning' : 'success'} label={`Fall risk: ${functionalSummary.riskLevel}`} />
              <Chip size="small" color={functionalSummary.trend === 'worsening' ? 'warning' : 'default'} label={`Trend: ${functionalSummary.trend.replace(/_/g, ' ')}`} />
            </Box>
          </Box>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">Falls in 30 days</Typography>
              <Typography variant="h5" fontWeight={700}>{functionalSummary.recentFalls30Days}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">Near falls</Typography>
              <Typography variant="h5" fontWeight={700}>{functionalSummary.nearFalls30Days}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">Current mobility</Typography>
              <Typography variant="body1" fontWeight={600}>{functionalSummary.currentMobility}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">Current balance</Typography>
              <Typography variant="body1" fontWeight={600}>{functionalSummary.currentBalance}</Typography>
            </Grid>
          </Grid>

          {functionalSummary.concernLabels.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {functionalSummary.concernLabels.map((label) => (
                <Chip key={label} size="small" color="warning" label={label} />
              ))}
            </Box>
          )}

          {functionalSummary.history.length > 0 ? (
            functionalSummary.history.map((entry, index) => (
              <React.Fragment key={`${entry.timestamp || 'functional'}-${index}`}>
                <Box sx={{ py: 1.5 }}>
                  <Typography variant="subtitle2">
                    {entry.timestamp ? format(new Date(entry.timestamp), 'PPP p') : 'Recent assessment'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {[entry.mobility, entry.gait, entry.balance].filter(Boolean).join(' | ')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {entry.concerns.length > 0 ? entry.concerns.join(' | ') : 'No major decline concerns recorded'}
                  </Typography>
                </Box>
                {index < functionalSummary.history.length - 1 && <Divider />}
              </React.Fragment>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No functional decline assessments have been recorded yet.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Chart Section */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Vitals Trend
              </Typography>
              <ToggleButtonGroup
                value={selectedVital}
                exclusive
                onChange={(e, v) => v && setSelectedVital(v)}
                size="small"
              >
                <ToggleButton value="heartRate">Heart Rate</ToggleButton>
                <ToggleButton value="bloodPressure">BP</ToggleButton>
                <ToggleButton value="temperature">Temp</ToggleButton>
                <ToggleButton value="spo2">SpO2</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={(e, v) => v && setTimeRange(v)}
              size="small"
            >
              <ToggleButton value="1h">1H</ToggleButton>
              <ToggleButton value="6h">6H</ToggleButton>
              <ToggleButton value="24h">24H</ToggleButton>
              <ToggleButton value="7d">7D</ToggleButton>
              <ToggleButton value="30d">30D</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <ChartTooltip
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #ddd' }}
                />
                <Legend />
                {selectedVital === 'heartRate' && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="heartRate"
                      stroke="#ef4444"
                      fill="#fecaca"
                      name="Heart Rate"
                    />
                    {thresholds.heartRateMin && (
                      <ReferenceLine y={thresholds.heartRateMin} stroke="#666" strokeDasharray="3 3" />
                    )}
                    {thresholds.heartRateMax && (
                      <ReferenceLine y={thresholds.heartRateMax} stroke="#666" strokeDasharray="3 3" />
                    )}
                  </>
                )}
                {selectedVital === 'bloodPressure' && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="systolic"
                      stroke="#3b82f6"
                      fill="#bfdbfe"
                      name="Systolic"
                    />
                    <Area
                      type="monotone"
                      dataKey="diastolic"
                      stroke="#10b981"
                      fill="#a7f3d0"
                      name="Diastolic"
                    />
                  </>
                )}
                {selectedVital === 'temperature' && (
                  <Area
                    type="monotone"
                    dataKey="temperature"
                    stroke="#f59e0b"
                    fill="#fde68a"
                    name="Temperature"
                  />
                )}
                {selectedVital === 'spo2' && (
                  <Area
                    type="monotone"
                    dataKey="spo2"
                    stroke="#8b5cf6"
                    fill="#ddd6fe"
                    name="SpO2"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      {/* Recent Readings Table */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Recent Readings
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee' }}>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Heart Rate</th>
                  <th style={thStyle}>Blood Pressure</th>
                  <th style={thStyle}>Temperature</th>
                  <th style={thStyle}>SpO2</th>
                  <th style={thStyle}>Source</th>
                </tr>
              </thead>
              <tbody>
                {vitalHistory.slice(-10).reverse().map((v, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={tdStyle}>
                      {v.timestamp ? format(new Date(v.timestamp), 'MMM dd, HH:mm') : '--'}
                    </td>
                    <td style={tdStyle}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {v.heartRate || '--'}
                        {v.heartRate && (v.heartRate < (thresholds.heartRateMin || 60) || v.heartRate > (thresholds.heartRateMax || 100)) && (
                          <Warning fontSize="small" color="error" />
                        )}
                      </Box>
                    </td>
                    <td style={tdStyle}>
                      {v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : '--'}
                    </td>
                    <td style={tdStyle}>{v.temperature || '--'}</td>
                    <td style={tdStyle}>{v.spo2 || '--'}</td>
                    <td style={tdStyle}>
                      <Chip size="small" label={v.source || 'device'} variant="outlined" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </CardContent>
      </Card>

      {/* Manual Entry Dialog */}
      <Dialog open={manualEntryDialog} onClose={() => setManualEntryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Manual Vitals</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Enter the vital signs manually. These will be logged with the current timestamp.
          </Alert>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Heart Rate (bpm)"
                type="number"
                value={manualVitals.heartRate}
                onChange={(e) => setManualVitals(prev => ({ ...prev, heartRate: e.target.value }))}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                label="Systolic"
                type="number"
                value={manualVitals.systolic}
                onChange={(e) => setManualVitals(prev => ({ ...prev, systolic: e.target.value }))}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                label="Diastolic"
                type="number"
                value={manualVitals.diastolic}
                onChange={(e) => setManualVitals(prev => ({ ...prev, diastolic: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Temperature (°C)"
                type="number"
                inputProps={{ step: 0.1 }}
                value={manualVitals.temperature}
                onChange={(e) => setManualVitals(prev => ({ ...prev, temperature: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="SpO2 (%)"
                type="number"
                value={manualVitals.spo2}
                onChange={(e) => setManualVitals(prev => ({ ...prev, spo2: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={2}
                value={manualVitals.notes}
                onChange={(e) => setManualVitals(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualEntryDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleManualEntry}>
            Save Vitals
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#64748b',
};

const tdStyle = {
  padding: '12px 16px',
  fontSize: '0.875rem',
};

export default PatientVitalsPage;
