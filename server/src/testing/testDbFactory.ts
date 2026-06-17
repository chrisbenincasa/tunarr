import fs from 'node:fs/promises';
import path from 'node:path';
import { templateDbPath } from './globalTestSetup.ts';

/**
 * Copy the pre-migrated template database into the given directory.
 * Call this before {@link bootstrapTunarr} so the bootstrap detects
 * all migrations as already applied and skips them.
 */
export async function copyPreMigratedDb(targetDir: string): Promise<void> {
  await fs.copyFile(templateDbPath, path.join(targetDir, 'db.db'));
}
