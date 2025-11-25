import fs, { constants } from 'node:fs/promises';
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

export async function* streamFileBackwards(
  filePath: string,
  chunkSize: number = 65536,
): AsyncGenerator<string> {
  // TODO: Use AsyncDisposableStack when we upgrade to node 24
  // await using disposer = new AsyncDisposableStack();
  // const fileHandle = disposer.use(await fs.open(filePath, constants.R_OK));
  const fileHandle = await fs.open(filePath, constants.R_OK);
  try {
    const fileSize = (await fileHandle.stat()).size;
    let position = fileSize;
    let buffer = Buffer.alloc(0);
    let leftOver = '';
    while (position > 0 || buffer.length > 0) {
      const readSize = Math.min(chunkSize, position);
      position -= readSize;

      const readResult = await fileHandle.read(
        Buffer.alloc(readSize),
        0,
        readSize,
        position,
      );
      const newChunk = readResult.buffer;

      buffer = Buffer.concat([newChunk, buffer]);

      let newLineIndex: number;
      while ((newLineIndex = buffer.lastIndexOf('\n')) !== -1) {
        const line = buffer.subarray(newLineIndex + 1);

        buffer = buffer.subarray(0, newLineIndex);

        yield (line.toString('utf8') + leftOver).trim();
        leftOver = '';
      }

      if (position === 0) {
        yield (buffer.toString('utf8') + leftOver).trim();
        break;
      }

      leftOver = buffer.toString('utf8') + leftOver;
      buffer = Buffer.alloc(0);
    }
  } finally {
    await fileHandle.close();
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

export function changeFileExtension(filePath: string, newExtension: string) {
  const ext = newExtension.startsWith('.') ? newExtension : `.${newExtension}`;
  return path.join(
    path.dirname(filePath),
    path.basename(filePath, path.extname(filePath)) + ext,
  );
}
