import fs from 'node:fs/promises';
import { isNodeError } from './index.js';
import path from 'node:path';

export async function fileExists(path: string) {
  try {
    await fs.stat(path);
    return true;
  } catch (e) {
    if (isNodeError(e) && e.code === 'ENOENT') {
      return false;
    }

    // Re-throw any other error type
    throw e;
  }
}

export async function copyDirectoryContents(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const files = await fs.readdir(src);
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = await fs.stat(srcPath);
    if (stat.isDirectory()) {
      await copyDirectoryContents(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
