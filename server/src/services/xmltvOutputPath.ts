import fs, { constants } from 'node:fs/promises';
import path from 'node:path';
import { isNodeError, isNonEmptyString } from '@/util/index.js';

/**
 * Checks that the XMLTV file can be written at a path. The directory must
 * already exist. The file need not, because the XMLTV writer creates it.
 *
 * Missing directories are never created. An unmounted network share would
 * otherwise get a directory on the local disk, and the guide would land there.
 */
export async function canWriteXmlTvOutputPath(
  outputPath: string,
): Promise<boolean> {
  // The path must name a file. An empty path or a trailing separator names none.
  if (!isNonEmptyString(outputPath.trim()) || /[\\/]$/.test(outputPath)) {
    return false;
  }

  const dir = path.dirname(outputPath);
  try {
    await fs.access(dir, constants.W_OK);
  } catch {
    return false;
  }

  try {
    const stat = await fs.stat(outputPath);
    if (!stat.isFile()) {
      return false;
    }
    await fs.access(outputPath, constants.W_OK);
    return true;
  } catch (e) {
    return isNodeError(e) && e.code === 'ENOENT';
  }
}

/**
 * Picks where the XMLTV file lives for this run. Uses the configured path
 * when it can be written and the fallback otherwise. The fallback is never
 * saved to settings.
 * A path that becomes writable later, such as a late network mount, is
 * picked up again on the next call.
 */
export async function resolveXmlTvOutputPath(
  configuredPath: string,
  fallbackPath: string,
): Promise<string> {
  if (await canWriteXmlTvOutputPath(configuredPath)) {
    return configuredPath;
  }
  return fallbackPath;
}
