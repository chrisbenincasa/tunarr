import fs from 'node:fs/promises';
import path from 'node:path';
import { isNodeError } from './index.js';

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

export async function walkDirectory(dirPath: string) {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        await walkDirectory(itemPath); // Recursively call for subdirectories
      } else if (item.isFile()) {
        console.log(`File found: ${itemPath}`);
        // Perform operations on the file
      }
    }
  } catch (err) {
    console.error(`Error walking directory ${dirPath}:`, err);
  }
}
