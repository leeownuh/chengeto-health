import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, mkdir } from 'node:fs/promises';

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

const ensureReadable = async (filePath) => {
  await access(filePath);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const inFile = args.in ? String(args.in) : path.resolve(__dirname, '..', '..', 'docs', 'report-chengeto-final.html');
  const outFile = args.out ? String(args.out) : path.resolve(__dirname, '..', '..', 'docs', 'report-chengeto-final.pdf');
  const outDir = path.dirname(outFile);
  const headed = Boolean(args.headed);
  const channel = args.channel ? String(args.channel) : (process.env.PLAYWRIGHT_CHANNEL ? String(process.env.PLAYWRIGHT_CHANNEL) : '');

  await ensureReadable(inFile);
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

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  const url = new URL(`file://${inFile.replace(/\\/g, '/')}`);
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);

  await page.pdf({
    path: outFile,
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }
  });

  await context.close();
  await browser.close();

  console.log('Saved PDF to', outFile);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

