import fs from 'node:fs/promises';
import path from 'node:path';
import type { Maybe } from '../../types/util.ts';
import { KnownImageFileExtensions } from './constants.ts';

/**
 * Finds image files by extension-less path, matching the extension
 * case-insensitively so `poster.JPG` satisfies a lookup for `poster.jpg`. The
 * rest of the name still matches exactly.
 *
 * Each directory is read once per lookup instance.
 */
export function imageFileLookup() {
  const byDir = new Map<string, Promise<Map<string, string>>>();

  return async (stemPath: string, ext: string): Promise<Maybe<string>> => {
    const dir = path.dirname(stemPath);
    let index = byDir.get(dir);
    if (!index) {
      index = indexImageFiles(dir);
      byDir.set(dir, index);
    }
    return (await index).get(`${path.basename(stemPath)}.${ext}`);
  };
}

/**
 * Tries each extension in `KnownImageFileExtensions` order against every stem,
 * and returns the first image found.
 */
export async function locateImageFile(
  stemPaths: string[],
): Promise<Maybe<string>> {
  const lookup = imageFileLookup();
  for (const ext of KnownImageFileExtensions) {
    for (const stemPath of stemPaths) {
      const found = await lookup(stemPath, ext);
      if (found) {
        return found;
      }
    }
  }
  return;
}

/**
 * Turns `jpg` into `[jJ][pP][gG]` so a glob matches the extension in any case.
 */
export function caseInsensitiveExtensionGlob(ext: string) {
  return [...ext].map((c) => `[${c.toLowerCase()}${c.toUpperCase()}]`).join('');
}

async function indexImageFiles(dir: string): Promise<Map<string, string>> {
  const index = new Map<string, string>();

  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return index;
  }

  for (const name of names) {
    const ext = path.extname(name);
    const normalizedExt = ext.slice(1).toLowerCase();
    if (!KnownImageFileExtensions.has(normalizedExt)) {
      continue;
    }

    // An exact-case file wins over a differently cased duplicate.
    const key = `${name.slice(0, -ext.length)}.${normalizedExt}`;
    if (!index.has(key) || name === key) {
      index.set(key, path.join(dir, name));
    }
  }

  return index;
}
