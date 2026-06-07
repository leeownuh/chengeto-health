import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    const isFlag = next === undefined || next.startsWith('--');
    args[key] = isFlag ? true : next;
    if (!isFlag) i += 1;
  }
  return args;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = (command, args, { cwd = repoRoot, env = process.env } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}\n${stdout}\n${stderr}`));
    });
  });

const waitForJson = async (url, predicate, { timeoutMs = 90000, label = url } = {}) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      const json = await response.json();
      if (predicate(json)) {
        return json;
      }
    } catch {
      // retry
    }
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for ${label}`);
};

const waitForFilePredicate = async (filePath, predicate, { timeoutMs = 90000, label = filePath } = {}) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const json = JSON.parse(raw);
      if (predicate(json)) {
        return json;
      }
    } catch {
      // retry
    }
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for ${label}`);
};

const createWebhookCaptureServer = async (outDir) => {
  const payloads = [];
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, deliveries: payloads.length }));
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('Method not allowed');
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString('utf8');
    let parsed = body;
    try {
      parsed = JSON.parse(body);
    } catch {
      // keep raw
    }

    payloads.push({
      receivedAt: new Date().toISOString(),
      headers: req.headers,
      body: parsed
    });

    await fs.writeFile(
      path.join(outDir, 'alertmanager-webhook.json'),
      JSON.stringify(payloads, null, 2),
      'utf8'
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  await new Promise((resolve) => server.listen(19093, '0.0.0.0', resolve));
  return { server, payloads };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(repoRoot, 'outputs', 'drills', `monitoring-${timestamp}`);
  await fs.mkdir(outDir, { recursive: true });

  const backendTarget = String(args.target || 'chengeto-health.onrender.com');
  const backendScheme = String(args.scheme || 'https');
  const grafanaPassword = String(args['grafana-password'] || 'admin');

  const prometheusConfigPath = path.join(outDir, 'prometheus.drill.yml');
  const rulesPath = path.join(outDir, 'alert.rules.drill.yml');
  const alertmanagerConfigPath = path.join(outDir, 'alertmanager.drill.yml');

  await fs.writeFile(
    prometheusConfigPath,
    [
      'global:',
      '  scrape_interval: 15s',
      '  evaluation_interval: 15s',
      '',
      'alerting:',
      '  alertmanagers:',
      '    - static_configs:',
      "        - targets: ['alertmanager:9093']",
      '',
      'rule_files:',
      "  - /etc/prometheus/alert.rules.yml",
      '',
      'scrape_configs:',
      "  - job_name: 'prometheus'",
      '    static_configs:',
      "      - targets: ['prometheus:9090']",
      '',
      "  - job_name: 'chengeto-backend'",
      `    scheme: ${backendScheme}`,
      "    metrics_path: '/metrics'",
      '    static_configs:',
      `      - targets: ['${backendTarget}']`
    ].join('\n'),
    'utf8'
  );

  await fs.writeFile(
    rulesPath,
    [
      'groups:',
      '  - name: chengeto.drill.rules',
      '    rules:',
      '      - alert: ChengetoBackendDown',
      '        expr: up{job="chengeto-backend"} == 0',
      '        for: 2m',
      '        labels:',
      '          severity: critical',
      '        annotations:',
      '          summary: "CHENGETO backend is down"',
      '          description: "Prometheus cannot scrape the backend /metrics endpoint."',
      '',
      '      - alert: ChengetoHigh5xxRate',
      '        expr: |',
      '          sum(rate(http_requests_total{status_code=~"5.."}[5m]))',
      '          /',
      '          sum(rate(http_requests_total[5m]))',
      '          > 0.05',
      '        for: 5m',
      '        labels:',
      '          severity: high',
      '        annotations:',
      '          summary: "High 5xx rate"',
      '          description: "More than 5% of requests are 5xx over 5 minutes."',
      '',
      '      - alert: ChengetoSyntheticDrill',
      '        expr: vector(1)',
      '        for: 0m',
      '        labels:',
      '          severity: info',
      '          drill: monitoring',
      '        annotations:',
      '          summary: "Synthetic monitoring drill alert"',
      '          description: "Used to prove Alertmanager routing during drills."'
    ].join('\n'),
    'utf8'
  );

  await fs.writeFile(
    alertmanagerConfigPath,
    [
      'route:',
      "  receiver: 'default'",
      '  group_wait: 5s',
      '  group_interval: 5s',
      '  repeat_interval: 1h',
      'receivers:',
      "  - name: 'default'",
      '    webhook_configs:',
      "      - url: 'http://host.docker.internal:19093/alerts'"
    ].join('\n'),
    'utf8'
  );

  const { server } = await createWebhookCaptureServer(outDir);
  const composeEnv = {
    ...process.env,
    PROMETHEUS_CONFIG_PATH: prometheusConfigPath,
    PROMETHEUS_RULES_PATH: rulesPath,
    ALERTMANAGER_CONFIG_PATH: alertmanagerConfigPath,
    GRAFANA_PASSWORD: grafanaPassword
  };

  try {
    await run('docker', ['compose', '--profile', 'monitoring', 'up', '-d', 'prometheus', 'alertmanager', 'grafana'], {
      cwd: repoRoot,
      env: composeEnv
    });

    const targetsJson = await waitForJson(
      'http://127.0.0.1:9090/api/v1/targets',
      (json) =>
        Array.isArray(json?.data?.activeTargets) &&
        json.data.activeTargets.some(
          (target) => target.labels?.job === 'chengeto-backend' && target.health === 'up'
        ),
      { label: 'Prometheus scrape target' }
    );

    const alertsJson = await waitForJson(
      'http://127.0.0.1:9090/api/v1/alerts',
      (json) =>
        Array.isArray(json?.data?.alerts) &&
        json.data.alerts.some((alert) => alert.labels?.alertname === 'ChengetoSyntheticDrill'),
      { label: 'Prometheus synthetic alert' }
    );

    await waitForJson(
      'http://127.0.0.1:19093/healthz',
      (json) => json?.ok === true,
      { timeoutMs: 10000, label: 'webhook receiver health' }
    );
    const webhookPayloads = await waitForFilePredicate(
      path.join(outDir, 'alertmanager-webhook.json'),
      (payloads) =>
        Array.isArray(payloads) &&
        payloads.some((payload) =>
          Array.isArray(payload.body?.alerts) &&
          payload.body.alerts.some((alert) => alert.labels?.alertname === 'ChengetoSyntheticDrill')
        ),
      { timeoutMs: 120000, label: 'Alertmanager webhook delivery' }
    );

    const alertmanagerAlerts = await waitForJson(
      'http://127.0.0.1:9093/api/v2/alerts',
      (json) =>
        Array.isArray(json) &&
        json.some((alert) => alert.labels?.alertname === 'ChengetoSyntheticDrill'),
      { timeoutMs: 60000, label: 'Alertmanager alert receipt' }
    );

    await run(
      'node',
      [
        path.join('frontend', 'scripts', 'capture-monitoring-snapshots.mjs'),
        '--prometheusUrl',
        'http://127.0.0.1:9090',
        '--grafanaUrl',
        'http://127.0.0.1:3000',
        '--grafanaUser',
        'admin',
        '--grafanaPass',
        grafanaPassword
      ],
      { cwd: repoRoot, env: composeEnv }
    );

    const report = {
      generatedAt: new Date().toISOString(),
      backendTarget,
      prometheusBackendTarget: targetsJson.data.activeTargets.find((target) => target.labels?.job === 'chengeto-backend') || null,
      syntheticAlertPresent: alertsJson.data.alerts.some((alert) => alert.labels?.alertname === 'ChengetoSyntheticDrill'),
      alertmanagerReceivedSyntheticAlert: alertmanagerAlerts.some((alert) => alert.labels?.alertname === 'ChengetoSyntheticDrill'),
      webhookDeliveries: webhookPayloads.length
    };

    await fs.writeFile(path.join(outDir, 'monitoring-drill-report.json'), JSON.stringify(report, null, 2), 'utf8');
    await fs.writeFile(
      path.join(outDir, 'monitoring-drill-report.md'),
      [
        '# CHENGETO Monitoring Drill',
        '',
        `- Generated at: ${report.generatedAt}`,
        `- Backend target: ${backendTarget}`,
        `- Prometheus scrape health: ${report.prometheusBackendTarget?.health || 'unknown'}`,
        `- Synthetic alert visible in Prometheus: ${report.syntheticAlertPresent ? 'yes' : 'no'}`,
        `- Synthetic alert visible in Alertmanager: ${report.alertmanagerReceivedSyntheticAlert ? 'yes' : 'no'}`,
        `- Webhook deliveries captured: ${report.webhookDeliveries}`,
        '',
        '## Artifacts',
        '- outputs/drills/.../prometheus.drill.yml',
        '- outputs/drills/.../alert.rules.drill.yml',
        '- outputs/drills/.../alertmanager-webhook.json',
        '- docs/ui-snapshots/latest/prometheus__targets.png',
        '- docs/ui-snapshots/latest/prometheus__alerts.png',
        '- docs/ui-snapshots/latest/grafana__dashboards.png',
        '- docs/ui-snapshots/latest/grafana__chengeto_overview.png'
      ].join('\n'),
      'utf8'
    );

    console.log(JSON.stringify({ outDir, report }, null, 2));
  } finally {
    server.close();
    await run('docker', ['compose', '--profile', 'monitoring', 'down'], {
      cwd: repoRoot,
      env: composeEnv
    }).catch(() => {});
  }
};

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
