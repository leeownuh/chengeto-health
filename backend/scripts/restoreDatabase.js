import path from 'path';
import { fileURLToPath } from 'url';
import {
  parseArgs,
  restoreDatabase,
  validateRestore
} from './lib/backupUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = parseArgs(process.argv.slice(2));
const uri = args.uri || process.env.MONGODB_URI || process.env.MONGO_URI;
const dbName = args['db-name'] || process.env.MONGODB_DB_NAME;
const backupDir = path.resolve(
  args['backup-dir'] ||
  path.join(__dirname, '..', '..', 'outputs', 'backups')
);
const dropExisting = String(args['drop-existing'] || 'false').toLowerCase() === 'true';

if (!uri) {
  throw new Error('Missing MongoDB connection URI. Set MONGODB_URI or pass --uri.');
}

if (!dbName) {
  throw new Error('Missing target database name. Pass --db-name or set MONGODB_DB_NAME.');
}

const restored = await restoreDatabase({
  uri,
  dbName,
  backupDir,
  dropExisting
});

const validation = await validateRestore({
  uri,
  dbName,
  manifest: restored.manifest
});

console.log(JSON.stringify({
  backupDir,
  targetDbName: restored.targetDbName,
  restoredCollections: restored.restored,
  validation
}, null, 2));
