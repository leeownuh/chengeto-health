import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { EJSON } from 'bson';

const DEFAULT_BATCH_SIZE = 500;

export const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;

    const key = current.slice(2);
    const next = argv[index + 1];
    const isFlag = next === undefined || next.startsWith('--');
    args[key] = isFlag ? true : next;
    if (!isFlag) {
      index += 1;
    }
  }
  return args;
};

export const ensureDir = async (targetDir) => {
  await fs.mkdir(targetDir, { recursive: true });
  return targetDir;
};

export const connectToDatabase = async (uri, { dbName } = {}) => {
  if (!uri) {
    throw new Error('Missing MongoDB connection URI.');
  }

  const connection = await mongoose.createConnection(uri, dbName ? { dbName } : {}).asPromise();
  return connection;
};

export const serializeDocumentSet = (docs) =>
  JSON.stringify(EJSON.serialize(docs, { relaxed: false }), null, 2);

export const deserializeDocumentSet = (raw) =>
  EJSON.deserialize(JSON.parse(raw), { relaxed: false });

export const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

const exportCollection = async (db, collectionName, outDir) => {
  const collection = db.collection(collectionName);
  const [documents, indexes] = await Promise.all([
    collection.find({}).toArray(),
    collection.indexes()
  ]);

  const serialized = serializeDocumentSet(documents);
  const filePath = path.join(outDir, `${collectionName}.ejson`);
  await fs.writeFile(filePath, serialized, 'utf8');

  return {
    name: collectionName,
    documentCount: documents.length,
    indexes,
    sha256: sha256(serialized),
    file: path.basename(filePath)
  };
};

export const exportDatabase = async ({
  uri,
  dbName,
  outDir,
  collections
}) => {
  const connection = await connectToDatabase(uri, { dbName });

  try {
    const resolvedDb = connection.db;
    const allCollections = await resolvedDb.listCollections({}, { nameOnly: true }).toArray();
    const selectedCollections = (collections?.length
      ? allCollections.filter((entry) => collections.includes(entry.name))
      : allCollections
    )
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith('system.'));

    await ensureDir(outDir);

    const exportedCollections = [];
    for (const collectionName of selectedCollections) {
      exportedCollections.push(await exportCollection(resolvedDb, collectionName, outDir));
    }

    const manifest = {
      exportedAt: new Date().toISOString(),
      sourceDbName: resolvedDb.databaseName,
      collections: exportedCollections
    };

    const manifestPath = path.join(outDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    return {
      manifest,
      manifestPath
    };
  } finally {
    await connection.close();
  }
};

const restoreCollection = async ({
  db,
  collectionName,
  backupDir,
  indexes,
  dropExisting = false,
  batchSize = DEFAULT_BATCH_SIZE
}) => {
  const collection = db.collection(collectionName);
  if (dropExisting) {
    await collection.drop().catch((error) => {
      if (!/ns not found/i.test(String(error?.message || ''))) {
        throw error;
      }
    });
  }

  const filePath = path.join(backupDir, `${collectionName}.ejson`);
  const raw = await fs.readFile(filePath, 'utf8');
  const docs = deserializeDocumentSet(raw);

  if (docs.length > 0) {
    for (let index = 0; index < docs.length; index += batchSize) {
      const batch = docs.slice(index, index + batchSize);
      await collection.insertMany(batch, { ordered: false });
    }
  }

  const createableIndexes = (indexes || [])
    .filter((index) => index.name !== '_id_')
    .map((index) => ({
      key: index.key,
      name: index.name,
      unique: index.unique,
      sparse: index.sparse,
      expireAfterSeconds: index.expireAfterSeconds,
      partialFilterExpression: index.partialFilterExpression,
      collation: index.collation
    }));

  if (createableIndexes.length > 0) {
    await collection.createIndexes(createableIndexes);
  }

  return {
    collectionName,
    restoredDocuments: docs.length,
    restoredIndexes: createableIndexes.length
  };
};

export const restoreDatabase = async ({
  uri,
  dbName,
  backupDir,
  dropExisting = false
}) => {
  const manifestPath = path.join(backupDir, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const connection = await connectToDatabase(uri, { dbName });

  try {
    const restored = [];
    for (const collectionEntry of manifest.collections) {
      restored.push(await restoreCollection({
        db: connection.db,
        collectionName: collectionEntry.name,
        backupDir,
        indexes: collectionEntry.indexes,
        dropExisting
      }));
    }

    return {
      manifest,
      restored,
      targetDbName: connection.db.databaseName
    };
  } finally {
    await connection.close();
  }
};

export const validateRestore = async ({
  uri,
  dbName,
  manifest
}) => {
  const connection = await connectToDatabase(uri, { dbName });

  try {
    const validation = [];
    for (const collectionEntry of manifest.collections) {
      const count = await connection.db.collection(collectionEntry.name).countDocuments({});
      validation.push({
        name: collectionEntry.name,
        expectedDocuments: collectionEntry.documentCount,
        actualDocuments: count,
        matches: count === collectionEntry.documentCount
      });
    }

    return {
      targetDbName: connection.db.databaseName,
      collections: validation,
      allMatched: validation.every((entry) => entry.matches)
    };
  } finally {
    await connection.close();
  }
};

export const dropDatabase = async ({ uri, dbName }) => {
  const connection = await connectToDatabase(uri, { dbName });
  try {
    await connection.dropDatabase();
  } finally {
    await connection.close();
  }
};
