import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

console.log(new Date().toISOString(), 'capture-integrity-snapshots starting');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parseArgs = (argv) => {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) continue;

    const key = value.slice(2);
    const next = argv[i + 1];
    const isFlag = next === undefined || next.startsWith('--');
    args[key] = isFlag ? true : next;
    if (!isFlag) i += 1;
  }

  return args;
};

const buildApiBaseUrl = (frontendBaseUrl, backendPort = '5000') => {
  const parsed = new URL(frontendBaseUrl);
  return `${parsed.protocol}//${parsed.hostname}:${backendPort}/api/v1`;
};

const gotoStable = async (page, url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

  await page
    .waitForFunction(() => {
      if (!document.fonts) return true;
      return document.fonts.status === 'loaded';
    }, null, { timeout: 15000 })
    .catch(() => {});

  const loadingSelectors = [
    '.MuiCircularProgress-root',
    '.MuiLinearProgress-root',
    '.MuiSkeleton-root',
    '[role="progressbar"]',
    '[aria-busy="true"]',
    '[data-loading="true"]'
  ];

  await page.waitForTimeout(600);
  await page
    .waitForFunction(
      (selectors) => selectors.every((selector) => !document.querySelector(selector)),
      loadingSelectors,
      { timeout: 25000 }
    )
    .catch(() => {});
  await page.waitForTimeout(300);
};

const waitForUiIdle = async (page) => {
  const loadingSelectors = [
    '.MuiCircularProgress-root',
    '.MuiLinearProgress-root',
    '.MuiSkeleton-root',
    '[role="progressbar"]',
    '[aria-busy="true"]',
    '[data-loading="true"]'
  ];

  await page.waitForTimeout(300);
  await page
    .waitForFunction(
      (selectors) => selectors.every((selector) => !document.querySelector(selector)),
      loadingSelectors,
      { timeout: 20000 }
    )
    .catch(() => {});
  await page.waitForTimeout(200);
};

const fetchJson = async (url, method = 'GET', token, body, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Request failed (${response.status}) ${method} ${url}: ${text.slice(0, 200)}`);
  }

  return response.json();
};

const captureIntegrityDialog = async (page, outPath) => {
  const verifyButton = page.getByRole('button', { name: /verify integrity/i });
  await verifyButton.first().click();
  await page.getByText('Blockchain integrity check', { exact: true }).first().waitFor({ timeout: 20000 });
  await waitForUiIdle(page);
  await page.screenshot({ path: outPath, fullPage: true });
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
};

const main = async () => {
  const log = (...parts) => console.log(new Date().toISOString(), ...parts);
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args.baseUrl || 'http://127.0.0.1:80');
  const backendPort = String(args.backendPort || '5000');
  const password = String(args.password || process.env.DEMO_PASSWORD || 'Demo@123456');
  const channel = args.channel ? String(args.channel) : (process.env.PLAYWRIGHT_CHANNEL ? String(process.env.PLAYWRIGHT_CHANNEL) : '');
  const outDir = String(
    args.outDir || path.resolve(__dirname, '..', '..', 'docs', 'ui-snapshots', 'latest')
  );

  await mkdir(outDir, { recursive: true });

  const apiBaseUrl = buildApiBaseUrl(baseUrl, backendPort);
  log('API login', apiBaseUrl);
  const login = await fetchJson(
    `${apiBaseUrl}/auth/login`,
    'POST',
    null,
    { email: 'admin@chengeto.health', password }
  );
  const token = login?.data?.accessToken;
  if (!token) {
    throw new Error('Failed to obtain access token for admin.');
  }

  log('Fetch patient');
  const patientsPayload = await fetchJson(`${apiBaseUrl}/patients?limit=1&page=1`, 'GET', token);
  const patientId = patientsPayload?.data?.patients?.[0]?._id;
  if (!patientId) {
    throw new Error('No patient found to generate integrity evidence.');
  }

  log('Create check-in');
  const checkIn = await fetchJson(
    `${apiBaseUrl}/checkins/manual`,
    'POST',
    token,
    { patientId, wellnessScore: 7, notes: 'Integrity verification evidence.' }
  );
  const checkInId = checkIn?.data?._id;

  log('Create alert');
  const alert = await fetchJson(
    `${apiBaseUrl}/alerts`,
    'POST',
    token,
    { patientId, type: 'manual', severity: 'high', description: 'Integrity verification evidence.' }
  );
  const alertId = alert?.data?._id;

  log('Launch Playwright');
  const { chromium } = await import('playwright');
  const baseLaunchOptions = { headless: true };
  const requestedLaunchOptions = channel ? { ...baseLaunchOptions, channel } : baseLaunchOptions;

  let browser;
  try {
    browser = await chromium.launch(requestedLaunchOptions);
  } catch (error) {
    if (!channel && process.platform === 'win32') {
      browser = await chromium.launch({ ...baseLaunchOptions, channel: 'msedge' });
    } else {
      throw error;
    }
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login through UI for screenshots.
  log('UI login');
  await gotoStable(page, new URL('/login', baseUrl).toString());
  await page.getByLabel('Email Address').fill('admin@chengeto.health');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/dashboard', { timeout: 45000 });

  if (alertId) {
    log('Capture alert integrity', alertId);
    const alertUrl = new URL(`/alerts/${alertId}`, baseUrl).toString();
    await gotoStable(page, alertUrl);
    const outPath = path.join(outDir, 'admin__alert__integrity_verify.png');
    await captureIntegrityDialog(page, outPath);
  }

  // Capture check-in integrity from history dialog.
  log('Capture check-in integrity');
  await gotoStable(page, new URL('/checkin/history', baseUrl).toString());
  await waitForUiIdle(page);
  const viewButton = page.locator('button:has(svg[data-testid="VisibilityIcon"])').first();
  await viewButton.click();
  await page.getByRole('dialog').first().waitFor({ timeout: 20000 });
  await waitForUiIdle(page);
  const checkinOutPath = path.join(outDir, 'admin__checkin_history__integrity_verify.png');
  await captureIntegrityDialog(page, checkinOutPath);

  log('Done');
  await context.close();
  await browser.close();

  // Keep the API-created ids around for linking in reports if needed.
  if (args.printIds) {
    console.log(JSON.stringify({ alertId, checkInId, patientId }, null, 2));
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
