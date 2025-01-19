import { Maybe } from '@/types/util.js';
import { isEmpty } from 'lodash-es';

/**
 * Performs a naive sanitization for passing user-inputted text to
 * child_process exec:
 *  1. Removes shell metacharacters
 *  2. Removes extra whitespace
 *  3. Trims repeating whitespace in between args
 */
export function sanitizeForExec(executable: string): string {
  let cleaned = executable.replace(/[|;<>"'`$()&\n]/gm, '');

  // Workaround to keep \ for Windows paths...
  if (process.platform !== 'win32') {
    cleaned = cleaned.replace('\\', '');
  }

  return cleaned.trim().replace(/\s+/g, ' ');
}

export function trimToUndefined(s: Maybe<string>): Maybe<string> {
  if (!s) {
    return;
  }

  const trim = s.trim();
  if (isEmpty(trim)) {
    return;
  }

  return s;
}
