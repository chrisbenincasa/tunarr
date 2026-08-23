import fs, { constants, type FileHandle } from 'node:fs/promises';
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

/**
 * Writes to a scratch file in the destination's directory and renames it into
 * place. A plain write truncates the destination first, so an interrupted one
 * leaves a zero-length or partially-written file behind; rename(2) is atomic
 * within a filesystem, so the destination only ever holds the complete old or
 * the complete new contents.
 *
 * Calls for the same destination are serialized through a per-path queue, so
 * concurrent callers cannot clobber each other's scratch file (the scratch
 * name embeds only the pid, so it is shared within a process).
 *
 * Durability notes: the scratch file is flushed to disk before the rename so
 * its contents survive a power loss, but the containing directory is not
 * synced, so the rename itself is only guaranteed against process
 * interruption. This matches the write path lowdb uses (steno). The rename
 * also replaces the destination's inode, so an existing file's permissions
 * are not preserved: the new file is created with the umask default
 * (typically 0644).
 */
const pendingWrites = new Map<string, Promise<void>>();

export function writeFileAtomic(
  filePath: string,
  contents: string,
): Promise<void> {
  const queueKey = path.resolve(filePath);
  const prior = pendingWrites.get(queueKey);

  const write = (prior ?? Promise.resolve())
    // A failed write does not poison the queue -- the next caller still runs.
    .catch(() => void 0)
    .then(() => writeFileAtomicInternal(filePath, contents));

  pendingWrites.set(queueKey, write);
  return write.finally(() => {
    if (pendingWrites.get(queueKey) === write) {
      pendingWrites.delete(queueKey);
    }
  });
}

async function writeFileAtomicInternal(filePath: string, contents: string) {
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.tmp`,
  );

  let fileHandle: FileHandle | undefined;
  try {
    fileHandle = await fs.open(tempPath, 'w');
    await fileHandle.writeFile(contents);
    // Flush the data to disk before renaming into place. Without this, a
    // power loss after the rename can still surface an empty or partial
    // destination on filesystems with delayed allocation (e.g. ext4).
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = undefined;
    await fs.rename(tempPath, filePath);
  } catch (e) {
    if (fileHandle !== undefined) {
      await fileHandle.close().catch(() => void 0);
    }

    // Best-effort cleanup; the write already failed and is being rethrown.
    await fs.unlink(tempPath).catch(() => void 0);
    throw e;
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

/**
 * Deletes the file at the given absolute path.
 * Throws if the file cannot be deleted.
 */
export async function deleteUploadedFile(filePath: string): Promise<void> {
  await fs.unlink(filePath);
}

export function changeFileExtension(filePath: string, newExtension: string) {
  const ext = newExtension.startsWith('.') ? newExtension : `.${newExtension}`;
  return path.join(
    path.dirname(filePath),
    path.basename(filePath, path.extname(filePath)) + ext,
  );
}
