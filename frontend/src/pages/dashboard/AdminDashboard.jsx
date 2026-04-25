/**
 * CHENGETO Health - Admin Dashboard
 * Live operations command center for system-wide monitoring
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { keyframes } from '@emotion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle,
  CloudQueue,
  Devices,
  FiberManualRecord,
  HealthAndSafety,
  Memory,
  Notifications,
  People,
  PersonAdd,
  Refresh,
  Shield,
  TrendingUp,
  Warning,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useSocket } from '../../contexts/SocketContext';
import { api } from '../../contexts/AuthContext';

const sweep = keyframes`
  0% { transform: translateX(-35%); opacity: 0; }
  20% { opacity: 0.18; }
  50% { opacity: 0.28; }
  100% { transform: translateX(135%); opacity: 0; }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.25); opacity: 1; }
`;

const breathe = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.14); }
  50% { box-shadow: 0 0 0 14px rgba(34, 211, 238, 0); }
`;

const getTone = (theme, tone = 'info') => {
  const paletteKey = tone === 'danger'
    ? 'error'
    : tone === 'accent'
      ? 'secondary'
      : tone === 'success'
        ? 'success'
        : tone === 'warning'
          ? 'warning'
          : 'info';

  const accent = theme?.palette?.[paletteKey]?.main || theme?.palette?.primary?.main || '#2563eb';
  const glowAlpha = theme?.palette?.mode === 'dark' ? 0.34 : 0.22;

  return {
    accent,
    glow: alpha(accent, glowAlpha),
    text: theme?.palette?.[paletteKey]?.main || accent
  };
};
const getMuiTone = (tone = 'info') => {
  if (tone === 'danger') return 'error';
  if (tone === 'accent') return 'secondary';
  if (tone === 'warning') return 'warning';
  if (tone === 'success') return 'success';
  return 'info';
};

const getSeverityTone = (severity) => {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'critical' || normalized === 'error') return 'danger';
  if (normalized === 'high' || normalized === 'warning') return 'warning';
  if (normalized === 'success' || normalized === 'healthy' || normalized === 'connected') return 'success';
  if (normalized === 'moderate') return 'accent';
  return 'info';
};

const getStatusTone = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (['healthy', 'connected', 'synced', 'online', 'active'].includes(normalized)) return 'success';
  if (['warning', 'mock', 'maintenance', 'watch'].includes(normalized)) return 'warning';
  if (['error', 'critical', 'disconnected', 'offline'].includes(normalized)) return 'danger';
  return 'info';
};

const formatRelativeTime = (dateValue, now = new Date()) => {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return 'now';

  const diffSeconds = Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / 1000));
  if (diffSeconds < 10) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const toDateValue = (value, fallbackOffset = 0) => {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return new Date(Date.now() - fallbackOffset * 45000);
};

const SignalStrip = ({ value = 0, tone = 'info', bars = 16 }) => {
  const theme = useTheme();
  const clampedValue = Math.max(0, Math.min(100, Math.round(value)));
  const activeBars = Math.max(1, Math.round((clampedValue / 100) * bars));
  const toneConfig = getTone(theme, tone);

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.6, minHeight: 34 }}>
      {Array.from({ length: bars }).map((_, index) => {
        const active = index < activeBars;
        return (
          <Box
            key={`signal-${index}`}
            sx={{
              width: 5,
              borderRadius: 999,
              height: 8 + ((index % 6) * 4),
              backgroundColor: active ? toneConfig.accent : alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.14 : 0.10),
              boxShadow: active ? theme.shadows[2] : 'none',
              opacity: active ? 1 : 0.4,
              transition: 'all 180ms ease'
            }}
          />
        );
      })}
    </Box>
  );
};

const StatusChip = ({ label, tone = 'info', filled = false }) => {
  return (
    <Chip
      size="small"
      label={label}
      color={getMuiTone(tone)}
      variant={filled ? 'filled' : 'outlined'}
      sx={{
        fontWeight: 600
      }}
    />
  );
};

const CommandCard = ({ children, sx = {} }) => (
  <Card
    sx={{
      height: '100%',
      borderRadius: 2,
      ...sx
    }}
  >
    {children}
  </Card>
);

const MetricCard = ({ title, value, subtitle, tone = 'info', icon: Icon, signalValue = 0 }) => {
  const muiTone = getMuiTone(tone);

  return (
    <CommandCard sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.25 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.4 }}>
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {subtitle}
            </Typography>
          </Box>
          <Avatar
            sx={{
              bgcolor: `${muiTone}.light`,
              color: `${muiTone}.dark`
            }}
          >
            <Icon />
          </Avatar>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, signalValue))}
          color={muiTone}
          sx={{ mt: 2, height: 6, borderRadius: 999 }}
        />
      </CardContent>
    </CommandCard>
  );
};

const GlanceCard = ({ title, headline, detail, tone = 'info', actionLabel, onAction, compact = false }) => {
  return (
    <Box
      sx={{
        p: compact ? 1.5 : 2,
        borderRadius: 2,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
        minHeight: compact ? 108 : 124,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant={compact ? 'body1' : 'subtitle1'} sx={{ fontWeight: 700, mt: compact ? 0.6 : 0.8, lineHeight: 1.25 }}>
          {headline}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: compact ? 0.8 : 1, fontSize: compact ? '0.8rem' : undefined }}>
          {detail}
        </Typography>
      </Box>

      {actionLabel && onAction ? (
        <Box sx={{ mt: compact ? 1 : 1.5 }}>
          <Button size="small" variant="outlined" onClick={onAction}>
            {actionLabel}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
};

const HealthNode = ({ label, status, secondary, tone = 'info', progress = null, icon: Icon }) => {
  const muiTone = getMuiTone(tone);

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: 2,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: `${muiTone}.light`,
              color: `${muiTone}.dark`
            }}
          >
            <Icon fontSize="small" />
          </Avatar>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {secondary}
            </Typography>
          </Box>
        </Box>
        <StatusChip label={status} tone={tone} />
      </Box>

      {typeof progress === 'number' && (
        <Box sx={{ mt: 1.5 }}>
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, progress))}
            color={muiTone}
            sx={{ height: 8, borderRadius: 999 }}
          />
        </Box>
      )}
    </Box>
  );
};

const ChartCard = ({ eyebrow, title, action = null, children, sx = {} }) => (
  <CommandCard sx={{ height: '100%', ...sx }}>
    <CardContent sx={{ p: 2.5, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {eyebrow}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.4 }}>
            {title}
          </Typography>
        </Box>
        {action}
      </Box>
      {children}
    </CardContent>
  </CommandCard>
);

const OperationsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <Box
      sx={{
        px: 1.4,
        py: 1.2,
        borderRadius: 2,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper'
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'grid', gap: 0.7, mt: 0.7 }}>
        {payload.map((entry) => (
          <Box key={`${entry.dataKey}-${entry.name}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}>
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  bgcolor: entry.color || entry.fill || '#22d3ee',
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {entry.name}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {entry.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const LegendDot = ({ color, label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
    <Box
      sx={{
        width: 9,
        height: 9,
        borderRadius: '50%',
        bgcolor: color
      }}
    />
    <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.05em' }}>
      {label}
    </Typography>
  </Box>
);

const ConstellationView = ({ nodes, centerLabel, centerValue, centerTone = 'info' }) => {
  const theme = useTheme();
  const toneConfig = getTone(theme, centerTone);
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        position: 'relative',
        height: 290,
        borderRadius: 3,
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
        backgroundImage: `
          radial-gradient(circle at 25% 30%, ${alpha(theme.palette.primary.main, isDark ? 0.22 : 0.14)}, transparent 52%),
          radial-gradient(circle at 75% 60%, ${alpha(theme.palette.secondary.main, isDark ? 0.18 : 0.12)}, transparent 58%)
        `
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle, ${alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06)} 1px, transparent 1px),
            linear-gradient(${alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04)} 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px, 56px 56px, 56px 56px',
          opacity: isDark ? 0.38 : 0.26
        }}
      />

      {[18, 32, 46].map((radius) => (
        <Box
          key={radius}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: `${radius * 2}%`,
            height: `${radius * 2}%`,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: `1px solid ${alpha(theme.palette.primary.main, radius === 32 ? (isDark ? 0.24 : 0.16) : (isDark ? 0.16 : 0.10))}`
          }}
        />
      ))}

      {nodes.map((node, index) => {
        const angle = (-90 + ((360 / Math.max(nodes.length, 1)) * index)) * (Math.PI / 180);
        const left = 50 + (Math.cos(angle) * 34);
        const top = 50 + (Math.sin(angle) * 34);
        const nodeTone = getTone(theme, node.tone);
        const Icon = node.icon;

        return (
          <React.Fragment key={node.label}>
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '34%',
                height: 1,
                transformOrigin: '0 0',
                transform: `rotate(${(-90 + ((360 / Math.max(nodes.length, 1)) * index))}deg)`,
                borderTop: `1px dashed ${alpha(nodeTone.accent, 0.26)}`
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: `${left}%`,
                top: `${top}%`,
                width: 104,
                transform: 'translate(-50%, -50%)',
                px: 1.25,
                py: 1.15,
                borderRadius: 2.5,
                border: `1px solid ${alpha(nodeTone.accent, 0.18)}`,
                bgcolor: alpha(nodeTone.accent, isDark ? 0.10 : 0.06),
                boxShadow: theme.shadows[2]
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    bgcolor: alpha(nodeTone.accent, 0.12),
                    color: nodeTone.accent,
                    border: `1px solid ${alpha(nodeTone.accent, 0.22)}`
                  }}
                >
                  <Icon sx={{ fontSize: 16 }} />
                </Avatar>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.1 }}>
                    {node.label}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 800, lineHeight: 1.2 }}>
                    {node.value}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </React.Fragment>
        );
      })}

      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 126,
          height: 126,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: `1px solid ${alpha(toneConfig.accent, 0.24)}`,
          bgcolor: alpha(toneConfig.accent, isDark ? 0.10 : 0.08),
          boxShadow: theme.shadows[3],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          px: 2
        }}
      >
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {centerLabel}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1, mt: 0.4, color: 'text.primary' }}>
            {centerValue}
          </Typography>
          <Typography variant="caption" sx={{ color: toneConfig.accent, display: 'block', mt: 0.4 }}>
            live pressure
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

const buildActivityRecord = (activity, index = 0) => {
  const createdAt = toDateValue(activity?.createdAt || activity?.timestamp, index);
  const tone = activity?.type === 'alert' ? 'danger' : activity?.type === 'checkin' ? 'success' : 'accent';

  return {
    id: `activity-${activity?.type || 'event'}-${createdAt.getTime()}-${index}`,
    category: activity?.type || 'activity',
    label: activity?.type === 'checkin' ? 'Care Update' : activity?.type === 'user' ? 'Access Change' : 'Incident',
    message: activity?.message || 'Activity recorded',
    tone,
    createdAt
  };
};

const buildAlertRecord = (alert, index = 0) => {
  const createdAt = toDateValue(alert?.createdAt || alert?.timestamp, index);
  const patientName = alert?.patient?.name || [alert?.patient?.firstName, alert?.patient?.lastName].filter(Boolean).join(' ') || 'Patient';

  return {
    id: `alert-${alert?._id || alert?.id || createdAt.getTime()}-${index}`,
    category: 'alert',
    label: String(alert?.severity || 'alert').toUpperCase(),
    message: alert?.message || `${String(alert?.type || 'alert').replace(/_/g, ' ')} triggered for ${patientName}`,
    tone: getSeverityTone(alert?.severity),
    createdAt
  };
};

const buildNotificationRecord = (notification, index = 0) => ({
  id: `notification-${notification?.id || notification?._id || index}`,
  category: 'notification',
  label: 'Operator Notice',
  message: notification?.message || 'System notification received',
  tone: getSeverityTone(notification?.type),
  createdAt: toDateValue(notification?.createdAt || notification?.timestamp, index)
});

const buildTelemetryRecord = (telemetry, index = 0) => ({
  id: `telemetry-${telemetry?.id || telemetry?.patientId || index}`,
  category: 'telemetry',
  label: 'Telemetry',
  message: telemetry?.message || 'New device recording received',
  tone: 'info',
  createdAt: toDateValue(telemetry?.createdAt || telemetry?.timestamp, index)
});

const FeedRow = ({ item, now }) => {
  const isFresh = now.getTime() - item.createdAt.getTime() < 30000;

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: 2,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: isFresh ? 'action.hover' : 'background.paper'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 0.8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {item.label}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isFresh ? <StatusChip label="REC" tone={item.tone} filled /> : null}
          <Typography variant="caption" color="text.secondary">
            {formatRelativeTime(item.createdAt, now)}
          </Typography>
        </Box>
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {item.message}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {item.createdAt.toLocaleTimeString()}
      </Typography>
    </Box>
  );
};

const AdminDashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { socket, isConnected, alerts, notifications } = useSocket();

  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeAlertsList, setActiveAlertsList] = useState([]);
  const [highRiskPatients, setHighRiskPatients] = useState([]);
  const [transitionWatchlist, setTransitionWatchlist] = useState([]);
  const [deviceWatchlist, setDeviceWatchlist] = useState([]);
  const [telemetryEvents, setTelemetryEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [lastRefreshAt, setLastRefreshAt] = useState(() => new Date());
  const [manageUsersOpen, setManageUsersOpen] = useState(false);
  const [deviceRegistryOpen, setDeviceRegistryOpen] = useState(false);
  const [auditLogsOpen, setAuditLogsOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [dialogLoading, setDialogLoading] = useState(false);

  const fetchDashboardData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const overviewRes = await api.get('/dashboard/admin/overview');
      const overview = overviewRes.data || {};

      setStats(overview.stats || {});
      setHealth(overview.health || {});
      setActivities(Array.isArray(overview.activities) ? overview.activities : []);
      setUsers(Array.isArray(overview.recentUsers) ? overview.recentUsers : []);
      setActiveAlertsList(Array.isArray(overview.activeAlerts) ? overview.activeAlerts : []);
      setHighRiskPatients(Array.isArray(overview.highRiskPatients) ? overview.highRiskPatients : []);
      setTransitionWatchlist(Array.isArray(overview.transitionWatchlist) ? overview.transitionWatchlist : []);
      setDeviceWatchlist(Array.isArray(overview.deviceWatchlist) ? overview.deviceWatchlist : []);
      setLastRefreshAt(new Date());
    } catch (error) {
      console.error('Failed to fetch admin dashboard data:', error);
      enqueueSnackbar('Failed to refresh the operations deck.', { variant: 'error' });
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  useEffect(() => {
    const clock = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const autoRefresh = window.setInterval(() => {
      fetchDashboardData(false);
    }, 15000);

    return () => {
      window.clearInterval(clock);
      window.clearInterval(autoRefresh);
    };
  }, [fetchDashboardData]);

  useEffect(() => {
    const handleTelemetry = (event) => {
      const detail = event.detail || {};
      const patientLabel =
        detail?.patient?.name ||
        detail?.patientName ||
        detail?.patientId ||
        'patient device';

      setTelemetryEvents((prev) => [
        {
          id: `telemetry-${Date.now()}`,
          message: `Telemetry uplink received from ${patientLabel}`,
          createdAt: new Date(),
          patientId: detail?.patientId || null
        },
        ...prev
      ].slice(0, 10));
    };

    window.addEventListener('telemetry:update', handleTelemetry);
    return () => window.removeEventListener('telemetry:update', handleTelemetry);
  }, []);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleStatsUpdate = (newStats) => {
      setStats((prev) => ({ ...(prev || {}), ...(newStats || {}) }));
      fetchDashboardData(false);
    };

    const handleHealthUpdate = (newHealth) => {
      setHealth((prev) => ({ ...(prev || {}), ...(newHealth || {}) }));
      fetchDashboardData(false);
    };

    const handleActivityNew = (activity) => {
      setActivities((prev) => [activity, ...prev].slice(0, 12));
      setLastRefreshAt(new Date());
    };

    socket.on('stats:update', handleStatsUpdate);
    socket.on('health:update', handleHealthUpdate);
    socket.on('activity:new', handleActivityNew);

    return () => {
      socket.off('stats:update', handleStatsUpdate);
      socket.off('health:update', handleHealthUpdate);
      socket.off('activity:new', handleActivityNew);
    };
  }, [socket, fetchDashboardData]);

  const loadAllUsers = async () => {
    setDialogLoading(true);
    try {
      const response = await api.get('/users?limit=100');
      setAllUsers(response.data?.data?.users || response.data?.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      enqueueSnackbar('Failed to load users', { variant: 'error' });
    } finally {
      setDialogLoading(false);
    }
  };

  const loadDevices = async () => {
    setDialogLoading(true);
    try {
      const response = await api.get('/iot/devices?limit=50');
      setDevices(response.data?.data?.devices || []);
    } catch (error) {
      console.error('Failed to load device registry:', error);
      enqueueSnackbar('Failed to load device registry', { variant: 'error' });
    } finally {
      setDialogLoading(false);
    }
  };

  const handleAddUser = () => navigate('/register');

  const handleManageUsers = async () => {
    setManageUsersOpen(true);
    await loadAllUsers();
  };

  const handleDeviceRegistry = async () => {
    setDeviceRegistryOpen(true);
    await loadDevices();
  };

  const handleAuditLogs = () => {
    setAuditLogsOpen(true);
  };

  const handleOpenPatient = (patientId) => {
    if (patientId) {
      navigate(`/patients/${patientId}`);
    }
  };

  const handleOpenAlert = (alertId) => {
    if (alertId) {
      navigate(`/alerts/${alertId}`);
    }
  };

  const handleViewPatientDevices = (device) => {
    const patientId = device?.assignedPatient?._id;

    if (!patientId) {
      enqueueSnackbar('This device is not assigned to a patient yet.', { variant: 'info' });
      return;
    }

    setDeviceRegistryOpen(false);
    navigate(`/patients/${patientId}`);
  };

  const getUserStatus = (user) => user?.status || (user?.active ? 'active' : 'inactive');

  const getDeviceAssignment = (device) => {
    if (!device?.assignedPatient) {
      return 'Unassigned';
    }

    return `${device.assignedPatient.firstName} ${device.assignedPatient.lastName}`;
  };

  const totalDevices = health?.totalDevices ?? stats?.totalDevices ?? 0;
  const connectedDevices = health?.connectedDevices ?? stats?.connectedDevices ?? 0;
  const deviceCoverage = totalDevices > 0 ? Math.round((connectedDevices / totalDevices) * 100) : 0;
  const openAlerts = stats?.openAlerts || 0;
  const incidentTone = openAlerts >= 3 ? 'danger' : openAlerts >= 1 ? 'warning' : 'success';
  const systemLoad = Math.max(health?.cpu || 0, health?.memory || 0);
  const loadTone = systemLoad >= 80 ? 'danger' : systemLoad >= 60 ? 'warning' : 'info';
  const liveEventPressure = Math.min(100, openAlerts * 20 + telemetryEvents.length * 8 + notifications.length * 6);
  const blockchainStatus = String(health?.blockchain || 'unknown').toLowerCase();
  const blockchainTone = getStatusTone(blockchainStatus);

  const feedItems = useMemo(() => {
    const seen = new Set();
    const merged = [
      ...activities.map(buildActivityRecord),
      ...alerts.slice(0, 8).map(buildAlertRecord),
      ...notifications.slice(0, 6).map(buildNotificationRecord),
      ...telemetryEvents.map(buildTelemetryRecord),
    ]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .filter((item) => {
        const key = `${item.category}:${item.message}:${item.createdAt.getTime()}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

    return merged.slice(0, 16);
  }, [activities, alerts, notifications, telemetryEvents]);

  const filteredFeed = useMemo(() => {
    if (tabValue === 1) return feedItems.filter((item) => item.category === 'alert');
    if (tabValue === 2) return feedItems.filter((item) => item.category === 'telemetry');
    if (tabValue === 3) return feedItems.filter((item) => ['checkin', 'user', 'notification', 'activity'].includes(item.category));
    return feedItems;
  }, [feedItems, tabValue]);

  const watchItems = useMemo(() => [
    {
      label: 'Care incidents',
      value: `${openAlerts} open`,
      detail: openAlerts > 0 ? 'Escalations are still active.' : 'Incident queue is clear.',
      tone: incidentTone
    },
    {
      label: 'Device uplink',
      value: `${connectedDevices}/${totalDevices || 0}`,
      detail: `${deviceCoverage}% of tracked devices are online right now.`,
      tone: deviceCoverage < 40 ? 'warning' : 'success'
    },
    {
      label: 'Compute load',
      value: `${health?.cpu || 0}% CPU / ${health?.memory || 0}% MEM`,
      detail: systemLoad >= 70 ? 'Infrastructure is under pressure.' : 'Infrastructure load is within range.',
      tone: loadTone
    },
    {
      label: 'Blockchain ledger',
      value: blockchainStatus || 'unknown',
      detail: health?.blockchainDetails?.contractAddress
        ? `Contract ${String(health.blockchainDetails.contractAddress).slice(0, 10)}...`
        : 'No contract detail reported.',
      tone: blockchainTone
    }
  ], [
    blockchainStatus,
    blockchainTone,
    connectedDevices,
    deviceCoverage,
    health?.blockchainDetails?.contractAddress,
    health?.cpu,
    health?.memory,
    incidentTone,
    loadTone,
    openAlerts,
    systemLoad,
    totalDevices
  ]);

  const signalTimelineData = useMemo(() => {
    const stepMs = 10 * 60 * 1000;
    const bucketCount = 8;
    const timelineStart = currentTime.getTime() - ((bucketCount - 1) * stepMs);
    const buckets = Array.from({ length: bucketCount }, (_, index) => ({
      label: new Date(timelineStart + (index * stepMs)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      alerts: 0,
      telemetry: 0,
      operations: 0
    }));

    const putInBucket = (items, field) => {
      items.forEach((item, index) => {
        const timestamp = toDateValue(item?.createdAt || item?.timestamp, index).getTime();
        const relativeIndex = Math.floor((timestamp - timelineStart) / stepMs);
        const bucketIndex = Math.min(bucketCount - 1, Math.max(0, relativeIndex));
        if (bucketIndex >= 0 && bucketIndex < buckets.length) {
          buckets[bucketIndex][field] += 1;
        }
      });
    };

    putInBucket(alerts.slice(0, 20), 'alerts');
    putInBucket(telemetryEvents.slice(0, 20), 'telemetry');
    putInBucket(activities.slice(0, 20), 'operations');

    return buckets.map((bucket, index) => ({
      ...bucket,
      pressure: bucket.alerts * 3 + bucket.telemetry * 2 + bucket.operations + (index === bucketCount - 1 ? openAlerts : 0)
    }));
  }, [activities, alerts, currentTime, openAlerts, telemetryEvents]);

  const responseLaneData = useMemo(() => ([
    {
      name: 'Alerts',
      value: activeAlertsList.length,
      fill: getTone(theme, activeAlertsList.length > 0 ? 'danger' : 'success').accent
    },
    {
      name: 'Transitions',
      value: transitionWatchlist.length,
      fill: getTone(theme, transitionWatchlist.length > 0 ? 'warning' : 'success').accent
    },
    {
      name: 'High Risk',
      value: highRiskPatients.length,
      fill: getTone(theme, highRiskPatients.some((patient) => patient.riskLevel === 'critical') ? 'danger' : 'accent').accent
    },
    {
      name: 'Devices',
      value: deviceWatchlist.length,
      fill: getTone(theme, deviceWatchlist.length > 0 ? 'warning' : 'info').accent
    }
  ]), [activeAlertsList.length, deviceWatchlist.length, highRiskPatients, transitionWatchlist.length]);

  const platformPulseData = useMemo(() => ([
    {
      name: 'Uplink',
      value: deviceCoverage,
      fill: getTone(theme, deviceCoverage < 40 ? 'warning' : 'info').accent
    },
    {
      name: 'CPU',
      value: health?.cpu || 0,
      fill: getTone(theme, (health?.cpu || 0) >= 80 ? 'danger' : (health?.cpu || 0) >= 60 ? 'warning' : 'success').accent
    },
    {
      name: 'Memory',
      value: health?.memory || 0,
      fill: getTone(theme, (health?.memory || 0) >= 85 ? 'danger' : (health?.memory || 0) >= 65 ? 'warning' : 'accent').accent
    },
    {
      name: 'Ledger',
      value: blockchainStatus === 'synced' ? 100 : blockchainStatus === 'mock' ? 60 : 35,
      fill: getTone(theme, blockchainTone).accent
    }
  ]), [blockchainStatus, blockchainTone, deviceCoverage, health?.cpu, health?.memory]);

  const constellationNodes = useMemo(() => ([
    {
      label: 'Patients',
      value: stats?.activePatients || 0,
      tone: 'success',
      icon: HealthAndSafety
    },
    {
      label: 'Devices',
      value: `${connectedDevices}/${totalDevices || 0}`,
      tone: deviceCoverage < 40 ? 'warning' : 'info',
      icon: Devices
    },
    {
      label: 'Alerts',
      value: openAlerts,
      tone: incidentTone,
      icon: Warning
    },
    {
      label: 'Transitions',
      value: transitionWatchlist.length,
      tone: transitionWatchlist.length > 0 ? 'warning' : 'success',
      icon: Shield
    },
    {
      label: 'Operators',
      value: stats?.totalUsers || users.length || 0,
      tone: 'accent',
      icon: People
    },
    {
      label: 'Notifications',
      value: notifications.length,
      tone: notifications.length > 0 ? 'info' : 'success',
      icon: Notifications
    }
  ]), [
    connectedDevices,
    deviceCoverage,
    incidentTone,
    notifications.length,
    openAlerts,
    stats?.activePatients,
    stats?.totalUsers,
    totalDevices,
    transitionWatchlist.length,
    users.length
  ]);

  const situationLabel = openAlerts >= 3
    ? 'Critical Watch'
    : openAlerts >= 1 || systemLoad >= 70
      ? 'Heightened Watch'
      : 'Stable Operations';

  const topAlert = activeAlertsList[0] || null;
  const topRiskPatient = highRiskPatients[0] || null;
  const nextTransitionTask = transitionWatchlist[0] || null;
  const weakestDevice = deviceWatchlist[0] || null;

  if (loading && !stats && !health) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          p: { xs: 2, md: 3 }
        }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Admin Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor alerts, device health, transitions, and recent platform activity.
          </Typography>
        </Box>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} lg={8}>
            <ChartCard
              eyebrow="Overview"
              title="Recent activity"
              action={
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <StatusChip label={isConnected ? 'Socket Live' : 'Reconnecting'} tone={isConnected ? 'success' : 'warning'} filled />
                  <StatusChip label={situationLabel} tone={incidentTone} />
                  <StatusChip label={`Updated ${formatRelativeTime(lastRefreshAt, currentTime)}`} tone="info" />
                </Box>
              }
            >
              <Box sx={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={signalTimelineData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminAlertsArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.palette.error.main} stopOpacity={0.22} />
                        <stop offset="95%" stopColor={theme.palette.error.main} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={alpha(theme.palette.text.primary, 0.08)} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RechartsTooltip content={<OperationsTooltip />} />
                    <Area type="monotone" dataKey="alerts" name="Alerts" stroke={theme.palette.error.main} fill="url(#adminAlertsArea)" strokeWidth={2} />
                    <Line type="monotone" dataKey="telemetry" name="Telemetry" stroke={theme.palette.info.main} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="operations" name="Operations" stroke={theme.palette.success.main} strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                <LegendDot color={theme.palette.error.main} label="Alerts" />
                <LegendDot color={theme.palette.info.main} label="Telemetry" />
                <LegendDot color={theme.palette.success.main} label="Operations" />
              </Box>
            </ChartCard>
          </Grid>

          <Grid item xs={12} lg={4}>
            <CommandCard>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Priority Summary
                </Typography>

                <Box sx={{ display: 'grid', gap: 1.25 }}>
                  <GlanceCard
                    compact
                    title="Top Alert"
                    headline={topAlert ? (topAlert.patient?.name || 'Active patient alert') : 'No active alert'}
                    detail={topAlert
                      ? [String(topAlert.severity || 'alert').toUpperCase(), topAlert.message || topAlert.type].filter(Boolean).join(' | ')
                      : 'No unresolved alert right now.'}
                    tone={topAlert ? getSeverityTone(topAlert.severity) : 'success'}
                    actionLabel={topAlert ? 'Open Alert' : null}
                    onAction={topAlert ? () => handleOpenAlert(topAlert._id) : null}
                  />
                  <GlanceCard
                    compact
                    title="Highest Risk"
                    headline={topRiskPatient ? topRiskPatient.name : 'No ranked patient'}
                    detail={topRiskPatient
                      ? [`${String(topRiskPatient.riskLevel || 'low').toUpperCase()} risk`, topRiskPatient.riskScore != null ? `Score ${topRiskPatient.riskScore}` : null].filter(Boolean).join(' | ')
                      : 'No high-risk patient surfaced.'}
                    tone={topRiskPatient?.riskLevel === 'critical' ? 'danger' : topRiskPatient ? 'warning' : 'success'}
                    actionLabel={topRiskPatient ? 'Open Patient' : null}
                    onAction={topRiskPatient ? () => handleOpenPatient(topRiskPatient._id) : null}
                  />
                  <GlanceCard
                    compact
                    title="Next Transition"
                    headline={nextTransitionTask ? (nextTransitionTask.patient?.name || nextTransitionTask.title || 'Transition task') : 'No due transition'}
                    detail={nextTransitionTask
                      ? [nextTransitionTask.title, nextTransitionTask.status].filter(Boolean).join(' | ')
                      : 'No pending transition task.'}
                    tone={nextTransitionTask?.status === 'overdue' ? 'danger' : nextTransitionTask ? 'warning' : 'success'}
                    actionLabel={nextTransitionTask?.patient?._id ? 'Open Patient' : null}
                    onAction={nextTransitionTask?.patient?._id ? () => handleOpenPatient(nextTransitionTask.patient._id) : null}
                  />
                </Box>

                <Grid container spacing={1} sx={{ mt: 2 }}>
                  <Grid item xs={6}>
                    <Button fullWidth variant="contained" startIcon={<PersonAdd />} onClick={handleAddUser}>
                      Add User
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button fullWidth variant="outlined" startIcon={<Devices />} onClick={handleDeviceRegistry}>
                      Devices
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button fullWidth variant="outlined" startIcon={<People />} onClick={handleManageUsers}>
                      Users
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button fullWidth variant="outlined" startIcon={<Shield />} onClick={handleAuditLogs}>
                      Activity
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </CommandCard>
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} xl={3}>
            <MetricCard
              title="Patients Under Watch"
              value={stats?.activePatients || 0}
              subtitle="Live monitored patient load"
              tone="success"
              icon={HealthAndSafety}
              signalValue={Math.min(100, (stats?.activePatients || 0) * 12)}
            />
          </Grid>
          <Grid item xs={12} sm={6} xl={3}>
            <MetricCard
              title="Open Incidents"
              value={openAlerts}
              subtitle={openAlerts > 0 ? 'Immediate operational attention required' : 'No unresolved incidents right now'}
              tone={incidentTone}
              icon={Warning}
              signalValue={Math.min(100, openAlerts * 25)}
            />
          </Grid>
          <Grid item xs={12} sm={6} xl={3}>
            <MetricCard
              title="Device Uplink"
              value={`${connectedDevices}/${totalDevices || 0}`}
              subtitle={`${deviceCoverage}% of tracked devices are online`}
              tone={deviceCoverage < 40 ? 'warning' : 'info'}
              icon={Devices}
              signalValue={deviceCoverage}
            />
          </Grid>
          <Grid item xs={12} sm={6} xl={3}>
            <MetricCard
              title="System Load"
              value={`${systemLoad}%`}
              subtitle={`CPU ${health?.cpu || 0}% | MEM ${health?.memory || 0}%`}
              tone={loadTone}
              icon={Memory}
              signalValue={systemLoad}
            />
          </Grid>
        </Grid>

        <Grid container spacing={2.5}>
          <Grid item xs={12} xl={7}>
            <CommandCard sx={{ height: '100%' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      LIVE EVENT RECORDER
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.4 }}>
                      Operations feed
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title="Refresh now">
                      <IconButton onClick={fetchDashboardData}>
                        <Refresh />
                      </IconButton>
                    </Tooltip>
                    <StatusChip label={`${filteredFeed.length} visible`} tone="accent" />
                  </Box>
                </Box>

                <Tabs
                  value={tabValue}
                  onChange={(_, nextValue) => setTabValue(nextValue)}
                  sx={{
                    minHeight: 40,
                    mb: 2,
                    '& .MuiTabs-indicator': {
                      backgroundColor: theme.palette.primary.main,
                      height: 3,
                      borderRadius: 999
                    },
                    '& .MuiTab-root': {
                      minHeight: 40,
                      textTransform: 'none',
                      color: theme.palette.text.secondary,
                      fontWeight: 700
                    },
                    '& .Mui-selected': {
                      color: `${theme.palette.text.primary} !important`
                    }
                  }}
                >
                  <Tab label="All Signals" />
                  <Tab label="Alerts" />
                  <Tab label="Telemetry" />
                  <Tab label="Operations" />
                </Tabs>

                <Box sx={{ display: 'grid', gap: 1.2 }}>
                  {filteredFeed.map((item) => (
                    <FeedRow key={item.id} item={item} now={currentTime} />
                  ))}

                  {filteredFeed.length === 0 && (
                    <Box
                      sx={{
                        py: 6,
                        textAlign: 'center',
                        borderRadius: 3,
                        border: (theme) => `1px dashed ${theme.palette.divider}`,
                        bgcolor: 'background.paper'
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        No events in this channel yet.
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </CommandCard>
          </Grid>

          <Grid item xs={12} xl={5}>
            <Box sx={{ display: 'grid', gap: 2.5, height: '100%' }}>
              <CommandCard>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    SYSTEM MATRIX
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.4, mb: 2 }}>
                    Infrastructure readiness
                  </Typography>

                  <Box sx={{ display: 'grid', gap: 1.2 }}>
                    <HealthNode
                      label="Database"
                      status={health?.database || 'unknown'}
                      secondary={String(health?.database || '').toLowerCase() === 'healthy' ? 'Primary datastore is responding' : 'Database needs attention'}
                      tone={getStatusTone(health?.database)}
                      icon={CloudQueue}
                    />
                    <HealthNode
                      label="MQTT Broker"
                      status={health?.mqtt || 'unknown'}
                      secondary={`${connectedDevices} live devices out of ${totalDevices || 0} tracked`}
                      tone={getStatusTone(health?.mqtt)}
                      progress={deviceCoverage}
                      icon={Devices}
                    />
                    <HealthNode
                      label="Blockchain Ledger"
                      status={blockchainStatus || 'unknown'}
                      secondary={health?.blockchainDetails?.mode === 'real' ? 'Anchoring to the real chain' : 'Fallback mode requires review'}
                      tone={blockchainTone}
                      icon={Shield}
                    />
                    <HealthNode
                      label="CPU Pressure"
                      status={`${health?.cpu || 0}%`}
                      secondary="Node load across the backend container"
                      tone={health?.cpu >= 80 ? 'danger' : health?.cpu >= 60 ? 'warning' : 'info'}
                      progress={health?.cpu || 0}
                      icon={TrendingUp}
                    />
                    <HealthNode
                      label="Memory Pressure"
                      status={`${health?.memory || 0}%`}
                      secondary="Runtime memory utilization"
                      tone={health?.memory >= 85 ? 'danger' : health?.memory >= 65 ? 'warning' : 'info'}
                      progress={health?.memory || 0}
                      icon={Memory}
                    />
                  </Box>
                </CardContent>
              </CommandCard>

              <CommandCard sx={{ flexGrow: 1 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    WATCH ITEMS
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.4, mb: 2 }}>
                    What needs eyes now
                  </Typography>

                  <Box sx={{ display: 'grid', gap: 1.2 }}>
                    {watchItems.map((item) => {
                      return (
                        <Box
                          key={item.label}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                            bgcolor: 'background.paper'
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                              {item.label}
                            </Typography>
                            <StatusChip label={item.value} tone={item.tone} />
                          </Box>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {item.detail}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </CardContent>
              </CommandCard>
            </Box>
          </Grid>

          <Grid item xs={12} lg={7}>
            <CommandCard>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      CRITICAL QUEUES
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.4 }}>
                      Alerts and transition follow-up
                    </Typography>
                  </Box>
                  <Button size="small" onClick={() => navigate('/alerts')}>
                    Open alerts
                  </Button>
                </Box>

                <Box sx={{ display: 'grid', gap: 2.2 }}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Active Alerts
                      </Typography>
                      <StatusChip label={`${activeAlertsList.length} showing`} tone={activeAlertsList.length > 0 ? 'danger' : 'success'} />
                    </Box>

                    <List dense disablePadding>
                      {activeAlertsList.slice(0, 4).map((alert, index) => (
                        <React.Fragment key={alert._id}>
                          <ListItem
                            sx={{ px: 0, py: 1.2 }}
                            secondaryAction={
                              <Button size="small" variant="outlined" onClick={() => handleOpenAlert(alert._id)}>
                                Open
                              </Button>
                            }
                          >
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: `${getMuiTone(getSeverityTone(alert.severity))}.light`, color: `${getMuiTone(getSeverityTone(alert.severity))}.dark` }}>
                                <Warning fontSize="small" />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={<Typography sx={{ fontWeight: 700 }}>{alert.patient?.name || 'Patient alert'}</Typography>}
                              secondary={
                                <Typography variant="body2" color="text.secondary">
                                  {[String(alert.severity || 'alert').toUpperCase(), alert.message || alert.type, alert.patient?.patientId].filter(Boolean).join(' | ')}
                                </Typography>
                              }
                            />
                          </ListItem>
                          {index < Math.min(activeAlertsList.length, 4) - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                      {activeAlertsList.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                          No unresolved alerts right now.
                        </Typography>
                      )}
                    </List>
                  </Box>

                  <Divider />

                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Transition Watchlist
                      </Typography>
                      <StatusChip label={`${transitionWatchlist.length} queued`} tone={transitionWatchlist.length > 0 ? 'warning' : 'success'} />
                    </Box>

                    <List dense disablePadding>
                      {transitionWatchlist.slice(0, 4).map((task, index) => (
                        <React.Fragment key={`${task.transitionId}-${task.patient?._id}-${index}`}>
                          <ListItem
                            sx={{ px: 0, py: 1.2 }}
                            secondaryAction={
                              <Button size="small" variant="outlined" onClick={() => handleOpenPatient(task.patient?._id)}>
                                Open
                              </Button>
                            }
                          >
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: `${getMuiTone(task.status === 'overdue' ? 'danger' : 'warning')}.light`, color: `${getMuiTone(task.status === 'overdue' ? 'danger' : 'warning')}.dark` }}>
                                <Shield fontSize="small" />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={<Typography sx={{ fontWeight: 700 }}>{task.patient?.name || 'Transition task'}</Typography>}
                              secondary={
                                <Typography variant="body2" color="text.secondary">
                                  {[task.title, task.ownerRole, task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : null, task.status].filter(Boolean).join(' | ')}
                                </Typography>
                              }
                            />
                          </ListItem>
                          {index < Math.min(transitionWatchlist.length, 4) - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                      {transitionWatchlist.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                          No active transition tasks are waiting right now.
                        </Typography>
                      )}
                    </List>
                  </Box>
                </Box>
              </CardContent>
            </CommandCard>
          </Grid>

          <Grid item xs={12} lg={5}>
            <CommandCard sx={{ height: '100%' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="body2" color="text.secondary">
                  PRIORITY WATCH
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.4, mb: 2 }}>
                  High-risk patients and device issues
                </Typography>

                <Box sx={{ display: 'grid', gap: 2.2 }}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Highest Risk Patients
                      </Typography>
                      <StatusChip label={`${highRiskPatients.length} listed`} tone={highRiskPatients.length > 0 ? 'warning' : 'success'} />
                    </Box>

                    <List dense disablePadding>
                      {highRiskPatients.slice(0, 4).map((patient, index) => (
                        <React.Fragment key={patient._id}>
                          <ListItem
                            sx={{ px: 0, py: 1.2 }}
                            secondaryAction={
                              <Button size="small" variant="outlined" onClick={() => handleOpenPatient(patient._id)}>
                                Open
                              </Button>
                            }
                          >
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: `${getMuiTone(patient.riskLevel === 'critical' ? 'danger' : 'warning')}.light`, color: `${getMuiTone(patient.riskLevel === 'critical' ? 'danger' : 'warning')}.dark` }}>
                                <HealthAndSafety fontSize="small" />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={<Typography sx={{ fontWeight: 700 }}>{patient.name}</Typography>}
                              secondary={
                                <Typography variant="body2" color="text.secondary">
                                  {[`${String(patient.riskLevel || 'low').toUpperCase()} risk`, patient.riskScore != null ? `Score ${patient.riskScore}` : null, patient.riskSummary].filter(Boolean).join(' | ')}
                                </Typography>
                              }
                            />
                          </ListItem>
                          {index < Math.min(highRiskPatients.length, 4) - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                      {highRiskPatients.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                          No high-risk patients are being surfaced right now.
                        </Typography>
                      )}
                    </List>
                  </Box>

                  <Divider />

                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Device Watchlist
                      </Typography>
                      <StatusChip label={`${deviceWatchlist.length} issues`} tone={deviceWatchlist.length > 0 ? 'warning' : 'success'} />
                    </Box>

                    <List dense disablePadding>
                      {deviceWatchlist.slice(0, 4).map((device, index) => (
                        <React.Fragment key={device._id}>
                          <ListItem
                            sx={{ px: 0, py: 1.2 }}
                            secondaryAction={
                              device.assignedPatient?._id ? (
                                <Button size="small" variant="outlined" onClick={() => handleOpenPatient(device.assignedPatient._id)}>
                                  Open
                                </Button>
                              ) : null
                            }
                          >
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: `${getMuiTone((device.connection?.online === false || (device.power?.batteryLevel ?? 100) <= 25) ? 'warning' : 'info')}.light`, color: `${getMuiTone((device.connection?.online === false || (device.power?.batteryLevel ?? 100) <= 25) ? 'warning' : 'info')}.dark` }}>
                                <Devices fontSize="small" />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={<Typography sx={{ fontWeight: 700 }}>{device.deviceId}</Typography>}
                              secondary={
                                <Typography variant="body2" color="text.secondary">
                                  {[device.assignedPatient?.name || 'Unassigned', device.connection?.lastOnline ? `Last online ${formatRelativeTime(device.connection.lastOnline, currentTime)}` : 'No recent heartbeat', device.power?.batteryLevel != null ? `Battery ${device.power.batteryLevel}%` : null].filter(Boolean).join(' | ')}
                                </Typography>
                              }
                            />
                          </ListItem>
                          {index < Math.min(deviceWatchlist.length, 4) - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                      {deviceWatchlist.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                          No device issues need immediate attention.
                        </Typography>
                      )}
                    </List>
                  </Box>
                </Box>
              </CardContent>
            </CommandCard>
          </Grid>
        </Grid>
      </Box>

      <Dialog open={manageUsersOpen} onClose={() => setManageUsersOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Manage Users</DialogTitle>
        <DialogContent dividers>
          {dialogLoading ? (
            <LinearProgress />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Email</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allUsers.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell>{user.firstName} {user.lastName}</TableCell>
                      <TableCell>
                        <Chip size="small" label={user.role} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={getUserStatus(user)} color={getUserStatus(user) === 'active' ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                    </TableRow>
                  ))}
                  {allUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManageUsersOpen(false)}>Close</Button>
          <Button onClick={loadAllUsers} startIcon={<Refresh />}>
            Refresh
          </Button>
          <Button variant="contained" onClick={handleAddUser} startIcon={<PersonAdd />}>
            Add User
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deviceRegistryOpen} onClose={() => setDeviceRegistryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Device Registry</DialogTitle>
        <DialogContent dividers>
          {dialogLoading ? (
            <LinearProgress />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Device ID</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Assigned Patient</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device._id}>
                      <TableCell>{device.deviceId}</TableCell>
                      <TableCell>{device.deviceType}</TableCell>
                      <TableCell>
                        <Chip size="small" label={device.status} color={device.status === 'assigned' ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell>{getDeviceAssignment(device)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => handleViewPatientDevices(device)}>
                          View Patient
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {devices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No devices found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeviceRegistryOpen(false)}>Close</Button>
          <Button onClick={loadDevices} startIcon={<Refresh />}>
            Refresh
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={auditLogsOpen} onClose={() => setAuditLogsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Recent Audit Activity</DialogTitle>
        <DialogContent dividers>
          <List dense>
            {feedItems.map((item, index) => (
              <React.Fragment key={`${item.id}-${index}`}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: alpha(getTone(theme, item.tone).accent, 0.14), color: getTone(theme, item.tone).accent }}>
                      {item.category === 'alert' ? <Warning /> : item.category === 'telemetry' ? <Devices /> : item.category === 'notification' ? <Notifications /> : <CheckCircle />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={item.message} secondary={`${item.label} • ${item.createdAt.toLocaleString()}`} />
                </ListItem>
                {index < feedItems.length - 1 && <Divider component="li" variant="inset" />}
              </React.Fragment>
            ))}
            {feedItems.length === 0 && (
              <ListItem>
                <ListItemText primary="No recent activity found" />
              </ListItem>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuditLogsOpen(false)}>Close</Button>
          <Button onClick={fetchDashboardData} startIcon={<Refresh />}>
            Refresh
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdminDashboard;
