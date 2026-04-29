import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

// -----------------------------
// Application-level metrics
// -----------------------------
export const chengetoPatientsTotal = new client.Gauge({
  name: 'chengeto_patients_total',
  help: 'Total number of patients in the system'
});

export const chengetoAlertsActive = new client.Gauge({
  name: 'chengeto_alerts_active',
  help: 'Number of active (unresolved) alerts'
});

export const chengetoCheckinsToday = new client.Gauge({
  name: 'chengeto_checkins_today',
  help: 'Number of check-ins recorded since start of day (UTC)'
});

export const chengetoDevicesTotal = new client.Gauge({
  name: 'chengeto_devices_total',
  help: 'Total number of IoT devices registered in the system'
});

export const chengetoUsersTotal = new client.Gauge({
  name: 'chengeto_users_total',
  help: 'Total number of user accounts in the system'
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10]
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

register.registerMetric(httpRequestDurationSeconds);
register.registerMetric(httpRequestsTotal);
register.registerMetric(chengetoPatientsTotal);
register.registerMetric(chengetoAlertsActive);
register.registerMetric(chengetoCheckinsToday);
register.registerMetric(chengetoDevicesTotal);
register.registerMetric(chengetoUsersTotal);

let appMetricsInterval = null;

const getUtcStartOfDay = () => {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

export const updateAppMetrics = async () => {
  // Dynamic imports avoid circular deps at module load time.
  const [{ default: Patient }, { default: Alert }, { default: CheckIn }, { default: IoTDevice }, { default: User }] =
    await Promise.all([
      import('../models/Patient.js'),
      import('../models/Alert.js'),
      import('../models/CheckIn.js'),
      import('../models/IoTDevice.js'),
      import('../models/User.js')
    ]);

  const [patients, devices, users] = await Promise.all([
    Patient.countDocuments({}),
    IoTDevice.countDocuments({}),
    User.countDocuments({})
  ]);

  const activeAlerts = await Alert.countDocuments({
    status: { $in: ['pending', 'acknowledged', 'escalated'] }
  });

  const checkinsToday = await CheckIn.countDocuments({
    createdAt: { $gte: getUtcStartOfDay() }
  });

  chengetoPatientsTotal.set(Number(patients || 0));
  chengetoDevicesTotal.set(Number(devices || 0));
  chengetoUsersTotal.set(Number(users || 0));
  chengetoAlertsActive.set(Number(activeAlerts || 0));
  chengetoCheckinsToday.set(Number(checkinsToday || 0));
};

export const initializeAppMetrics = ({ intervalMs = 30000 } = {}) => {
  if (appMetricsInterval) {
    return;
  }

  // Kick once immediately, then refresh periodically.
  updateAppMetrics().catch((error) => {
    // Avoid hard failing the API if metrics cannot be computed.
    // Still emit a visible log for ops/debugging.
    // eslint-disable-next-line no-console
    console.warn('App metrics update failed:', error?.message || String(error));
  });
  appMetricsInterval = setInterval(() => {
    updateAppMetrics().catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('App metrics update failed:', error?.message || String(error));
    });
  }, intervalMs);
  appMetricsInterval.unref?.();
};

export const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationSeconds = Number(end - start) / 1e9;

    const method = req.method;
    const statusCode = String(res.statusCode);

    // Prefer matched route when available (more stable than raw URL).
    const route =
      req.route?.path
        ? String(req.route.path)
        : req.baseUrl
          ? String(req.baseUrl)
          : 'unknown';

    httpRequestsTotal.labels(method, route, statusCode).inc();
    httpRequestDurationSeconds.labels(method, route, statusCode).observe(durationSeconds);
  });

  next();
};

export const getMetricsHandler = async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

export { register };
