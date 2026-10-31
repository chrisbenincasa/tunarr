import fs, { constants } from 'node:fs/promises';
import path from 'node:path';
import { isNodeError } from '@/util/index.js';

/**
 * Prepares a location for the XMLTV file. Creates missing parent directories
 * and checks that the file can be written there. The file itself need not
 * exist yet, because the XMLTV writer creates it.
 *
 * Returns false when the location cannot hold a writable file.
 */
export async function prepareXmlTvOutputPath(
  outputPath: string,
): Promise<boolean> {
  const dir = path.dirname(outputPath);
  try {
    await fs.mkdir(dir, { recursive: true });
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
 * when it can be written and the fallback otherwise. The writer and the
 * XMLTV route both call this, so they agree without persisting the fallback.
 * A path that becomes writable later, such as a late network mount, is
 * picked up again on the next call.
 */
export async function resolveXmlTvOutputPath(
  configuredPath: string,
  fallbackPath: string,
): Promise<string> {
  if (await prepareXmlTvOutputPath(configuredPath)) {
    return configuredPath;
  }
  return fallbackPath;
}
