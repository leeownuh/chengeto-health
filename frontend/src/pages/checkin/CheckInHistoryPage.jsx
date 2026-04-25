import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Tooltip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  LocationOn as LocationIcon,
  Bluetooth as BluetoothIcon,
  Nfc as NfcIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  TrendingUp as TrendingUpIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { api } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';

// Verification method chip component
const VerificationChip = ({ method }) => {
  const configs = {
    BLE: { icon: <BluetoothIcon />, color: 'primary', label: 'Bluetooth' },
    NFC: { icon: <NfcIcon />, color: 'secondary', label: 'NFC Tap' },
    GPS: { icon: <LocationIcon />, color: 'info', label: 'GPS' },
    MANUAL: { icon: <PersonIcon />, color: 'default', label: 'Manual' },
  };

  const config = configs[method] || configs.MANUAL;

  return (
    <Chip
      icon={config.icon}
      label={config.label}
      color={config.color}
      size="small"
      variant="outlined"
    />
  );
};

// Wellness score indicator
const WellnessIndicator = ({ score }) => {
  const getColor = () => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getIcon = () => {
    if (score >= 80) return <CheckCircleIcon />;
    if (score >= 60) return <WarningIcon />;
    return <ErrorIcon />;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Chip
        icon={getIcon()}
        label={`${score}%`}
        color={getColor()}
        size="small"
      />
      <Box
        sx={{
          width: 60,
          height: 6,
          bgcolor: 'grey.200',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${score}%`,
            height: '100%',
            bgcolor: `${getColor()}.main`,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </Box>
    </Box>
  );
};

// Check-in detail dialog
const CheckInDetailDialog = ({ open, onClose, checkIn }) => {
  if (!checkIn) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Check-in Details</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Patient Info */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Patient Information
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  {checkIn.patient?.name?.charAt(0) || 'P'}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1">{checkIn.patient?.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    ID: {checkIn.patient?.patientId}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Caregiver Info */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Caregiver Information
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  {checkIn.caregiver?.name?.charAt(0) || 'C'}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1">{checkIn.caregiver?.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {checkIn.caregiver?.role}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Verification Details */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Verification Details
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarIcon color="action" />
                  <Typography variant="body2">
                    {new Date(checkIn.timestamp).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimeIcon color="action" />
                  <Typography variant="body2">
                    {new Date(checkIn.timestamp).toLocaleTimeString()}
                  </Typography>
                </Box>
                <VerificationChip method={checkIn.verificationMethod} />
                {checkIn.location && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationIcon color="action" />
                    <Typography variant="body2">
                      {checkIn.location.latitude?.toFixed(6)}, {checkIn.location.longitude?.toFixed(6)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Vitals Recorded */}
          {checkIn.vitals && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Vital Signs Recorded
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {checkIn.vitals.heartRate && (
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5" color="error.main">
                          {checkIn.vitals.heartRate}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Heart Rate (bpm)
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {checkIn.vitals.bloodPressure && (
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5" color="primary.main">
                          {checkIn.vitals.bloodPressure.systolic}/{checkIn.vitals.bloodPressure.diastolic}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Blood Pressure
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {checkIn.vitals.temperature && (
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5" color="warning.main">
                          {checkIn.vitals.temperature}°C
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Temperature
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {checkIn.vitals.oxygenSaturation && (
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5" color="info.main">
                          {checkIn.vitals.oxygenSaturation}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          SpO2
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {checkIn.vitals.respiratoryRate && (
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5" color="secondary.main">
                          {checkIn.vitals.respiratoryRate}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Respiratory Rate
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {checkIn.vitals.bloodGlucose && (
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5" color="success.main">
                          {checkIn.vitals.bloodGlucose}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Blood Glucose
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {checkIn.vitals.weight && (
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5" color="primary.main">
                          {checkIn.vitals.weight} kg
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Weight
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>
          )}

          {/* Wellness Assessment */}
          {checkIn.wellnessAssessment && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Wellness Assessment
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Overall Score</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {checkIn.wellnessAssessment.overallScore}%
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: '100%',
                      height: 10,
                      bgcolor: 'grey.200',
                      borderRadius: 5,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${checkIn.wellnessAssessment.overallScore}%`,
                        height: '100%',
                        bgcolor: checkIn.wellnessAssessment.overallScore >= 80 ? 'success.main' : 
                                 checkIn.wellnessAssessment.overallScore >= 60 ? 'warning.main' : 'error.main',
                        borderRadius: 5,
                      }}
                    />
                  </Box>
                </Box>
                {checkIn.wellnessAssessment.notes && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Notes: {checkIn.wellnessAssessment.notes}
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          )}

          {/* Medications Administered */}
          {checkIn.medicationsAdministered && checkIn.medicationsAdministered.length > 0 && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Medications Administered
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {checkIn.medicationsAdministered.map((med, index) => (
                    <Chip
                      key={index}
                      label={med}
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Blockchain Record */}
          {checkIn.blockchainHash && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Blockchain Record
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {checkIn.blockchainHash}
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const CheckInHistoryPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const { socket } = useSocket();
  const { enqueueSnackbar } = useSnackbar();

  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    verificationMethod: '',
    dateFrom: '',
    dateTo: '',
    minWellnessScore: '',
  });
  const [selectedCheckIn, setSelectedCheckIn] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchCheckIns();
  }, [page, rowsPerPage, filters]);

  useEffect(() => {
    if (socket) {
      socket.on('new-checkin', (data) => {
        setCheckIns((prev) => [data, ...prev]);
      });

      return () => {
        socket.off('new-checkin');
      };
    }
  }, [socket]);

  const fetchCheckIns = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...filters
      };

      const response = await api.get('/checkins', { params });
      const payload = response.data?.data || response.data || {};
      setCheckIns(Array.isArray(payload.checkIns) ? payload.checkIns : []);
      setTotalRecords(Number(payload.total) || 0);
    } catch (error) {
      console.error('Error fetching check-ins:', error);
      enqueueSnackbar('Failed to load check-in history', { variant: 'error' });
      setCheckIns([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (checkIn) => {
    setSelectedCheckIn(checkIn);
    setDetailDialogOpen(true);
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({
      verificationMethod: '',
      dateFrom: '',
      dateTo: '',
      minWellnessScore: '',
    });
    setSearchTerm('');
    setPage(0);
  };

  const filteredCheckIns = checkIns.filter((checkIn) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      checkIn.patient?.name?.toLowerCase().includes(searchLower) ||
      checkIn.caregiver?.name?.toLowerCase().includes(searchLower) ||
      checkIn.patient?.patientId?.toLowerCase().includes(searchLower)
    );
  });

  if (loading && checkIns.length === 0) {
    return <LoadingSpinner message="Loading check-in history..." />;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Check-in History
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View and manage all patient check-in records
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by patient or caregiver..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Method</InputLabel>
                <Select
                  value={filters.verificationMethod}
                  label="Method"
                  onChange={(e) => handleFilterChange('verificationMethod', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="BLE">Bluetooth</MenuItem>
                  <MenuItem value="NFC">NFC</MenuItem>
                  <MenuItem value="GPS">GPS</MenuItem>
                  <MenuItem value="MANUAL">Manual</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="From Date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To Date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleClearFilters}
                startIcon={<FilterIcon />}
              >
                Clear
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Statistics Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Check-ins
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {totalRecords}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Today
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary">
                12
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                This Week
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                48
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Avg Wellness Score
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="info.main">
                82%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Check-ins Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date & Time</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Caregiver</TableCell>
                <TableCell>Verification</TableCell>
                <TableCell>Vitals</TableCell>
                <TableCell>Wellness</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCheckIns
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((checkIn) => (
                  <TableRow key={checkIn._id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">
                          {new Date(checkIn.timestamp).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(checkIn.timestamp).toLocaleTimeString()}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                          {checkIn.patient?.name?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">{checkIn.patient?.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {checkIn.patient?.patientId}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{checkIn.caregiver?.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {checkIn.caregiver?.role}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <VerificationChip method={checkIn.verificationMethod} />
                    </TableCell>
                    <TableCell>
                      {checkIn.vitals ? (
                        <Box>
                          {checkIn.vitals.heartRate && (
                            <Typography variant="caption" display="block">
                              HR: {checkIn.vitals.heartRate} bpm
                            </Typography>
                          )}
                          {checkIn.vitals.bloodPressure && (
                            <Typography variant="caption" display="block">
                              BP: {checkIn.vitals.bloodPressure?.systolic}/{checkIn.vitals.bloodPressure?.diastolic}
                            </Typography>
                          )}
                          {checkIn.vitals.bloodGlucose && (
                            <Typography variant="caption" display="block">
                              Glucose: {checkIn.vitals.bloodGlucose} mg/dL
                            </Typography>
                          )}
                          {checkIn.vitals.weight && (
                            <Typography variant="caption" display="block">
                              Weight: {checkIn.vitals.weight} kg
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Not recorded
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {checkIn.wellnessAssessment ? (
                        <WellnessIndicator score={checkIn.wellnessAssessment.overallScore} />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          N/A
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(checkIn)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalRecords}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Card>

      {/* Detail Dialog */}
      <CheckInDetailDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        checkIn={selectedCheckIn}
      />
    </Box>
  );
};

export default CheckInHistoryPage;
