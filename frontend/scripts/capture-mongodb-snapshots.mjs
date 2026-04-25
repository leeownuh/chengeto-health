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

const gotoStable = async (page, url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await sleep(500);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  const dbUrl = String(args.dbUrl || 'http://127.0.0.1:8081').replace(/\/+$/, '');
  const username = String(args.user || 'admin');
  const password = String(args.pass || 'chengeto_admin');
  const dbName = String(args.db || 'chengeto_health');

  const repoRoot = path.resolve(__dirname, '..', '..');
  const outDir = path.resolve(repoRoot, 'docs', 'ui-snapshots', 'latest');
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    httpCredentials: { username, password }
  });

  const page = await context.newPage();

  const shots = [
    { name: 'db__mongo_express__home.png', url: `${dbUrl}/` },
    { name: 'db__mongo_express__db_overview.png', url: `${dbUrl}/db/${dbName}/` },
    { name: 'db__mongo_express__patients.png', url: `${dbUrl}/db/${dbName}/patients` },
    { name: 'db__mongo_express__alerts.png', url: `${dbUrl}/db/${dbName}/alerts` },
    { name: 'db__mongo_express__checkins.png', url: `${dbUrl}/db/${dbName}/checkins` }
  ];

  for (const shot of shots) {
    await gotoStable(page, shot.url);
    // Ensure the main content exists (avoids capturing blank pages if auth fails).
    await page
      .waitForFunction(() => document.body && document.body.innerText.length > 50, null, { timeout: 15000 })
      .catch(() => {});
    await page.screenshot({ path: path.join(outDir, shot.name), fullPage: true });
  }

  await browser.close();
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});

