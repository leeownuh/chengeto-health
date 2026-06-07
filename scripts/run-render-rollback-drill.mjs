import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
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

const getRenderToken = () => {
  if (process.env.RENDER_API_KEY) {
    return process.env.RENDER_API_KEY;
  }

  const tokenPath = path.join(process.env.TEMP || '', 'render-key.txt');
  if (fs.existsSync(tokenPath)) {
    return fs.readFileSync(tokenPath, 'utf8').trim();
  }

  throw new Error('Missing Render API key. Set RENDER_API_KEY or provide %TEMP%\\render-key.txt.');
};

const request = async (url, { method = 'GET', body } = {}) => {
  const token = getRenderToken();
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'codex'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(`${method} ${url} failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
};

const waitForDeploy = async (serviceId, deployId) => {
  while (true) {
    const data = await request(`https://api.render.com/v1/services/${serviceId}/deploys/${deployId}`);
    const status = data.deploy?.status || data.status;
    if (!['created', 'queued', 'build_in_progress', 'update_in_progress', 'pre_deploy_in_progress'].includes(status)) {
      return data;
    }
    await sleep(10000);
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const serviceId = String(args['service-id'] || 'srv-d7p2eh8sfn5c73bgiu80');
  const healthUrl = String(args['health-url'] || 'https://chengeto-health.onrender.com/health');
  const outputDir = path.resolve(
    args['out-dir'] ||
    path.join(repoRoot, 'outputs', 'drills', `rollback-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  );
  await fsp.mkdir(outputDir, { recursive: true });

  const deploys = await request(`https://api.render.com/v1/services/${serviceId}/deploys?limit=5`);
  const liveDeploy = deploys.find((entry) => entry.deploy?.status === 'live');
  const rollbackTarget = deploys.find((entry) => entry.deploy?.status === 'deactivated');

  if (!liveDeploy?.deploy?.id || !rollbackTarget?.deploy?.id) {
    throw new Error('Unable to identify a live deploy and rollback target.');
  }

  const startedAt = new Date().toISOString();
  const rollbackDeploy = await request(`https://api.render.com/v1/services/${serviceId}/rollback`, {
    method: 'POST',
    body: {
      deployId: rollbackTarget.deploy.id
    }
  });

  const rollbackResult = await waitForDeploy(serviceId, rollbackDeploy.id || rollbackDeploy.deploy?.id);
  const rollbackHealth = await fetch(healthUrl);

  const forwardDeploy = await request(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    method: 'POST',
    body: {
      commitId: liveDeploy.deploy.commit.id,
      clearCache: 'do_not_clear'
    }
  });

  const forwardResult = await waitForDeploy(serviceId, forwardDeploy.id || forwardDeploy.deploy?.id);
  const forwardHealth = await fetch(healthUrl);
  const endedAt = new Date().toISOString();

  const report = {
    startedAt,
    endedAt,
    serviceId,
    originalLiveDeployId: liveDeploy.deploy.id,
    originalLiveCommitId: liveDeploy.deploy.commit.id,
    rollbackTargetDeployId: rollbackTarget.deploy.id,
    rollbackTargetCommitId: rollbackTarget.deploy.commit.id,
    rollbackResultStatus: rollbackResult.deploy?.status || rollbackResult.status,
    rollbackHealthStatus: rollbackHealth.status,
    restoreForwardDeployId: forwardResult.deploy?.id || forwardResult.id,
    restoreForwardCommitId: liveDeploy.deploy.commit.id,
    restoreForwardStatus: forwardResult.deploy?.status || forwardResult.status,
    restoreForwardHealthStatus: forwardHealth.status
  };

  await fsp.writeFile(path.join(outputDir, 'rollback-drill-report.json'), JSON.stringify(report, null, 2), 'utf8');
  await fsp.writeFile(
    path.join(outputDir, 'rollback-drill-report.md'),
    [
      '# CHENGETO Render Rollback Drill',
      '',
      `- Started: ${startedAt}`,
      `- Ended: ${endedAt}`,
      `- Original live deploy: ${report.originalLiveDeployId} (${report.originalLiveCommitId})`,
      `- Rollback target: ${report.rollbackTargetDeployId} (${report.rollbackTargetCommitId})`,
      `- Rollback result status: ${report.rollbackResultStatus}`,
      `- Rollback health HTTP status: ${report.rollbackHealthStatus}`,
      `- Forward restore deploy: ${report.restoreForwardDeployId} (${report.restoreForwardCommitId})`,
      `- Forward restore status: ${report.restoreForwardStatus}`,
      `- Final health HTTP status: ${report.restoreForwardHealthStatus}`
    ].join('\n'),
    'utf8'
  );

  console.log(JSON.stringify({ outputDir, report }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
