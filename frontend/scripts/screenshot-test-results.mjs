import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const sanitize = (value) =>
  String(value)
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'output';

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const dir = args.dir ? String(args.dir) : '';
  const headed = Boolean(args.headed);
  const channel = args.channel ? String(args.channel) : (process.env.PLAYWRIGHT_CHANNEL ? String(process.env.PLAYWRIGHT_CHANNEL) : '');

  if (!dir) {
    console.error('Missing required arg: --dir <docs/test-results/timestamp>');
    process.exitCode = 1;
    return;
  }

  const absoluteDir = path.resolve(process.cwd(), dir);
  const htmlPath = path.join(absoluteDir, 'test-results.html');
  const outDir = path.join(absoluteDir, 'screenshots');
  await mkdir(outDir, { recursive: true });

  const { chromium } = await import('playwright');

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

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const url = new URL(`file://${htmlPath.replace(/\\/g, '/')}`);
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);

  const fullShot = path.join(outDir, 'test-results_full.png');
  await page.screenshot({ path: fullShot, fullPage: true });

  // Also capture per-section images by scrolling sections into view.
  const sections = await page.locator('section').count();
  for (let i = 0; i < sections; i += 1) {
    const locator = page.locator('section').nth(i);
    await locator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const title = await locator.locator('.title').textContent().catch(() => `section_${i + 1}`);
    const shot = path.join(outDir, `test-results__${String(i + 1).padStart(2, '0')}__${sanitize(title)}.png`);
    await locator.screenshot({ path: shot });
  }

  await context.close();
  await browser.close();

  console.log('Saved screenshots to', outDir);

  // Keep a stable path for stakeholders (avoids hunting for the newest timestamp folder).
  const latestOutRoot = path.resolve(__dirname, '..', '..', 'docs', 'test-results', 'latest');
  await rm(latestOutRoot, { recursive: true, force: true }).catch(() => {});
  await copyDirRecursive(absoluteDir, latestOutRoot);
  console.log('Copied test results to', latestOutRoot);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
