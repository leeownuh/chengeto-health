import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getAuthDataRepairOptionsFromEnv, runAuthDataRepair } from '../utils/authDataRepair.js';

dotenv.config();

const args = new Set(process.argv.slice(2));
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error('Missing MONGODB_URI (or MONGO_URI).');
}

async function main() {
  await mongoose.connect(mongoUri);

  console.log(`[repairAuthData] connected to ${mongoose.connection.name}`);
  const envOptions = getAuthDataRepairOptionsFromEnv();
  const mode = args.has('--apply') ? 'apply' : 'dry-run';
  const result = await runAuthDataRepair({
    ...envOptions,
    mode,
    resetDemoPasswords: args.has('--reset-demo-passwords') || envOptions.resetDemoPasswords,
    syncIndexes: args.has('--sync-indexes') || envOptions.syncIndexes,
    unsetLegacyFields: args.has('--keep-legacy-fields') ? false : envOptions.unsetLegacyFields
  });

  console.log(JSON.stringify(result.report, null, 2));

  if (mode !== 'apply') {
    console.log('[repairAuthData] dry run complete. Re-run with --apply to persist changes.');
    return;
  }

  console.log(JSON.stringify(result.applied, null, 2));
}

main()
  .catch((error) => {
    console.error('[repairAuthData] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
