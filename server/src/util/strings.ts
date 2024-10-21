/**
 * Performs a naive sanitization for passing user-inputted text to
 * child_process exec:
 *  1. Removes shell metacharacters
 *  2. Removes extra whitespace
 *  3. Trims repeating whitespace in between args
 */
export function sanitizeForExec(executable: string): string {
  return executable
    .replace(/[|;<>"'`$()&\\\n]/gm, '')
    .trim()
    .replace(/\s+/g, ' ');
}
