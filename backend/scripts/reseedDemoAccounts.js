import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getDemoAccountReseedOptionsFromEnv, reseedDemoAccounts } from '../utils/demoAccountReseed.js';

dotenv.config();

const args = new Set(process.argv.slice(2));
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error('Missing MONGODB_URI (or MONGO_URI).');
}

const getSelectionFromArgs = () => {
  const arg = process.argv.find((value) => value.startsWith('--selection='));
  if (!arg) {
    return null;
  }

  const value = arg.split('=').slice(1).join('=').trim();
  if (!value || value.toLowerCase() === 'all') {
    return null;
  }

  return new Set(
    value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
};

async function main() {
  await mongoose.connect(mongoUri);

  const envOptions = getDemoAccountReseedOptionsFromEnv();
  const mode = args.has('--apply') ? 'apply' : 'dry-run';
  const result = await reseedDemoAccounts({
    ...envOptions,
    mode,
    selected: getSelectionFromArgs() || envOptions.selected
  });

  console.log(JSON.stringify(result.report, null, 2));

  if (mode !== 'apply') {
    console.log('[reseedDemoAccounts] dry run complete. Re-run with --apply to persist changes.');
    return;
  }

  console.log(JSON.stringify(result.applied, null, 2));
}

main()
  .catch((error) => {
    console.error('[reseedDemoAccounts] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
