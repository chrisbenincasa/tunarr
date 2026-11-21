import fs from 'node:fs/promises';
import path from 'node:path';
import { fileExists } from '../../util/fsUtil.ts';
import { isNodeError } from '../../util/index.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';

export type SearchIndexDirectoryState =
  // No index directory; Meilisearch will create one (or import a snapshot).
  | { type: 'missing' }
  // The index directory has a valid VERSION file; hand it to Meilisearch as-is.
  | { type: 'ok' }
  // The index directory held no index data and was removed.
  | { type: 'removed_empty'; reason: VersionProblem }
  // The index directory had data but no usable VERSION file and was moved aside.
  | { type: 'moved_aside'; reason: VersionProblem; movedTo: string };

export type VersionProblem = 'missing_version' | 'invalid_version';

const VersionFileName = 'VERSION';

// Meilisearch requires exactly major.minor.patch.
const VersionPattern = /^\d+\.\d+\.\d+$/;

/**
 * Meilisearch refuses to start when its db path exists without a VERSION
 * file ("failed to infer the version of the database"), or when VERSION
 * does not hold major.minor.patch ("The version contains 1 parts instead
 * of 3"). The first happens when something deletes files out from under the
 * index -- e.g. macOS clearing old files from $TMPDIR, which leaves the
 * directory tree behind with no files in it. The second happens when a crash
 * or power loss leaves VERSION empty. The search index is derived data, so
 * rather than failing to start, clear the way for Meilisearch to build a
 * fresh one:
 *
 * - no files besides VERSION: nothing can be lost, so remove the directory.
 * - other files: move the directory aside so the data is kept.
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

  const version = await readVersionFile(dbPath);
  if (version !== null && VersionPattern.test(version.trim())) {
    return { type: 'ok' };
  }

  const reason: VersionProblem =
    version === null ? 'missing_version' : 'invalid_version';
  const problem =
    reason === 'missing_version'
      ? 'has no VERSION file'
      : 'has an invalid VERSION file';

  if (!(await containsAnyFile(dbPath, path.join(dbPath, VersionFileName)))) {
    logger.warn(
      'Search index directory %s %s and no index data; removing it so Meilisearch can create a new index. Search results will be empty until libraries are rescanned.',
      dbPath,
      problem,
    );
    await fs.rm(dbPath, { recursive: true });
    return { type: 'removed_empty', reason };
  }

  const movedTo = `${dbPath}.broken-${now()}`;
  logger.warn(
    'Search index directory %s %s, so Meilisearch cannot open it. Moving it to %s and creating a new index. Search results will be empty until libraries are rescanned.',
    dbPath,
    problem,
    movedTo,
  );
  await fs.rename(dbPath, movedTo);
  return { type: 'moved_aside', reason, movedTo };
}

async function readVersionFile(dbPath: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(dbPath, VersionFileName), 'utf-8');
  } catch (e) {
    if (isNodeError(e) && e.code === 'ENOENT') {
      return null;
    }
    throw e;
  }
}

async function containsAnyFile(
  dir: string,
  ignoredPath: string,
): Promise<boolean> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entryPath === ignoredPath) {
      continue;
    }
    if (!entry.isDirectory()) {
      return true;
    }
    if (await containsAnyFile(entryPath, ignoredPath)) {
      return true;
    }
  }
  return false;
}
