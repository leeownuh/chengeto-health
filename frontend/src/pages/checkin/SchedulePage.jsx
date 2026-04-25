import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Button,
  IconButton,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Badge,
  useTheme,
  useMediaQuery,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Menu,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Snackbar,
  CircularProgress,
  OutlinedInput,
  Checkbox,
  ListItemText as SelectListItemText,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ViewDay as DayIcon,
  ViewWeek as WeekIcon,
  ViewModule as MonthIcon,
  Today as TodayIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  Repeat as RepeatIcon,
  Notifications as NotificationIcon,
  MoreVert as MoreIcon,
  CheckCircle as CompletedIcon,
  Pending as PendingIcon,
  Cancel as CancelledIcon,
  Assignment as TaskIcon,
  Bluetooth as BluetoothIcon,
  Nfc as NfcIcon,
  GpsFixed as GpsIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { api } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';

// Schedule status configurations
const statusConfig = {
  scheduled: { color: 'primary', icon: <PendingIcon />, label: 'Scheduled' },
  completed: { color: 'success', icon: <CompletedIcon />, label: 'Completed' },
  missed: { color: 'error', icon: <CancelledIcon />, label: 'Missed' },
  cancelled: { color: 'default', icon: <CancelledIcon />, label: 'Cancelled' },
};

// Priority configurations
const priorityConfig = {
  high: { color: 'error', label: 'High Priority' },
  medium: { color: 'warning', label: 'Medium Priority' },
  low: { color: 'info', label: 'Low Priority' },
};

// Verification type configurations
const verificationTypes = [
  { value: 'BLE', label: 'Bluetooth Verification', icon: <BluetoothIcon /> },
  { value: 'NFC', label: 'NFC Tap', icon: <NfcIcon /> },
  { value: 'GPS', label: 'GPS Location', icon: <GpsIcon /> },
];

// Time slots for the day view
const timeSlots = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return `${hour}:00`;
});

// Schedule card component
const ScheduleCard = ({ schedule, onEdit, onDelete, onView }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const status = statusConfig[schedule.status] || statusConfig.scheduled;
  const priority = priorityConfig[schedule.priority] || priorityConfig.medium;

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Card
      sx={{
        mb: 1,
        borderLeft: 4,
        borderColor: `${status.color}.main`,
        cursor: 'pointer',
        '&:hover': { boxShadow: 2 },
      }}
      onClick={() => onView?.(schedule)}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {schedule.title}
              </Typography>
              <Chip
                label={priority.label}
                color={priority.color}
                size="small"
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" display="block">
              {schedule.time}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <PersonIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {schedule.patient?.name}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              icon={status.icon}
              label={status.label}
              color={status.color}
              size="small"
              variant="outlined"
            />
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleMenuOpen(e); }}>
              <MoreIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { onEdit?.(schedule); handleMenuClose(); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem onClick={() => { onDelete?.(schedule); handleMenuClose(); }}>
          <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </Card>
  );
};

