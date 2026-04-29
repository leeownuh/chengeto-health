import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const nowStamp = () => {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const sanitize = (value) =>
  String(value)
    .replace(/^\//, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'root';

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const copyDirRecursive = async (srcDir, destDir) => {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
      continue;
    }
    await copyFile(srcPath, destPath);
  }
};

const buildApiBaseUrl = (frontendBaseUrl, backendPort = '5000') => {
  const parsed = new URL(frontendBaseUrl);
  return `${parsed.protocol}//${parsed.hostname}:${backendPort}/api/v1`;
};

const collectPageState = async (page) => {
  return page.evaluate(() => {
    const trim = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const texts = (selector) =>
      Array.from(document.querySelectorAll(selector))
        .map((node) => trim(node.textContent))
        .filter(Boolean)
        .slice(0, 20);

    return {
      url: window.location.href,
      title: document.title,
      headings: texts('h1, h2, h3, h4'),
      alerts: texts('.MuiAlert-message, [role=\"alert\"]'),
      offlineBanner: trim(document.querySelector('.offline-banner')?.textContent || ''),
      theme: document.documentElement?.dataset?.theme || ''
    };
  });
};

const fetchJson = async (url, token, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Request failed (${response.status}) ${url}: ${body.slice(0, 200)}`);
  }

  return response.json();
};

const requestJson = async (url, method, token, body, timeoutMs = 15000) => {
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

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
};

const formatLocalISODate = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const gotoStable = async (page, url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  // networkidle can be unreliable for SPAs using websockets/polling; keep it best-effort.
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

  // Wait for fonts when available (prevents layout shifts mid-screenshot).
  await page
    .waitForFunction(() => {
      if (!document.fonts) return true;
      return document.fonts.status === 'loaded';
    }, null, { timeout: 15000 })
    .catch(() => {});

  // Wait until common loading indicators disappear (MUI + generic).
  const loadingSelectors = [
    '.MuiCircularProgress-root',
    '.MuiLinearProgress-root',
    '.MuiSkeleton-root',
    '[role="progressbar"]',
    '[aria-busy="true"]',
    '[data-loading="true"]'
  ];

  // First: give the app time to settle.
  await page.waitForTimeout(600);

  // Then: wait for "not loading" (best-effort) in the browser context.
  await page
    .waitForFunction(
      (selectors) => selectors.every((selector) => !document.querySelector(selector)),
      loadingSelectors,
      { timeout: 25000 }
    )
    .catch(() => {});

  // Finally: require stability for a short window to avoid racing late spinners.
  const stableWindowMs = 1200;
  const pollMs = 200;
  await page
    .waitForFunction(
      ({ stableWindowMs, pollMs }) => {
        const now = Date.now();
        // eslint-disable-next-line no-undef
        window.__chengetoStableSince = window.__chengetoStableSince || now;
        const loadingSelectors = [
          '.MuiCircularProgress-root',
          '.MuiLinearProgress-root',
          '.MuiSkeleton-root',
          '[role="progressbar"]',
          '[aria-busy="true"]',
          '[data-loading="true"]'
        ];
        const isLoading = loadingSelectors.some((selector) => document.querySelector(selector));
        if (isLoading) {
          // eslint-disable-next-line no-undef
          window.__chengetoStableSince = Date.now();
          return false;
        }
        // eslint-disable-next-line no-undef
        return Date.now() - window.__chengetoStableSince >= stableWindowMs;
      },
      { stableWindowMs, pollMs },
      { timeout: 15000, polling: pollMs }
    )
    .catch(() => {});

  // Small extra buffer to avoid mid-render charts/snackbars.
  await page.waitForTimeout(300);
};

const gotoClientRoute = async (page, route) => {
  await page
    .evaluate((nextRoute) => {
      window.history.pushState({}, '', nextRoute);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, route)
    .catch(() => {});

  await page.waitForTimeout(350);
  await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(250);
};

const gotoOfflineStable = async (page, url) => {
  // Prefer a hard navigation while offline so the service worker can demonstrate
  // app-shell fallback behavior (cached index.html) in a realistic way.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});

  // Give React time to mount + render (offline code paths can be slower).
  await page.waitForTimeout(900);

  // Ensure something actually rendered (avoid capturing a white page mid-reload).
  await page
    .waitForFunction(() => {
      const root = document.getElementById('root');
      if (!root) return false;
      return root.childElementCount > 0;
    }, null, { timeout: 15000 })
    .catch(() => {});

  // Reuse the main stability heuristic (spinners/skeletons) best-effort.
  const loadingSelectors = [
    '.MuiCircularProgress-root',
    '.MuiLinearProgress-root',
    '.MuiSkeleton-root',
    '[role="progressbar"]',
    '[aria-busy="true"]',
    '[data-loading="true"]'
  ];

  await page
    .waitForFunction(
      (selectors) => selectors.every((selector) => !document.querySelector(selector)),
      loadingSelectors,
      { timeout: 25000 }
    )
    .catch(() => {});

  await page.waitForTimeout(400);
};

const ensureScheduleDayView = async (page) => {
  // Schedule view toggle is a small control; we want DAY view for submission screenshots.
  const tryClick = async (locator) => {
    if ((await locator.count().catch(() => 0)) === 0) return false;
    await locator.first().click().catch(() => {});
    await page.waitForTimeout(350);
    return true;
  };

  const clicked =
    (await tryClick(page.getByRole('button', { name: /^day$/i }))) ||
    (await tryClick(page.getByRole('button', { name: /^day$/ }))) ||
    (await tryClick(page.getByText(/^day$/i)));

  if (!clicked) return;

  // Wait for any final spinners/charts to settle after view switch.
  await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(250);
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

const captureIntegrityDialog = async (page, shotPath) => {
  const verifyButton = page.getByRole('button', { name: /verify integrity/i });
  if ((await verifyButton.count().catch(() => 0)) === 0) {
    throw new Error('Verify integrity button not found');
  }

  await verifyButton.first().click();
  await page.getByText('Blockchain integrity check', { exact: true }).first().waitFor({ timeout: 20000 });
  await waitForUiIdle(page);
  await page.screenshot({ path: shotPath, fullPage: true });

  // Close the dialog(s) to keep subsequent captures stable.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
};

const trySelectMuiDevice = async (page, deviceId) => {
  if (!deviceId) return;

  const optionMatcher = new RegExp(`^${escapeRegExp(deviceId)}\\b`);
  const combobox = page.getByRole('combobox', { name: 'Device' });
  if ((await combobox.count().catch(() => 0)) === 0) return;

  await combobox.first().click().catch(() => {});
  const option = page.getByRole('option', { name: optionMatcher });
  if ((await option.count().catch(() => 0)) > 0) {
    await option.first().click().catch(() => {});
    return;
  }

  const menuItem = page.getByRole('menuitem', { name: optionMatcher });
  if ((await menuItem.count().catch(() => 0)) > 0) {
    await menuItem.first().click().catch(() => {});
  }
};

const main = async () => {
  const log = (...parts) => console.log(new Date().toISOString(), ...parts);
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args.baseUrl || 'http://127.0.0.1');
  const backendPort = String(args.backendPort || '5000');
  const password = String(args.password || process.env.DEMO_PASSWORD || 'Demo@123456');
  const todayOverrideRaw = args.today ? String(args.today) : '';
  const headed = Boolean(args.headed);
  const channel = args.channel ? String(args.channel) : (process.env.PLAYWRIGHT_CHANNEL ? String(process.env.PLAYWRIGHT_CHANNEL) : '');
  const selectedRoles = args.roles
    ? String(args.roles)
        .split(',')
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean)
    : null;
  const selectedRoutes = args.routes
    ? String(args.routes)
        .split(',')
        .map((route) => route.trim())
        .filter(Boolean)
    : null;
  const skipPublic = Boolean(args.skipPublic);
  const skipOffline = Boolean(args.skipOffline);
  const skipIot = Boolean(args.skipIot);

  const todayOverride = /^\d{4}-\d{2}-\d{2}$/.test(todayOverrideRaw) ? todayOverrideRaw : '';

  const outRoot = String(
    args.outDir ||
      path.resolve(__dirname, '..', '..', 'docs', 'ui-snapshots', nowStamp())
  );

  const { chromium } = await import('playwright');

  await mkdir(outRoot, { recursive: true });
  log('Writing snapshots to', outRoot);

  const roles = [
    { role: 'admin', email: 'admin@chengeto.health' },
    { role: 'caregiver', email: 'caregiver1@example.com' },
    { role: 'chw', email: 'chw1@chengeto.health' },
    { role: 'clinician', email: 'clinician1@chengeto.health' },
    { role: 'family', email: 'family1@example.com' }
  ].filter((entry) => (selectedRoles ? selectedRoles.includes(entry.role) : true));

  const publicRoutes = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password/demo-token'
  ];

  const protectedRoutes = (selectedRoutes || [
    '/dashboard',
    '/patients',
    '/patients/new',
    '/checkin',
    '/checkin/history',
    '/schedule',
    '/iot/simulator',
    '/alerts',
    '/settings',
    '/mfa-setup',
    '/profile'
  ]).filter((route) => (skipIot ? route !== '/iot/simulator' : true));

  const baseLaunchOptions = headed ? { headless: false } : { headless: true };
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

  const run = {
    startedAt: new Date().toISOString(),
    baseUrl,
    apiBaseUrl: buildApiBaseUrl(baseUrl, backendPort),
    outRoot,
    roles: [],
    public: []
  };

  // Public pages (logged out).
  if (!skipPublic) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    for (const route of publicRoutes) {
      const url = new URL(route, baseUrl).toString();
      log('Public', route, url);
      await gotoStable(page, url);

      const shotName = `public__${sanitize(route)}.png`;
      const shotPath = path.join(outRoot, shotName);
      await page.screenshot({ path: shotPath, fullPage: true });
      const state = await collectPageState(page);

      run.public.push({ route, url, screenshot: shotName, state });
    }

    await context.close();
  }

  for (const identity of roles) {
    log('Role start', identity.role, identity.email);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const result = {
      ...identity,
      pages: [],
      offline: []
    };

    const loginUrl = new URL('/login', baseUrl).toString();
    try {
      let loggedIn = false;
      let lastLoginError = null;

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await gotoStable(page, loginUrl);
          await page.getByLabel('Email Address').fill(identity.email);
          await page.getByLabel('Password').fill(password);
          await page.getByRole('button', { name: 'Sign In' }).click();
          await page.waitForURL('**/dashboard', { timeout: 45000 });
          loggedIn = true;
          break;
        } catch (error) {
          lastLoginError = error;
          // Small pause in case backend is warming up / restarting.
          await page.waitForTimeout(1200);
          // If login UI shows an error, reset the form by reloading and retry.
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        }
      }

      if (!loggedIn) {
        throw lastLoginError || new Error('Login failed after retries');
      }

      // Ensure the service worker is controlling the page before offline captures.
      // In most browsers SW control only applies after a navigation.
      if (process.env.NODE_ENV !== 'test') {
        const controllerReady = async () => {
          await page
            .waitForFunction(() => {
              if (!('serviceWorker' in navigator)) return true;
              return Boolean(navigator.serviceWorker.controller);
            }, null, { timeout: 15000 })
            .catch(() => {});
        };

        await controllerReady();
        const hasController = await page.evaluate(() => Boolean(navigator.serviceWorker?.controller)).catch(() => false);
        if (!hasController) {
          await page.reload({ waitUntil: 'load', timeout: 60000 }).catch(() => {});
          await controllerReady();
        }
      }
    } catch (error) {
      const shotName = `${identity.role}__login_failed.png`;
      const shotPath = path.join(outRoot, shotName);
      await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
      const state = await collectPageState(page).catch(() => ({}));
      result.loginError = String(error?.message || error);
      result.pages.push({ route: '/login', url: loginUrl, screenshot: shotName, state, error: result.loginError });
      run.roles.push(result);
      await context.close();
      continue;
    }

    const token = await page.evaluate(() => localStorage.getItem('accessToken') || '');
    const apiBaseUrl = buildApiBaseUrl(baseUrl, backendPort);

    let patientId = null;
    let alertId = null;
    let iotDeviceIdForPatient = null;
    let patientIdsForScheduling = [];
    try {
      log('Role fetch patients', identity.role);
      const patientsPayload = await fetchJson(`${apiBaseUrl}/patients?limit=3&page=1`, token);
      const patients = patientsPayload?.data?.patients || [];
      patientId = patients?.[0]?._id || null;
      patientIdsForScheduling = Array.isArray(patients)
        ? patients.map((p) => p?._id).filter(Boolean).slice(0, 3)
        : [];
    } catch {
      // ignore
    }

    // Ensure we have at least one anchored record to demonstrate integrity verification (button + dialog).
    // Only create evidence records when the run includes the relevant pages.
    if (
      identity.role === 'admin' &&
      token &&
      patientId &&
      (protectedRoutes.includes('/checkin/history') || protectedRoutes.includes('/alerts'))
    ) {
      try {
        await requestJson(`${apiBaseUrl}/checkins/manual`, 'POST', token, {
          patientId,
          wellnessScore: 7,
          notes: 'Integrity verification evidence. [integrity-evidence]',
          location: { latitude: -17.8292, longitude: 31.0534, accuracy: 15 },
          vitals: { heartRate: 72, systolic: 120, diastolic: 80, temperature: 36.8, spo2: 98 }
        }).catch(() => {});
      } catch {
        // ignore
      }

      try {
        const createdAlert = await requestJson(`${apiBaseUrl}/alerts`, 'POST', token, {
          patientId,
          type: 'manual',
          severity: 'high',
          description: 'Integrity verification evidence. [integrity-evidence]'
        }).catch(() => null);

        const createdAlertId = createdAlert?.data?._id || createdAlert?._id || null;
        if (createdAlertId) {
          alertId = createdAlertId;
        }
      } catch {
        // ignore
      }
    }
    try {
      log('Role fetch alerts', identity.role);
      const alertsPayload = await fetchJson(`${apiBaseUrl}/alerts?limit=1&page=1`, token);
      alertId = alertsPayload?.data?.alerts?.[0]?._id || null;
    } catch {
      // ignore
    }
    try {
      if (patientId) {
        log('Role fetch iot devices', identity.role);
        const devicesPayload = await fetchJson(`${apiBaseUrl}/iot/devices?limit=50&page=1`, token);
        const devices = devicesPayload?.data?.devices || [];
        const matched = devices.find((d) => String(d?.assignedPatient?._id || '') === String(patientId));
        iotDeviceIdForPatient = matched?.deviceId || devices?.[0]?.deviceId || null;
      }
    } catch {
      // ignore
    }

    const routes = [
      ...protectedRoutes,
      ...(patientId
        ? [`/patients/${patientId}`, `/patients/${patientId}/edit`, `/patients/${patientId}/vitals`]
        : []),
      ...(alertId ? [`/alerts/${alertId}`] : [])
    ];

    // Ensure Schedule page shows "today" appointments for the submission screenshots.
    // Run once as admin and mark the entries, so reruns stay deterministic.
    if (identity.role === 'admin' && token && patientIdsForScheduling.length > 0 && protectedRoutes.includes('/schedule')) {
      const todayLocal = todayOverride || formatLocalISODate(new Date());
      const seedTimes = ['08:30', '13:00', '17:30'];

      try {
        const schedulesPayload = await fetchJson(`${apiBaseUrl}/schedules?limit=250`, token);
        const schedules = schedulesPayload?.data?.schedules || schedulesPayload?.schedules || [];

        const seeded = Array.isArray(schedules)
          ? schedules.filter((s) => String(s?.notes || '').includes('[seeded]'))
          : [];

        for (const entry of seeded) {
          const id = entry?._id;
          if (!id) continue;
          await requestJson(`${apiBaseUrl}/schedules/${id}`, 'DELETE', token, null).catch(() => {});
        }

        for (let i = 0; i < Math.min(patientIdsForScheduling.length, seedTimes.length); i += 1) {
          await requestJson(`${apiBaseUrl}/schedules`, 'POST', token, {
            patientId: patientIdsForScheduling[i],
            title: 'Scheduled visit (demo)',
            date: todayLocal,
            time: seedTimes[i],
            duration: 30,
            type: 'checkin',
            recurring: false,
            notes: `Auto-populated for screenshots on ${todayLocal}. [seeded]`
          }).catch(() => {});
        }
      } catch (error) {
        log('Schedule seeding failed', String(error?.message || error));
      }
    }

    for (const route of routes) {
      const urlObj = new URL(route, baseUrl);
      if (route === '/schedule' && todayOverride) {
        urlObj.searchParams.set('date', todayOverride);
      }
      const url = urlObj.toString();
      log('Role page', identity.role, route);
      const shotName = `${identity.role}__${sanitize(route)}.png`;
      const shotPath = path.join(outRoot, shotName);
      try {
        await gotoStable(page, url);

        if (route === '/schedule') {
          await ensureScheduleDayView(page);
        }

        // IoT end-to-end demo: publish telemetry + a panic alert from the in-app simulator.
        if (route === '/iot/simulator' && ['admin', 'chw'].includes(identity.role)) {
          try {
            if (iotDeviceIdForPatient) {
              await trySelectMuiDevice(page, iotDeviceIdForPatient);
              await page.waitForTimeout(200);
            }

            await page.getByRole('button', { name: 'Connect', exact: true }).click();
            await page.getByText('MQTT Connected', { exact: true }).first().waitFor({ timeout: 20000 });

            await page.getByLabel('Send panic alert').check();
            await page.getByRole('button', { name: 'Publish once', exact: true }).click();
            await page.getByText('Nothing published yet.').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(300);
          } catch (error) {
            log('IoT demo failed', identity.role, String(error?.message || error));
          }
        }

        await page.screenshot({ path: shotPath, fullPage: true });
        const state = await collectPageState(page);
        result.pages.push({ route, url, screenshot: shotName, state });

        // Capture blockchain integrity verification dialogs for evidence screenshots.
        if (route === '/checkin/history') {
          try {
            const viewButton = page.locator('button:has(svg[data-testid="VisibilityIcon"])').first();
            if ((await viewButton.count().catch(() => 0)) > 0) {
              await viewButton.click();
              await page.getByRole('dialog').first().waitFor({ timeout: 20000 });
              await waitForUiIdle(page);

              const verifyShotName = `${identity.role}__checkin_history__integrity_verify.png`;
              const verifyShotPath = path.join(outRoot, verifyShotName);
              await captureIntegrityDialog(page, verifyShotPath);
              const verifyState = await collectPageState(page).catch(() => ({}));
              result.pages.push({
                route: '/checkin/history (integrity verify)',
                url,
                screenshot: verifyShotName,
                state: verifyState
              });
            }
          } catch (error) {
            log('Integrity capture failed', identity.role, route, String(error?.message || error));
          }
        }

        if (route.startsWith('/alerts/') && route !== '/alerts') {
          try {
            const verifyShotName = `${identity.role}__alert__integrity_verify.png`;
            const verifyShotPath = path.join(outRoot, verifyShotName);
            await captureIntegrityDialog(page, verifyShotPath);
            const verifyState = await collectPageState(page).catch(() => ({}));
            result.pages.push({
              route: `${route} (integrity verify)`,
              url,
              screenshot: verifyShotName,
              state: verifyState
            });
          } catch (error) {
            log('Integrity capture failed', identity.role, route, String(error?.message || error));
          }
        }

        // After IoT publish, capture Alerts again to show the generated panic alert in the UI.
        if (route === '/iot/simulator' && ['admin', 'chw'].includes(identity.role)) {
          const postUrl = new URL('/alerts', baseUrl).toString();
          const postShotName = `${identity.role}__alerts_after_iot.png`;
          const postShotPath = path.join(outRoot, postShotName);
          try {
            await gotoStable(page, postUrl);
            await page.waitForTimeout(500);
            await page.screenshot({ path: postShotPath, fullPage: true });
            const postState = await collectPageState(page);
            result.pages.push({ route: '/alerts (after iot)', url: postUrl, screenshot: postShotName, state: postState });
          } catch (error) {
            await page.screenshot({ path: postShotPath, fullPage: true }).catch(() => {});
            const postState = await collectPageState(page).catch(() => ({}));
            result.pages.push({ route: '/alerts (after iot)', url: postUrl, screenshot: postShotName, state: postState, error: String(error?.message || error) });
          }
        }
      } catch (error) {
        await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
        const state = await collectPageState(page).catch(() => ({}));
        result.pages.push({ route, url, screenshot: shotName, state, error: String(error?.message || error) });
      }
    }

    // Offline snapshots of core pages (proves offline-first caching + app shell).
    if (!skipOffline) {
      await context.setOffline(true);
      for (const offlineRoute of ['/checkin', '/patients', '/alerts', '/schedule']) {
        const url = new URL(offlineRoute, baseUrl).toString();
        const shotName = `${identity.role}__offline__${sanitize(offlineRoute)}.png`;
        const shotPath = path.join(outRoot, shotName);
        try {
          log('Role offline', identity.role, offlineRoute);
          await gotoOfflineStable(page, url);

          if (offlineRoute === '/schedule') {
            await ensureScheduleDayView(page);
          }

          await page.screenshot({ path: shotPath, fullPage: true });
          const state = await collectPageState(page);
          result.offline.push({ route: offlineRoute, url, screenshot: shotName, state });
        } catch (error) {
          await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
          const state = await collectPageState(page).catch(() => ({}));
          result.offline.push({ route: offlineRoute, url, screenshot: shotName, state, error: String(error?.message || error) });
        }
      }
      await context.setOffline(false);
    }

    run.roles.push(result);
    await context.close();
  }

  run.finishedAt = new Date().toISOString();

  await writeFile(path.join(outRoot, 'snapshot.json'), JSON.stringify(run, null, 2), 'utf8');

  const mdLines = [];
  mdLines.push(`# UI Snapshot`);
  mdLines.push(``);
  mdLines.push(`- Started: ${run.startedAt}`);
  mdLines.push(`- Finished: ${run.finishedAt}`);
  mdLines.push(`- Frontend: ${run.baseUrl}`);
  mdLines.push(`- API: ${run.apiBaseUrl}`);
  mdLines.push(``);
  mdLines.push(`## Public`);
  for (const entry of run.public) {
    mdLines.push(`- ${entry.route}: ${entry.screenshot}`);
  }
  mdLines.push(``);
  mdLines.push(`## Roles`);
  for (const roleEntry of run.roles) {
    mdLines.push(`### ${roleEntry.role}`);
    for (const pageEntry of roleEntry.pages) {
      mdLines.push(`- ${pageEntry.route}: ${pageEntry.screenshot}`);
    }
    for (const offlineEntry of roleEntry.offline) {
      mdLines.push(`- (offline) ${offlineEntry.route}: ${offlineEntry.screenshot}`);
    }
    mdLines.push(``);
  }

  await writeFile(path.join(outRoot, 'snapshot.md'), mdLines.join('\n'), 'utf8');

  // Keep a stable path for stakeholders (avoids hunting for the newest timestamp folder).
  const latestOutRoot = path.resolve(__dirname, '..', '..', 'docs', 'ui-snapshots', 'latest');
  await rm(latestOutRoot, { recursive: true, force: true }).catch(() => {});
  await copyDirRecursive(outRoot, latestOutRoot);
  log('Copied snapshots to', latestOutRoot);

  await browser.close();
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
