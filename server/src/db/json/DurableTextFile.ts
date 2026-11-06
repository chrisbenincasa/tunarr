import type { Adapter, SyncAdapter } from 'lowdb';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { isNodeError } from '../../util/index.ts';
import { writeFileAtomic, writeFileAtomicSync } from '../../util/fsUtil.ts';

/**
 * Drop-in replacements for lowdb's TextFile and TextFileSync. Reads match
 * lowdb: only a missing file reads as null, and every other error throws.
 * Writes fsync the scratch file before renaming it into place, so a power
 * loss cannot leave the destination empty.
 */
export class DurableTextFile implements Adapter<string> {
  constructor(private filePath: string) {}

  async read(): Promise<string | null> {
    try {
      return await fs.readFile(this.filePath, 'utf-8');
    } catch (e) {
      if (isNodeError(e) && e.code === 'ENOENT') {
        return null;
      }
      throw e;
    }
  }

  write(contents: string): Promise<void> {
    return writeFileAtomic(this.filePath, contents);
  }
}

export class DurableTextFileSync implements SyncAdapter<string> {
  constructor(private filePath: string) {}

  read(): string | null {
    try {
      return readFileSync(this.filePath, 'utf-8');
    } catch (e) {
      if (isNodeError(e) && e.code === 'ENOENT') {
        return null;
      }
      throw e;
    }
  }

  write(contents: string): void {
    writeFileAtomicSync(this.filePath, contents);
  }
}