// Calendar day cell component
const CalendarDayCell = ({ date, schedules, isToday, isSelected, onClick, onViewSchedule }) => {
  const day = date.getDate();
  const daySchedules = schedules.filter(
    (s) => new Date(s.date).toDateString() === date.toDateString()
  );

  return (
    <Paper
      onClick={() => onClick?.(date)}
      sx={{
        p: 1,
        minHeight: 100,
        cursor: 'pointer',
        bgcolor: isToday ? 'action.hover' : isSelected ? 'primary.light' : 'background.paper',
        border: isToday ? 2 : 1,
        borderColor: isToday ? 'primary.main' : 'divider',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Typography
        variant="body2"
        fontWeight={isToday ? 'bold' : 'normal'}
        color={isToday ? 'primary' : 'text.primary'}
        gutterBottom
      >
        {day}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {daySchedules.slice(0, 3).map((schedule, index) => (
          <Chip
            key={index}
            label={schedule.title}
            size="small"
            color={statusConfig[schedule.status]?.color || 'primary'}
            onClick={(e) => {
              e.stopPropagation();
              onViewSchedule?.(schedule);
            }}
            sx={{
              height: 20,
              fontSize: '0.65rem',
              '& .MuiChip-label': { px: 0.5 },
            }}
          />
        ))}
        {daySchedules.length > 3 && (
          <Typography variant="caption" color="text.secondary">
            +{daySchedules.length - 3} more
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

// Create/Edit Schedule Dialog
const ScheduleFormDialog = ({ open, onClose, schedule, patients, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    patientId: '',
    date: '',
    time: '09:00',
    duration: 30,
    type: 'checkin',
    verificationMethods: ['BLE'],
    priority: 'medium',
    notes: '',
    recurring: false,
    recurringPattern: 'weekly',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (schedule) {
      setFormData({
        title: schedule.title || '',
        patientId: schedule.patient?._id || schedule.patientId || '',
        date: schedule.date ? new Date(schedule.date).toISOString().split('T')[0] : '',
        time: schedule.time || '09:00',
        duration: schedule.duration || 30,
        type: schedule.type || 'checkin',
        verificationMethods: schedule.verificationMethods || ['BLE'],
        priority: schedule.priority || 'medium',
        notes: schedule.notes || '',
        recurring: schedule.recurring || false,
        recurringPattern: schedule.recurringPattern || 'weekly',
      });
    } else {
      setFormData({
        title: '',
        patientId: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        duration: 30,
        type: 'checkin',
        verificationMethods: ['BLE'],
        priority: 'medium',
        notes: '',
        recurring: false,
        recurringPattern: 'weekly',
      });
    }
  }, [schedule, open]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSave?.(formData);
      onClose();
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {schedule ? 'Edit Schedule' : 'New Schedule'}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g., Morning Check-in"
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Patient</InputLabel>
              <Select
                value={formData.patientId}
                label="Patient"
                onChange={(e) => handleChange('patientId', e.target.value)}
              >
                {patients.map((patient) => (
                  <MenuItem key={patient._id} value={patient._id}>
                    {patient.name} ({patient.patientId})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              type="date"
              label="Date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              type="time"
              label="Time"
              value={formData.time}
              onChange={(e) => handleChange('time', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth>
              <InputLabel>Duration</InputLabel>
              <Select
                value={formData.duration}
                label="Duration"
                onChange={(e) => handleChange('duration', e.target.value)}
              >
                <MenuItem value={15}>15 minutes</MenuItem>
                <MenuItem value={30}>30 minutes</MenuItem>
                <MenuItem value={45}>45 minutes</MenuItem>
                <MenuItem value={60}>1 hour</MenuItem>
                <MenuItem value={90}>1.5 hours</MenuItem>
                <MenuItem value={120}>2 hours</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                label="Type"
                onChange={(e) => handleChange('type', e.target.value)}
              >
                <MenuItem value="checkin">Check-in</MenuItem>
                <MenuItem value="medication">Medication</MenuItem>
                <MenuItem value="vitals">Vitals Check</MenuItem>
                <MenuItem value="followup">Follow-up</MenuItem>
                <MenuItem value="emergency">Emergency Visit</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Verification Methods
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Methods</InputLabel>
              <Select
                multiple
                value={formData.verificationMethods}
                onChange={(e) => handleChange('verificationMethods', e.target.value)}
                input={<OutlinedInput label="Methods" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip
                        key={value}
                        label={value}
                        size="small"
                        icon={verificationTypes.find((v) => v.value === value)?.icon}
                      />
                    ))}
                  </Box>
                )}
              >
                {verificationTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    <Checkbox checked={formData.verificationMethods.indexOf(type.value) > -1} />
                    <SelectListItemText primary={type.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                label="Priority"
                onChange={(e) => handleChange('priority', e.target.value)}
              >
                <MenuItem value="high">High Priority</MenuItem>
                <MenuItem value="medium">Medium Priority</MenuItem>
                <MenuItem value="low">Low Priority</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any additional notes..."
            />
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">Recurring:</Typography>
              <ToggleButtonGroup
                value={formData.recurring ? formData.recurringPattern : 'none'}
                exclusive
                onChange={(e, value) => {
                  if (value === 'none') {
                    handleChange('recurring', false);
                  } else {
                    handleChange('recurring', true);
                    handleChange('recurringPattern', value);
                  }
                }}
                size="small"
              >
                <ToggleButton value="none">None</ToggleButton>
                <ToggleButton value="daily">Daily</ToggleButton>
                <ToggleButton value="weekly">Weekly</ToggleButton>
                <ToggleButton value="monthly">Monthly</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.title || !formData.patientId || !formData.date}
        >
          {loading ? <CircularProgress size={24} /> : schedule ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Schedule detail dialog
const ScheduleDetailDialog = ({ open, onClose, schedule, onEdit, onDelete, onComplete }) => {
  if (!schedule) return null;

  const status = statusConfig[schedule.status] || statusConfig.scheduled;
  const priority = priorityConfig[schedule.priority] || priorityConfig.medium;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{schedule.title}</Typography>
          <Chip icon={status.icon} label={status.label} color={status.color} />
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <List>
          <ListItem>
            <ListItemIcon><PersonIcon /></ListItemIcon>
            <ListItemText
              primary="Patient"
              secondary={schedule.patient?.name || 'Unknown'}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><CalendarIcon /></ListItemIcon>
            <ListItemText
              primary="Date"
              secondary={new Date(schedule.date).toLocaleDateString()}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><TimeIcon /></ListItemIcon>
            <ListItemText
              primary="Time"
              secondary={schedule.time}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><TaskIcon /></ListItemIcon>
            <ListItemText
              primary="Type"
              secondary={schedule.type}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><NotificationIcon /></ListItemIcon>
            <ListItemText
              primary="Priority"
              secondary={priority.label}
            />
          </ListItem>
          {schedule.notes && (
            <ListItem>
              <ListItemText
                primary="Notes"
                secondary={schedule.notes}
              />
            </ListItem>
          )}
        </List>
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Verification Methods
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {schedule.verificationMethods?.map((method) => {
              const type = verificationTypes.find((v) => v.value === method);
              return (
                <Chip
                  key={method}
                  icon={type?.icon}
                  label={type?.label}
                  size="small"
                  variant="outlined"
                />
              );
            })}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        {schedule.status === 'scheduled' && (
          <Button
            variant="contained"
            color="success"
            startIcon={<CompletedIcon />}
            onClick={() => onComplete?.(schedule)}
          >
            Complete
          </Button>
        )}
        <Button startIcon={<EditIcon />} onClick={() => onEdit?.(schedule)}>
          Edit
        </Button>
        <Button
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => onDelete?.(schedule)}
        >
          Delete
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const SchedulePage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const { socket } = useSocket();
  const { isOnline, cacheData, getCachedData } = useOffline();

  const [view, setView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // Dialogs
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchSchedules();
    fetchPatients();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('schedule-created', (data) => {
        setSchedules((prev) => [...prev, data]);
        showSnackbar('New schedule created', 'success');
      });

      socket.on('schedule-updated', (data) => {
        setSchedules((prev) =>
          prev.map((s) => (s._id === data._id ? data : s))
        );
      });

      socket.on('schedule-reminder', (data) => {
        showSnackbar(`Reminder: ${data.title} in 15 minutes`, 'warning');
      });

      return () => {
        socket.off('schedule-created');
        socket.off('schedule-updated');
        socket.off('schedule-reminder');
      };
    }
  }, [socket]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/schedules');
      const payload = response.data?.data?.schedules || response.data?.schedules || [];
      setSchedules(Array.isArray(payload) ? payload : []);
      if (Array.isArray(payload) && payload.length > 0) {
        await cacheData('schedules', payload);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);

      const cached = await getCachedData('schedules');
      if (Array.isArray(cached) && cached.length > 0) {
        setSchedules(cached);
        showSnackbar('Offline: showing cached schedules', 'warning');
      } else {
        showSnackbar(isOnline ? 'Failed to load schedules' : 'Offline: no cached schedules yet', 'error');
        setSchedules([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await api.get('/patients', { params: { limit: 250 } });
      const payload = response.data?.data?.patients || response.data?.patients || [];
      setPatients(Array.isArray(payload) ? payload : []);
      if (Array.isArray(payload) && payload.length > 0) {
        await cacheData('patients', payload);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);

      const cached = await getCachedData('patients');
      if (Array.isArray(cached) && cached.length > 0) {
        setPatients(cached);
        showSnackbar('Offline: showing cached patients', 'warning');
      } else {
        showSnackbar(isOnline ? 'Failed to load patients' : 'Offline: no cached patients yet', 'error');
        setPatients([]);
      }
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSaveSchedule = async (formData) => {
    try {
      if (!isOnline) {
        showSnackbar('Offline: schedule changes will sync later (not implemented for schedules yet)', 'warning');
        throw new Error('Offline schedule edits are not supported yet.');
      }

      const response = editingSchedule
        ? await api.put(`/schedules/${editingSchedule._id}`, formData)
        : await api.post('/schedules', formData);

      const savedSchedule = response.data?.data?.schedule || response.data?.schedule || response.data;
      if (!savedSchedule?._id) {
        throw new Error('Schedule save succeeded but returned an unexpected payload.');
      }

      if (editingSchedule) {
        setSchedules((prev) => prev.map((s) => (s._id === savedSchedule._id ? savedSchedule : s)));
      } else {
        setSchedules((prev) => [...prev, savedSchedule]);
      }

      showSnackbar(editingSchedule ? 'Schedule updated' : 'Schedule created');
    } catch (error) {
      console.error('Error saving schedule:', error);
      showSnackbar(error?.response?.data?.message || 'Error saving schedule', 'error');
      throw error;
    }
  };

  const handleDeleteSchedule = async (schedule) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;

    try {
      if (!isOnline) {
        showSnackbar('Offline: deleting schedules is unavailable', 'warning');
        return;
      }
      await api.delete(`/schedules/${schedule._id}`);
      setSchedules((prev) => prev.filter((s) => s._id !== schedule._id));
      showSnackbar('Schedule deleted');
      setDetailDialogOpen(false);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      showSnackbar(error?.response?.data?.message || 'Error deleting schedule', 'error');
    }
  };

  const handleCompleteSchedule = async (schedule) => {
    try {
      if (!isOnline) {
        showSnackbar('Offline: completing schedules is unavailable', 'warning');
        return;
      }
      const response = await api.post(`/schedules/${schedule._id}/complete`, {});
      const updatedSchedule = response.data?.data?.schedule || response.data?.schedule || response.data;

      if (!updatedSchedule?._id) {
        throw new Error('Schedule completion succeeded but returned an unexpected payload.');
      }

      setSchedules((prev) => prev.map((s) => (s._id === updatedSchedule._id ? updatedSchedule : s)));
      showSnackbar('Schedule marked as complete');
      setDetailDialogOpen(false);
    } catch (error) {
      console.error('Error completing schedule:', error);
      showSnackbar(error?.response?.data?.message || 'Error completing schedule', 'error');
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setFormDialogOpen(true);
    setDetailDialogOpen(false);
  };

  const handleViewSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    setDetailDialogOpen(true);
  };

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  };

  const getDateRangeTitle = () => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } else if (view === 'week') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      return day;
    });

    return (
      <Grid container spacing={1}>
        {days.map((day) => {
          const daySchedules = schedules.filter(
            (s) => new Date(s.date).toDateString() === day.toDateString()
          );
          const isToday = day.toDateString() === new Date().toDateString();

          return (
            <Grid item xs={12} md={1.7} key={day.toISOString()}>
              <Paper
                sx={{
                  p: 1,
                  minHeight: 300,
                  bgcolor: isToday ? 'action.hover' : 'background.paper',
                  border: isToday ? 2 : 1,
                  borderColor: isToday ? 'primary.main' : 'divider',
                }}
              >
                <Box sx={{ textAlign: 'center', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight={isToday ? 'bold' : 'normal'}
                    color={isToday ? 'primary' : 'text.primary'}
                  >
                    {day.getDate()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {daySchedules.map((schedule) => (
                    <ScheduleCard
                      key={schedule._id}
                      schedule={schedule}
                      onView={handleViewSchedule}
                      onEdit={handleEditSchedule}
                      onDelete={handleDeleteSchedule}
                    />
                  ))}
                </Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  const renderMonthView = () => {
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startOfCalendar = new Date(firstDayOfMonth);
    startOfCalendar.setDate(startOfCalendar.getDate() - startOfCalendar.getDay());

    const weeks = [];
    let currentWeek = [];

    for (let i = 0; i < 42; i++) {
      const day = new Date(startOfCalendar);
      day.setDate(startOfCalendar.getDate() + i);
      currentWeek.push(day);

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
        if (day > lastDayOfMonth) break;
      }
    }

    return (
      <Box>
        {/* Day headers */}
        <Grid container spacing={1} sx={{ mb: 1 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <Grid item xs={12 / 7} key={day}>
              <Typography
                variant="subtitle2"
                align="center"
                color="text.secondary"
              >
                {day}
              </Typography>
            </Grid>
          ))}
        </Grid>

        {/* Calendar grid */}
        {weeks.map((week, weekIndex) => (
          <Grid container spacing={1} key={weekIndex} sx={{ mb: 1 }}>
            {week.map((day) => {
              const isToday = day.toDateString() === new Date().toDateString();
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();

              return (
                <Grid item xs={12 / 7} key={day.toISOString()}>
                  <CalendarDayCell
                    date={day}
                    schedules={schedules}
                    isToday={isToday}
                    isSelected={selectedDate?.toDateString() === day.toDateString()}
                    onClick={setSelectedDate}
                    onViewSchedule={handleViewSchedule}
                  />
                </Grid>
              );
            })}
          </Grid>
        ))}
      </Box>
    );
  };

  const renderDayView = () => {
    const daySchedules = schedules.filter(
      (s) => new Date(s.date).toDateString() === currentDate.toDateString()
    );

    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Schedules for {currentDate.toLocaleDateString()}
        </Typography>
        {daySchedules.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No schedules for this day
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              sx={{ mt: 2 }}
              onClick={() => {
                setEditingSchedule(null);
                setFormDialogOpen(true);
              }}
            >
              Add Schedule
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {daySchedules.map((schedule) => (
              <ScheduleCard
                key={schedule._id}
                schedule={schedule}
                onView={handleViewSchedule}
                onEdit={handleEditSchedule}
                onDelete={handleDeleteSchedule}
              />
            ))}
          </Box>
        )}
      </Paper>
    );
  };

  if (loading) {
    return <LoadingSpinner message="Loading schedules..." />;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Schedule Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage patient check-ins and care schedules
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingSchedule(null);
            setFormDialogOpen(true);
          }}
        >
          New Schedule
        </Button>
      </Box>

      {/* Calendar Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={() => navigateDate(-1)}>
                <PrevIcon />
              </IconButton>
              <Typography variant="h6" sx={{ minWidth: 250, textAlign: 'center' }}>
                {getDateRangeTitle()}
              </Typography>
              <IconButton onClick={() => navigateDate(1)}>
                <NextIcon />
              </IconButton>
              <Button
                size="small"
                startIcon={<TodayIcon />}
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </Box>
            <ToggleButtonGroup
              value={view}
              exclusive
              onChange={(e, newView) => newView && setView(newView)}
              size="small"
            >
              <ToggleButton value="day">
                <DayIcon sx={{ mr: 0.5 }} />
                Day
              </ToggleButton>
              <ToggleButton value="week">
                <WeekIcon sx={{ mr: 0.5 }} />
                Week
              </ToggleButton>
              <ToggleButton value="month">
                <MonthIcon sx={{ mr: 0.5 }} />
                Month
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Schedules
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {schedules.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Scheduled
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {schedules.filter((s) => s.status === 'scheduled').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {schedules.filter((s) => s.status === 'completed').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Missed
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="error.main">
                {schedules.filter((s) => s.status === 'missed').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Calendar View */}
      {view === 'day' && renderDayView()}
      {view === 'week' && renderWeekView()}
      {view === 'month' && renderMonthView()}

      {/* Form Dialog */}
      <ScheduleFormDialog
        open={formDialogOpen}
        onClose={() => {
          setFormDialogOpen(false);
          setEditingSchedule(null);
        }}
        schedule={editingSchedule}
        patients={patients}
        onSave={handleSaveSchedule}
      />

      {/* Detail Dialog */}
      <ScheduleDetailDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        schedule={selectedSchedule}
        onEdit={handleEditSchedule}
        onDelete={handleDeleteSchedule}
        onComplete={handleCompleteSchedule}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SchedulePage;
