import fs from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = path.resolve(process.cwd(), '.test-cache');

export const templateDbPath = path.join(CACHE_DIR, 'template.db');

export async function setup() {
  const { default: tmp } = await import('tmp-promise');
  const { setGlobalOptionsUnchecked } = await import('../globals.ts');
  const { bootstrapTunarr } = await import('../bootstrap.ts');
  const { DBAccess } = await import('../db/DBAccess.ts');
  const { getDefaultDatabaseName } = await import('../util/defaults.ts');

  const tmpDir = await tmp.dir({ unsafeCleanup: true });

  setGlobalOptionsUnchecked({
    database: tmpDir.path,
    log_level: 'error',
    verbose: 0,
  });

  await bootstrapTunarr();

  const dbPath = getDefaultDatabaseName();
  const conn = DBAccess.instance.getConnection(dbPath);
  // Flush WAL so the main file is self-contained for copying
  conn?.sqlite.pragma('wal_checkpoint(TRUNCATE)');
  await DBAccess.instance.closeConnection(dbPath);

  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.copyFile(dbPath, templateDbPath);

  await tmpDir.cleanup();
}

export async function teardown() {
  await fs.rm(CACHE_DIR, { recursive: true, force: true }).catch(() => {});
}
