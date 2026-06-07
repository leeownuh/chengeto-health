import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  dropDatabase,
  ensureDir,
  exportDatabase,
  parseArgs,
  restoreDatabase,
  validateRestore
} from './lib/backupUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const formatTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const args = parseArgs(process.argv.slice(2));
const uri = args.uri || process.env.MONGODB_URI || process.env.MONGO_URI;
const sourceDbName = args['source-db'] || process.env.MONGODB_DB_NAME;
const targetDbName = args['target-db'] || `chengeto_restore_drill_${Date.now()}`;
const cleanup = String(args.cleanup || 'true').toLowerCase() !== 'false';
const baseDir = path.resolve(
  args['out-dir'] ||
  path.join(__dirname, '..', '..', 'outputs', 'drills', `restore-${formatTimestamp()}`)
);

if (!uri) {
  throw new Error('Missing MongoDB connection URI. Set MONGODB_URI or pass --uri.');
}

await ensureDir(baseDir);
const backupDir = path.join(baseDir, 'backup');
await ensureDir(backupDir);

const startedAt = new Date().toISOString();
const exportResult = await exportDatabase({
  uri,
  dbName: sourceDbName,
  outDir: backupDir
});

const restoreResult = await restoreDatabase({
  uri,
  dbName: targetDbName,
  backupDir,
  dropExisting: true
});

const validation = await validateRestore({
  uri,
  dbName: targetDbName,
  manifest: exportResult.manifest
});

if (cleanup) {
  await dropDatabase({ uri, dbName: targetDbName });
}

const endedAt = new Date().toISOString();
const report = {
  drillType: 'restore',
  startedAt,
  endedAt,
  sourceDbName: exportResult.manifest.sourceDbName,
  targetDbName,
  cleanup,
  validation,
  collections: exportResult.manifest.collections.map((entry) => ({
    name: entry.name,
    documentCount: entry.documentCount,
    sha256: entry.sha256
  }))
};

await fs.writeFile(
  path.join(baseDir, 'drill-report.json'),
  JSON.stringify(report, null, 2),
  'utf8'
);

const markdown = [
  '# CHENGETO Restore Drill',
  '',
  `- Started: ${startedAt}`,
  `- Ended: ${endedAt}`,
  `- Source DB: ${exportResult.manifest.sourceDbName}`,
  `- Target DB: ${targetDbName}`,
  `- Cleanup after validation: ${cleanup ? 'yes' : 'no'}`,
  `- Validation status: ${validation.allMatched ? 'pass' : 'fail'}`,
  '',
  '## Collections',
  ...report.collections.map((entry) => `- ${entry.name}: ${entry.documentCount} documents`)
].join('\n');

await fs.writeFile(path.join(baseDir, 'drill-report.md'), markdown, 'utf8');

console.log(JSON.stringify({
  baseDir,
  report,
  restoredCollections: restoreResult.restored
}, null, 2));
