import path from 'node:path';
import type { ChannelIcon } from '@tunarr/types';
import { deleteUploadedFile } from './fsUtil.js';
import { isNonEmptyString } from './index.js';

const LocalUploadPathPrefix = '/images/uploads/';

/**
 * If the given URL points to a locally-uploaded file under the server's
 * /images/uploads/ path, returns the bare filename. Otherwise returns null.
 */
export function extractLocalUploadFilename(url: string): string | null {
  if (!isNonEmptyString(url)) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!parsed.pathname.startsWith(LocalUploadPathPrefix)) {
    return null;
  }

  return parsed.pathname.slice(LocalUploadPathPrefix.length);
}

/**
 * Returns the URL to use for a channel icon, or null if no icon should be shown.
 * - Custom icon (non-empty path): returns the path
 * - Default fallback enabled (useDefaultIconFallback === true, or icon missing): returns defaultUrl
 * - No icon (path empty, useDefaultIconFallback === false): returns null
 */
export function resolveIconUrl(
  icon: ChannelIcon | null | undefined,
  defaultUrl: string,
): string | null {
  if (!icon) return defaultUrl;
  if (isNonEmptyString(icon.path)) return icon.path;
  return icon.useDefaultIconFallback !== false ? defaultUrl : null;
}

/**
 * Deletes the old icon file from disk if it was a local upload and the icon
 * has been cleared (newIconPath is empty). No-ops otherwise.
 * Throws if the file exists but cannot be deleted.
 */
export async function deleteIfLocalAndCleared(
  oldIconPath: string,
  newIconPath: string,
  databaseDirectory: string,
): Promise<void> {
  if (!isNonEmptyString(oldIconPath) || isNonEmptyString(newIconPath)) {
    return;
  }

  const filename = extractLocalUploadFilename(oldIconPath);
  if (!filename) {
    return;
  }

  await deleteUploadedFile(
    path.join(databaseDirectory, 'images', 'uploads', filename),
  );
}
