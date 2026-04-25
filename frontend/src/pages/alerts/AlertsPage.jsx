/**
 * CHENGETO Health - Alerts Page
 * View and manage all alerts with filtering
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  InputAdornment,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Alert as MuiAlert,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Warning,
  CheckCircle,
  Schedule,
  Refresh,
  FilterList,
  Search,
  Notifications,
  Person,
  AccessTime,
  PriorityHigh,
  Done,
  Visibility,
  Clear,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';
import { format, formatDistanceToNow } from 'date-fns';

const severityLevels = ['critical', 'high', 'medium', 'low'];
const statusOptions = ['active', 'acknowledged', 'escalated', 'resolved'];
const alertTypes = ['vital', 'fall', 'missed_checkin', 'device_offline', 'medication', 'panic', 'geofence'];

const AlertsPage = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { socket } = useSocket();
  const { api } = useAuth();
  const { isOnline, cacheData, getCachedData } = useOffline();

  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [stats, setStats] = useState({});
  const [usingCached, setUsingCached] = useState(false);

  // Filters
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState(['active']);
  const [typeFilter, setTypeFilter] = useState([]);

  // Selection
  const [selected, setSelected] = useState([]);

  // Acknowledge dialog
  const [ackDialog, setAckDialog] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [ackNotes, setAckNotes] = useState('');

  useEffect(() => {
    fetchAlerts();
    fetchStats();

    // Listen for new alerts
    if (socket) {
      socket.on('alert:new', (alert) => {
        setAlerts(prev => [alert, ...prev]);
        setStats(prev => ({
          ...prev,
          active: (prev.active || 0) + 1,
          total: (prev.total || 0) + 1,
        }));
        enqueueSnackbar(`New ${alert.severity} alert: ${alert.type}`, {
          variant: alert.severity === 'critical' ? 'error' : 'warning',
        });
      });
    }

    return () => {
      if (socket) {
        socket.off('alert:new');
      }
    };
  }, [socket]);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setUsingCached(false);

      const response = await api.get('/alerts', {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          search: searchQuery || undefined,
          severity: severityFilter.length > 0 ? severityFilter.join(',') : undefined,
          status: statusFilter.length > 0 ? statusFilter.join(',') : undefined,
          type: typeFilter.length > 0 ? typeFilter.join(',') : undefined,
        },
      });

      const payload = response?.data?.data?.alerts || response?.data?.alerts || [];
      const total = response?.data?.data?.total || response?.data?.total || payload.length || 0;

      setAlerts(Array.isArray(payload) ? payload : []);
      setTotalAlerts(Number(total) || 0);

      if (Array.isArray(payload) && payload.length > 0) {
        await cacheData('alerts', payload);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);

      const cached = await getCachedData('alerts');
      if (Array.isArray(cached) && cached.length > 0) {
        setUsingCached(true);

        const normalizedQuery = String(searchQuery || '').trim().toLowerCase();
        const filtered = cached.filter((alert) => {
          if (severityFilter.length > 0 && !severityFilter.includes(alert?.severity)) return false;
          if (statusFilter.length > 0 && !statusFilter.includes(alert?.status)) return false;
          if (typeFilter.length > 0 && !typeFilter.includes(alert?.type)) return false;
          if (!normalizedQuery) return true;

          const haystack = [
            alert?.title,
            alert?.message,
            alert?.type,
            alert?.severity,
            alert?._id,
            alert?.patient?.name,
            alert?.patient?.id
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(normalizedQuery);
        });

        const start = page * rowsPerPage;
        const pageItems = filtered.slice(start, start + rowsPerPage);
        setAlerts(pageItems);
        setTotalAlerts(filtered.length);
        enqueueSnackbar('Offline: showing cached alerts', { variant: 'warning' });
      } else {
        enqueueSnackbar(isOnline ? 'Failed to load alerts' : 'Offline: no cached alerts yet', { variant: 'error' });
        setAlerts([]);
        setTotalAlerts(0);
      }
    } finally {
      setLoading(false);
    }
  }, [api, cacheData, enqueueSnackbar, getCachedData, isOnline, page, rowsPerPage, searchQuery, severityFilter, statusFilter, typeFilter]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/alerts/stats');
      setStats(response?.data?.data || response?.data || {});
    } catch (error) {
      console.error('Failed to fetch alert stats:', error);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelected(alerts.map((a) => a._id));
    } else {
      setSelected([]);
    }
  };

  const handleSelect = (id) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = [...selected, id];
    } else {
      newSelected = selected.filter((s) => s !== id);
    }

    setSelected(newSelected);
  };

  const handleAcknowledge = async () => {
    if (!selectedAlert) return;

    try {
      if (!isOnline) {
        enqueueSnackbar('Offline: acknowledging alerts is unavailable', { variant: 'warning' });
        return;
      }

      await api.patch(`/alerts/${selectedAlert._id}/acknowledge`, {
        notes: ackNotes,
      });

      setAlerts(prev =>
        prev.map(a =>
          a._id === selectedAlert._id
            ? { ...a, status: 'acknowledged', acknowledgedAt: new Date().toISOString() }
            : a
        )
      );

      fetchStats();
      enqueueSnackbar('Alert acknowledged', { variant: 'success' });
      setAckDialog(false);
      setAckNotes('');
      setSelectedAlert(null);
    } catch (error) {
      enqueueSnackbar('Failed to acknowledge alert', { variant: 'error' });
    }
  };

  const handleResolve = async (alertId) => {
    try {
      if (!isOnline) {
        enqueueSnackbar('Offline: resolving alerts is unavailable', { variant: 'warning' });
        return;
      }

      await api.patch(`/alerts/${alertId}/resolve`);

      setAlerts(prev =>
        prev.map(a =>
          a._id === alertId
            ? { ...a, status: 'resolved', resolvedAt: new Date().toISOString() }
            : a
        )
      );

      fetchStats();
      enqueueSnackbar('Alert resolved', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to resolve alert', { variant: 'error' });
    }
  };

  const handleBulkAcknowledge = async () => {
    try {
      if (!isOnline) {
        enqueueSnackbar('Offline: acknowledging alerts is unavailable', { variant: 'warning' });
        return;
      }

      await api.post('/alerts/bulk-acknowledge', { alertIds: selected });
      setAlerts(prev =>
        prev.map(a =>
          selected.includes(a._id)
            ? { ...a, status: 'acknowledged' }
            : a
        )
      );
      setSelected([]);
      fetchStats();
      enqueueSnackbar(`${selected.length} alerts acknowledged`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to acknowledge alerts', { variant: 'error' });
    }
  };

  const handleBulkResolve = async () => {
    try {
      if (!isOnline) {
        enqueueSnackbar('Offline: resolving alerts is unavailable', { variant: 'warning' });
        return;
      }

      await api.post('/alerts/bulk-resolve', { alertIds: selected });
      setAlerts(prev =>
        prev.map(a =>
          selected.includes(a._id)
            ? { ...a, status: 'resolved' }
            : a
        )
      );
      setSelected([]);
      fetchStats();
      enqueueSnackbar(`${selected.length} alerts resolved`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to resolve alerts', { variant: 'error' });
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

  const getSeverityIcon = (severity) => {
    if (severity === 'critical') {
      return <PriorityHigh fontSize="small" />;
    }
    return <Warning fontSize="small" />;
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Alerts
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Monitor and manage patient alerts
        </Typography>
      </Box>

      {usingCached && (
        <MuiAlert severity="info" sx={{ mb: 2 }}>
          Offline mode: showing cached alert data. Some actions may be limited until you reconnect.
        </MuiAlert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ bgcolor: 'error.light' }}>
                  <Warning />
                </Avatar>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {stats.active || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ bgcolor: 'warning.light' }}>
                  <Schedule />
                </Avatar>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {stats.acknowledged || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Acknowledged
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ bgcolor: 'success.light' }}>
                  <CheckCircle />
                </Avatar>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {stats.resolved || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Resolved Today
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ bgcolor: 'info.light' }}>
                  <Notifications />
                </Avatar>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {stats.total || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Today
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Critical Alert Banner */}
      {stats.critical > 0 && (
        <MuiAlert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => {
              setSeverityFilter(['critical']);
              setStatusFilter(['active']);
            }}>
              View Critical Alerts
            </Button>
          }
        >
          <strong>{stats.critical} critical alert(s)</strong> require immediate attention!
        </MuiAlert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')}>
                        <Clear fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  multiple
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  input={<OutlinedInput label="Severity" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {severityLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  multiple
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  input={<OutlinedInput label="Status" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {statusOptions.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  multiple
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  input={<OutlinedInput label="Type" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.slice(0, 2).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                      {selected.length > 2 && <Chip label={`+${selected.length - 2}`} size="small" />}
                    </Box>
                  )}
                >
                  {alertTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={fetchAlerts}
                  fullWidth
                >
                  Refresh
                </Button>
                {selected.length > 0 && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<Done />}
                    onClick={handleBulkResolve}
                  >
                    Resolve ({selected.length})
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < alerts.length}
                    checked={alerts.length > 0 && selected.length === alerts.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Alert</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Time</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts.map((alert) => {
                const isItemSelected = isSelected(alert._id);

                return (
                  <TableRow
                    hover
                    key={alert._id}
                    selected={isItemSelected}
                    sx={{
                      bgcolor: alert.severity === 'critical' && alert.status === 'active'
                        ? 'error.50'
                        : 'inherit',
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isItemSelected}
                        onClick={() => handleSelect(alert._id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {alert.message || alert.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {alert.details}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {alert.patient ? (
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                          onClick={() => navigate(`/patients/${alert.patient._id}`)}
                        >
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {alert.patient.firstName?.[0]}{alert.patient.lastName?.[0]}
                          </Avatar>
                          <Box>
                            <Typography variant="body2">
                              {alert.patient.firstName} {alert.patient.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {alert.patient.medicalId}
                            </Typography>
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Unknown
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        icon={getSeverityIcon(alert.severity)}
                        label={alert.severity}
                        color={getSeverityColor(alert.severity)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={alert.status}
                        color={getStatusColor(alert.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={alert.timestamp ? format(new Date(alert.timestamp), 'PPpp') : ''}>
                        <Typography variant="body2">
                          {alert.timestamp ? formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true }) : '--'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/alerts/${alert._id}`)}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                        {alert.status === 'active' && (
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => {
                              setSelectedAlert(alert);
                              setAckDialog(true);
                            }}
                          >
                            <Schedule fontSize="small" />
                          </IconButton>
                        )}
                        {alert.status !== 'resolved' && (
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleResolve(alert._id)}
                          >
                            <CheckCircle fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
              {alerts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Notifications sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No alerts found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalAlerts}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </Card>

      {/* Acknowledge Dialog */}
      <Dialog open={ackDialog} onClose={() => setAckDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Acknowledge Alert</DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Alert: {selectedAlert.message || selectedAlert.type}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Patient: {selectedAlert.patient?.firstName} {selectedAlert.patient?.lastName}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                placeholder="Add any relevant notes about this alert..."
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAckDialog(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleAcknowledge}>
            Acknowledge
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AlertsPage;
