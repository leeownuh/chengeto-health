import { copyFile, mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
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

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripAnsi = (value) =>
  String(value ?? '').replace(
    // eslint-disable-next-line no-control-regex
    /\u001b\[[0-9;]*m|\u001b\][^\u0007]*(?:\u0007|\u001b\\)|\u001b[PX^_].*?\u001b\\|\u001b[0-9A-ORZcf-nqry=><]/g,
    ''
  );

const stripPowerShellNativeErrorNoise = (value) => {
  const lines = String(value ?? '').split(/\r?\n/);
  const filtered = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // PowerShell "NativeCommandError" wrappers when a native process writes to stderr.
    if (/^(npm\.cmd|cmd)\s*:/.test(trimmed)) continue;
    if (/^At line:\d+/.test(trimmed)) continue;
    if (/^\+\s+/.test(trimmed)) continue;
    if (/^\s*~{2,}\s*$/.test(trimmed)) continue;
    if (/^\s*CategoryInfo\s*:/.test(trimmed)) continue;
    if (/^\s*FullyQualifiedErrorId\s*:/.test(trimmed)) continue;

    // Hide Node experimental warning boilerplate (doesn't change pass/fail).
    if (/^\(node:\d+\)\s+ExperimentalWarning:/.test(trimmed)) continue;
    if (/^\(Use `node --trace-warnings/.test(trimmed)) continue;

    filtered.push(trimmed);
  }

  // Collapse excessive empty lines.
  return filtered.join('\n').replace(/\n{4,}/g, '\n\n\n');
};

const readIfExists = async (filePath) => {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const dir = args.dir ? String(args.dir) : '';

  if (!dir) {
    console.error('Missing required arg: --dir <docs/test-results/timestamp>');
    process.exitCode = 1;
    return;
  }

  const absoluteDir = path.resolve(process.cwd(), dir);
  await mkdir(absoluteDir, { recursive: true });

  const backendPath = path.join(absoluteDir, 'backend-jest.txt');
  const frontendPath = path.join(absoluteDir, 'frontend-vitest-run.txt');
  const dockerPath = path.join(absoluteDir, 'docker-compose-ps.txt');
  const apiSmokePath = path.join(absoluteDir, 'api-smoke.txt');

  const [backendRaw, frontendRaw, dockerRaw, apiRaw] = await Promise.all([
    readIfExists(backendPath),
    readIfExists(frontendPath),
    readIfExists(dockerPath),
    readIfExists(apiSmokePath)
  ]);

  const sections = [
    { title: 'Backend (Jest)', filename: 'backend-jest.txt', body: backendRaw },
    { title: 'Frontend (Vitest)', filename: 'frontend-vitest-run.txt', body: frontendRaw },
    { title: 'Docker Compose', filename: 'docker-compose-ps.txt', body: dockerRaw },
    { title: 'API Smoke (curl)', filename: 'api-smoke.txt', body: apiRaw }
  ].filter((entry) => entry.body && entry.body.trim().length > 0);

  const stamp = new Date().toISOString();
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CHENGETO - Test Results</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #0b1020;
        --panel: rgba(255,255,255,0.06);
        --panel2: rgba(255,255,255,0.085);
        --text: rgba(255,255,255,0.92);
        --muted: rgba(255,255,255,0.65);
        --border: rgba(255,255,255,0.12);
        --ok: #43f08c;
        --warn: #ffd166;
        --bad: #ff5c7a;
        --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      }
      html, body { height: 100%; }
      body {
        margin: 0;
        font-family: var(--sans);
        background: radial-gradient(1200px 700px at 20% 0%, #15203b 0%, var(--bg) 50%, #070a14 100%);
        color: var(--text);
      }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 20px 60px; }
      header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 18px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: linear-gradient(180deg, var(--panel2), var(--panel));
        backdrop-filter: blur(10px);
      }
      h1 { margin: 0; font-size: 20px; letter-spacing: 0.2px; }
      .meta { font-size: 12px; color: var(--muted); }
      .grid { display: grid; grid-template-columns: 1fr; gap: 14px; margin-top: 14px; }
      section {
        border: 1px solid var(--border);
        border-radius: 14px;
        background: linear-gradient(180deg, var(--panel2), var(--panel));
        overflow: hidden;
      }
      .sectionHead {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--border);
      }
      .title { font-weight: 650; font-size: 14px; }
      .file { font-size: 12px; color: var(--muted); font-family: var(--mono); }
      pre {
        margin: 0;
        padding: 14px 14px 16px;
        font-family: var(--mono);
        font-size: 12px;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .hint { margin-top: 10px; font-size: 12px; color: var(--muted); }
      .pillRow { display:flex; gap:8px; align-items:center; }
      .pill {
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
        font-size: 12px;
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <div>
          <h1>CHENGETO - Software Testing Results</h1>
          <div class="meta">Generated: ${escapeHtml(stamp)} · Source dir: ${escapeHtml(dir)}</div>
        </div>
        <div class="pillRow">
          <div class="pill">${escapeHtml(sections.length)} sections</div>
        </div>
      </header>
      <div class="grid">
        ${sections
          .map((entry) => {
            const cleaned = stripPowerShellNativeErrorNoise(stripAnsi(entry.body));
            return `<section>
              <div class="sectionHead">
                <div class="title">${escapeHtml(entry.title)}</div>
                <div class="file">${escapeHtml(entry.filename)}</div>
              </div>
              <pre>${escapeHtml(cleaned)}</pre>
            </section>`;
          })
          .join('\n')}
      </div>
      <div class="hint">Tip: If you need PNGs, run the companion screenshot script: <span style="font-family: var(--mono);">node frontend/scripts/screenshot-test-results.mjs --dir ${escapeHtml(dir)}</span></div>
    </div>
  </body>
</html>`;

  await writeFile(path.join(absoluteDir, 'test-results.html'), html, 'utf8');
  await writeFile(
    path.join(absoluteDir, 'test-results.md'),
    `# Software Testing Results\n\n- Generated: ${stamp}\n- Source dir: \`${dir}\`\n- HTML: \`test-results.html\`\n- Screenshots: generated by \`frontend/scripts/screenshot-test-results.mjs\`\n`,
    'utf8'
  );

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
