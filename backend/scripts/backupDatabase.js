import path from 'path';
import { fileURLToPath } from 'url';
import {
  ensureDir,
  exportDatabase,
  parseArgs
} from './lib/backupUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = parseArgs(process.argv.slice(2));
const uri = args.uri || process.env.MONGODB_URI || process.env.MONGO_URI;
const dbName = args['db-name'] || process.env.MONGODB_DB_NAME;
const outDir = path.resolve(
  args['out-dir'] ||
  path.join(__dirname, '..', '..', 'outputs', 'backups', new Date().toISOString().replace(/[:.]/g, '-'))
);
const collections = args.collections
  ? String(args.collections).split(',').map((value) => value.trim()).filter(Boolean)
  : null;

if (!uri) {
  throw new Error('Missing MongoDB connection URI. Set MONGODB_URI or pass --uri.');
}

await ensureDir(outDir);
const result = await exportDatabase({
  uri,
  dbName,
  outDir,
  collections
});

console.log(JSON.stringify({
  outDir,
  manifestPath: result.manifestPath,
  sourceDbName: result.manifest.sourceDbName,
  collections: result.manifest.collections.map((entry) => ({
    name: entry.name,
    documentCount: entry.documentCount,
    sha256: entry.sha256
  }))
}, null, 2));
