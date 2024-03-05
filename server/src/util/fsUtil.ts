import fs from 'node:fs/promises';
import { isNodeError } from '../util.js';

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
