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
