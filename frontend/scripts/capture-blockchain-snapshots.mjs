import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestJson = async (url, method, token, body, timeoutMs = 20000) => {
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

const gotoStable = async (page, url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

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

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  const baseUrl = String(args.baseUrl || 'http://127.0.0.1:80').replace(/\/+$/, '');
  const apiUrl = String(args.apiUrl || 'http://127.0.0.1:5000/api/v1').replace(/\/+$/, '');

  const email = String(args.email || 'admin@chengeto.health');
  const password = String(args.password || 'Demo@123456');

  const repoRoot = path.resolve(__dirname, '..', '..');
  const outDir = path.resolve(repoRoot, 'docs', 'ui-snapshots', 'latest');
  await mkdir(outDir, { recursive: true });

  // 1) Authenticate for API actions
  console.log('[blockchain] login api');
  const login = await requestJson(`${apiUrl}/auth/login`, 'POST', null, { email, password });
  const token = login?.data?.accessToken;
  if (!token) throw new Error('No accessToken from login');

  // 2) Pick a patient
  console.log('[blockchain] fetch patient');
  const patientsResp = await requestJson(`${apiUrl}/patients?limit=1&page=1`, 'GET', token);
  const patient = patientsResp?.data?.patients?.[0] || patientsResp?.data?.data?.patients?.[0];
  if (!patient?._id) throw new Error('No patient found (seed data missing?)');

  // 3) Create a manual check-in (records blockchain anchor on success)
  console.log('[blockchain] create checkin');
  await requestJson(`${apiUrl}/checkins/manual`, 'POST', token, {
    patientId: patient._id,
    wellnessScore: 8,
    notes: 'Evidence check-in (blockchain anchoring demo).',
    location: { latitude: -17.8292, longitude: 31.0534, accuracy: 12 },
    vitals: { heartRate: 74, systolic: 122, diastolic: 81, temperature: 36.7, spo2: 98 }
  });

  // 4) Create an alert (records blockchain anchor on success)
  console.log('[blockchain] create alert');
  const createdAlert = await requestJson(`${apiUrl}/alerts`, 'POST', token, {
    patientId: patient._id,
    type: 'panic',
    severity: 'high',
    source: 'manual',
    description: 'Evidence alert (blockchain anchoring demo).',
    manualTrigger: true
  });
  const alertId = createdAlert?.data?._id || createdAlert?.data?.alert?._id;
  if (!alertId) throw new Error('No alert id returned from /alerts create');

  // 5) Capture UI screenshots
  console.log('[blockchain] launch browser');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleMessages = [];
  page.on('console', (msg) => {
    const text = `${msg.type()}: ${msg.text()}`;
    consoleMessages.push(text);
  });
  page.on('pageerror', (err) => {
    consoleMessages.push(`pageerror: ${err?.message || String(err)}`);
  });

  // Login via UI (to ensure the screenshots reflect the app, not raw API)
  console.log('[blockchain] login ui');
  await gotoStable(page, `${baseUrl}/login`);
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 60000 }).catch(() => {});
  await gotoStable(page, `${baseUrl}/dashboard`);
  console.log('[blockchain] screenshot dashboard');
  await page.screenshot({ path: path.join(outDir, 'blockchain__admin__dashboard.png'), fullPage: true });

  // Alert detail (shows blockchainRecord)
  console.log('[blockchain] screenshot alert detail');
  await gotoStable(page, `${baseUrl}/alerts/${alertId}`);
  // Avoid capturing a blank shell if React is still mounting.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const textLen = await page.evaluate(() => (document.body?.innerText || '').trim().length).catch(() => 0);
    if (textLen > 40) break;
    await page.waitForTimeout(700);
  }
  const alertPageText = await page
    .evaluate(() => (document.body?.innerText || '').trim().slice(0, 120))
    .catch(() => '');
  console.log(`[blockchain] alert detail text preview: ${JSON.stringify(alertPageText)}`);
  if (!alertPageText) {
    const tail = consoleMessages.slice(-10);
    if (tail.length) {
      console.log(`[blockchain] console tail: ${JSON.stringify(tail)}`);
    }
  }
  await page
    .waitForFunction(() => document.body?.innerText?.includes('Blockchain Record'), null, { timeout: 20000 })
    .catch(() => {});
  await page.screenshot({ path: path.join(outDir, 'blockchain__admin__alert_detail.png'), fullPage: true });

  // Check-in detail dialog (shows blockchainHash)
  console.log('[blockchain] screenshot checkin detail');
  await gotoStable(page, `${baseUrl}/checkin/history`);
  await page
    .waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, null, { timeout: 40000 })
    .catch(() => {});
  // Click the first row's "View Details" icon button.
  await page.locator('tbody tr').first().locator('button').first().click({ timeout: 20000 });
  await page.getByText('Check-in Details').waitFor({ timeout: 20000 });
  await page
    .waitForFunction(() => document.body?.innerText?.includes('Blockchain Record'), null, { timeout: 20000 })
    .catch(() => {});
  // Scroll the dialog so the Blockchain Record section is visible in the screenshot.
  await page
    .evaluate(() => {
      const content = document.querySelector('.MuiDialogContent-root');
      if (!content) return;
      content.scrollTop = content.scrollHeight;
    })
    .catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'blockchain__admin__checkin_detail.png'), fullPage: true });

  console.log('[blockchain] done');
  await browser.close();
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
