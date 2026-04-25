import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

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

