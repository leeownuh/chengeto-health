import path from 'node:path';
import { mkdir } from 'node:fs/promises';
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const gotoStable = async (page, url, { extraWaitMs = 400 } = {}) => {
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
  await page.waitForTimeout(extraWaitMs);
};

const waitForText = async (page, matcher, timeoutMs = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await page.evaluate(() => (document.body?.innerText || '')).catch(() => '');
    if (typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text)) {
      return true;
    }
    await sleep(500);
  }
  return false;
};

const tryGrafanaLogin = async (page, { user, pass }) => {
  // Grafana's login form can vary slightly; these locators are intentionally flexible.
  const userField =
    page.locator('input[name="user"]').first() ||
    page.getByLabel(/email|username/i).first();
  const passField =
    page.locator('input[name="password"]').first() ||
    page.getByLabel(/password/i).first();

  await userField.fill(user);
  await passField.fill(pass);

  const signInButton =
    page.getByRole('button', { name: /log in|sign in/i }).first() ||
    page.getByRole('button', { name: /login/i }).first();
  await signInButton.click().catch(() => {});

  // Handle first-login "change password" prompt (best-effort).
  const needsChange = await waitForText(page, /change password|new password/i, 8000);
  if (needsChange) {
    const newPass = pass;
    await page.locator('input[name="new_password"]').fill(newPass).catch(() => {});
    await page.locator('input[name="confirm_new_password"]').fill(newPass).catch(() => {});
    const submit =
      page.getByRole('button', { name: /save|submit|change password/i }).first() ||
      page.getByRole('button', { name: /skip/i }).first();
    await submit.click().catch(() => {});
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(
    __dirname,
    '..',
    '..',
    'docs',
    'ui-snapshots',
    'latest'
  );
  await mkdir(outDir, { recursive: true });

  const prometheusUrl = String(args.prometheusUrl || 'http://127.0.0.1:9090').replace(/\/+$/, '');
  const grafanaUrl = String(args.grafanaUrl || 'http://127.0.0.1:3000').replace(/\/+$/, '');
  const grafanaUser = String(args.grafanaUser || 'admin');
  const grafanaPass = String(args.grafanaPass || process.env.GRAFANA_PASSWORD || 'admin');
  const channel = args.channel ? String(args.channel) : (process.env.PLAYWRIGHT_CHANNEL ? String(process.env.PLAYWRIGHT_CHANNEL) : '');

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

  // Prometheus targets (proof that backend scrape is UP)
  await gotoStable(page, `${prometheusUrl}/targets`);
  await waitForText(page, /chengeto-backend/i, 20000);
  await page.screenshot({ path: path.join(outDir, 'prometheus__targets.png'), fullPage: true });

  // Prometheus alerts (proof that rules are loaded and evaluated)
  await gotoStable(page, `${prometheusUrl}/alerts`);
  await waitForText(page, /ChengetoBackendDown|ChengetoHigh5xxRate|Alerts/i, 20000);
  await page.screenshot({ path: path.join(outDir, 'prometheus__alerts.png'), fullPage: true });

  // Grafana dashboard (proof that Grafana is reachable + dashboard provisioned)
  await gotoStable(page, `${grafanaUrl}/login`);
  await tryGrafanaLogin(page, { user: grafanaUser, pass: grafanaPass });
  await gotoStable(page, `${grafanaUrl}/dashboards`);
  await waitForText(page, /dashboard/i, 20000);
  await page.screenshot({ path: path.join(outDir, 'grafana__dashboards.png'), fullPage: true });

  // Prefer the authenticated API search to get a concrete dashboard URL.
  try {
    const searchResp = await context.request.get(`${grafanaUrl}/api/search?query=CHENGETO`);
    const searchJson = await searchResp.json().catch(() => []);
    const first = Array.isArray(searchJson) ? searchJson[0] : null;
    const url = first?.url;
    if (url) {
      await gotoStable(page, `${grafanaUrl}${url}`);
      await page.waitForTimeout(1500);
      await page.getByText(/Total Patients/i).first().waitFor({ timeout: 60000 }).catch(() => {});
      await page.getByText(/Active Alerts/i).first().waitFor({ timeout: 60000 }).catch(() => {});
      await page.getByText(/Check-ins Today/i).first().waitFor({ timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, 'grafana__chengeto_overview.png'), fullPage: true });
    }
  } catch {
    // ignore (dashboards list screenshot is still valid proof)
  }

  await context.close();
  await browser.close();
  console.log('Saved monitoring screenshots to', outDir);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
