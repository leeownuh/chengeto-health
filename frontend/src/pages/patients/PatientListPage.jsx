/**
 * CHENGETO Health - Patient List Page
 * Search, filter, and manage patients
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Box as MuiBox,
  Tooltip,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  Search,
  Add,
  FilterList,
  MoreVert,
  Edit,
  Delete,
  Visibility,
  GetApp,
  PersonAdd,
  Clear,
  Sort,
  ViewColumn,
  Refresh,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';

// Status options
const statusOptions = ['active', 'inactive', 'critical', 'pending'];
const careLevelOptions = ['standard', 'enhanced', 'intensive', 'palliative'];

const PatientListPage = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { api, user } = useAuth();
  const { isOnline, cacheData, getCachedData } = useOffline();

  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [usingCached, setUsingCached] = useState(false);

  // Filters and pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [careLevelFilter, setCareLevelFilter] = useState([]);
  const [orderBy, setOrderBy] = useState('lastName');
  const [order, setOrder] = useState('asc');

  // Selection
  const [selected, setSelected] = useState([]);

  // Menu states
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState(null);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      setUsingCached(false);

      const response = await api.get('/patients', {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          search: searchQuery || undefined,
          status: statusFilter.length > 0 ? statusFilter.join(',') : undefined,
          careLevel: careLevelFilter.length > 0 ? careLevelFilter.join(',') : undefined,
          sort: orderBy,
          order,
        },
      });

      const payload = response?.data?.data?.patients || response?.data?.patients || [];
      const total = response?.data?.data?.total || response?.data?.total || payload.length || 0;

      setPatients(Array.isArray(payload) ? payload : []);
      setTotalPatients(Number(total) || 0);

      if (Array.isArray(payload) && payload.length > 0) {
        await cacheData('patients', payload);
      }
    } catch (error) {
      console.error('Failed to fetch patients:', error);

      const cached = await getCachedData('patients');
      if (Array.isArray(cached) && cached.length > 0) {
        setUsingCached(true);

        const normalizedQuery = String(searchQuery || '').trim().toLowerCase();
        const filtered = cached.filter((patient) => {
          if (statusFilter.length > 0 && !statusFilter.includes(patient?.status)) return false;
          if (careLevelFilter.length > 0 && !careLevelFilter.includes(patient?.careLevel)) return false;
          if (!normalizedQuery) return true;

          const haystack = [
            patient?.firstName,
            patient?.lastName,
            patient?.fullName,
            patient?.phone,
            patient?.email,
            patient?._id
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(normalizedQuery);
        });

        const start = page * rowsPerPage;
        const pageItems = filtered.slice(start, start + rowsPerPage);
        setPatients(pageItems);
        setTotalPatients(filtered.length);
        enqueueSnackbar('Offline: showing cached patients', { variant: 'warning' });
      } else {
        enqueueSnackbar(isOnline ? 'Failed to load patients' : 'Offline: no cached patients yet', { variant: 'error' });
        setPatients([]);
        setTotalPatients(0);
      }
    } finally {
      setLoading(false);
    }
  }, [api, cacheData, careLevelFilter, enqueueSnackbar, getCachedData, isOnline, order, orderBy, page, rowsPerPage, searchQuery, statusFilter]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(0);
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelected(patients.map((p) => p._id));
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

  const handleMenuOpen = (event, patient) => {
    setAnchorEl(event.currentTarget);
    setSelectedPatient(patient);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPatient(null);
  };

  const handleFilterOpen = (event) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleViewPatient = (patient) => {
    navigate(`/patients/${patient._id}`);
    handleMenuClose();
  };

  const handleEditPatient = (patient) => {
    navigate(`/patients/${patient._id}/edit`);
    handleMenuClose();
  };

  const handleDeleteClick = (patient) => {
    setPatientToDelete(patient);
    setDeleteDialog(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    try {
      if (!isOnline) {
        enqueueSnackbar('Offline: patient deletion is unavailable', { variant: 'warning' });
        return;
      }

      await api.delete(`/patients/${patientToDelete._id}`);
      enqueueSnackbar('Patient deleted successfully', { variant: 'success' });
      fetchPatients();
    } catch (error) {
      enqueueSnackbar('Failed to delete patient', { variant: 'error' });
    } finally {
      setDeleteDialog(false);
      setPatientToDelete(null);
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/patients/export', {
        params: { ids: selected.join(',') },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'patients.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();

      enqueueSnackbar('Export successful', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Export failed', { variant: 'error' });
    }
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'critical':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getCareLevelColor = (level) => {
    switch (level) {
      case 'standard':
        return 'info';
      case 'enhanced':
        return 'warning';
      case 'intensive':
        return 'error';
      case 'palliative':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Patients
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {totalPatients} total patients
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {selected.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<GetApp />}
              onClick={handleExport}
            >
              Export ({selected.length})
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => navigate('/patients/new')}
          >
            Add Patient
          </Button>
        </Box>
      </Box>

      {usingCached && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Offline mode: showing cached patient data. Some filters or actions may be limited until you reconnect.
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by name, ID, or phone..."
                value={searchQuery}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={handleClearSearch}>
                        <Clear fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6} md={3}>
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
            <Grid item xs={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Care Level</InputLabel>
                <Select
                  multiple
                  value={careLevelFilter}
                  onChange={(e) => setCareLevelFilter(e.target.value)}
                  input={<OutlinedInput label="Care Level" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {careLevelOptions.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={fetchPatients}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < patients.length}
                    checked={patients.length > 0 && selected.length === patients.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'lastName'}
                    direction={orderBy === 'lastName' ? order : 'asc'}
                    onClick={() => handleSort('lastName')}
                  >
                    Patient
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'age'}
                    direction={orderBy === 'age' ? order : 'asc'}
                    onClick={() => handleSort('age')}
                  >
                    Demographics
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'careLevel'}
                    direction={orderBy === 'careLevel' ? order : 'asc'}
                    onClick={() => handleSort('careLevel')}
                  >
                    Care Level
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'status'}
                    direction={orderBy === 'status' ? order : 'asc'}
                    onClick={() => handleSort('status')}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell>Last Check-in</TableCell>
                <TableCell>Assigned CHW</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {patients.map((patient) => {
                const isItemSelected = isSelected(patient._id);

                return (
                  <TableRow
                    hover
                    key={patient._id}
                    selected={isItemSelected}
                    onClick={() => handleViewPatient(patient)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isItemSelected}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(patient._id);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 40, height: 40 }}>
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
                      <Typography variant="body2">
                        {patient.age || patient.dateOfBirth
                          ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} yrs`
                          : '--'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {patient.gender || '--'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={patient.careLevel || 'Standard'}
                        color={getCareLevelColor(patient.careLevel)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={patient.status || 'Active'}
                        color={getStatusColor(patient.status)}
                      />
                    </TableCell>
                    <TableCell>
                      {patient.lastCheckIn
                        ? new Date(patient.lastCheckIn).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {patient.assignedCHW ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                            {patient.assignedCHW.firstName?.[0]}
                          </Avatar>
                          <Typography variant="body2">
                            {patient.assignedCHW.firstName} {patient.assignedCHW.lastName}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Unassigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuOpen(e, patient);
                        }}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {patients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No patients found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalPatients}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Card>

      {/* Action Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={() => handleViewPatient(selectedPatient)}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleEditPatient(selectedPatient)}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleDeleteClick(selectedPatient)}>
          <ListItemIcon>
            <Delete fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Patient</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {patientToDelete?.firstName} {patientToDelete?.lastName}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button color="error" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => navigate('/patients/new')}
      >
        <Add />
      </Fab>
    </Box>
  );
};

export default PatientListPage;
