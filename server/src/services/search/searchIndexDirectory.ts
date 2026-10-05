import fs from 'node:fs/promises';
import path from 'node:path';
import { fileExists } from '../../util/fsUtil.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';

export type SearchIndexDirectoryState =
  // No index directory; Meilisearch will create one (or import a snapshot).
  | { type: 'missing' }
  // The index directory has a VERSION file; hand it to Meilisearch as-is.
  | { type: 'ok' }
  // The index directory held no files and was removed.
  | { type: 'removed_empty' }
  // The index directory had data but no VERSION file and was moved aside.
  | { type: 'moved_aside'; movedTo: string };

/**
 * Meilisearch refuses to start when its db path exists without a VERSION
 * file ("failed to infer the version of the database"). That happens when
 * something deletes files out from under the index -- e.g. macOS clearing
 * old files from $TMPDIR, which leaves the directory tree behind with no
 * files in it. The search index is derived data, so rather than failing to
 * start, clear the way for Meilisearch to build a fresh one:
 *
 * - no files at all: nothing can be lost, so remove the directory.
 * - files but no VERSION: move the directory aside so the data is kept.
 *
 * Either way the directory no longer exists afterwards, so the caller's
 * snapshot-restore path applies.
 */
export async function prepareSearchIndexDirectory(
  dbPath: string,
  logger: Logger,
  now: () => number = Date.now,
): Promise<SearchIndexDirectoryState> {
  if (!(await fileExists(dbPath))) {
    return { type: 'missing' };
  }

  if (await fileExists(path.join(dbPath, 'VERSION'))) {
    return { type: 'ok' };
  }

  if (!(await containsAnyFile(dbPath))) {
    logger.warn(
      'Search index directory %s contains no files; removing it so Meilisearch can create a new index. Search results will be empty until libraries are rescanned.',
      dbPath,
    );
    await fs.rm(dbPath, { recursive: true });
    return { type: 'removed_empty' };
  }

  const movedTo = `${dbPath}.broken-${now()}`;
  logger.warn(
    'Search index directory %s has no VERSION file, so Meilisearch cannot open it. Moving it to %s and creating a new index. Search results will be empty until libraries are rescanned.',
    dbPath,
    movedTo,
  );
  await fs.rename(dbPath, movedTo);
  return { type: 'moved_aside', movedTo };
}

async function containsAnyFile(dir: string): Promise<boolean> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      return true;
    }
    if (await containsAnyFile(path.join(dir, entry.name))) {
      return true;
    }
  }
  return false;
}
