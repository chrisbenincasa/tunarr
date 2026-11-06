/**
 * What a schema-backed adapter does with a file that exists but is not
 * valid JSON.
 */
export type InvalidJsonPolicy =
  // Throw an error that names the file.
  | 'throw'
  // Rename the file to <name>.corrupt-<timestamp> and continue as if it were
  // absent. Use this only where a single writer owns the file.
  | 'move_aside'
  // Continue as if the file were absent and leave it in place.
  | 'ignore';

export type JsonFileContents =
  | { type: 'missing' }
  // Empty or whitespace only. A crash right after a write can leave this.
  | { type: 'empty' }
  | { type: 'invalid'; error: unknown }
  | { type: 'parsed'; value: unknown };

export function parseJsonFileContents(
  contents: string | null,
): JsonFileContents {
  if (contents === null) {
    return { type: 'missing' };
  }

  if (contents.trim().length === 0) {
    return { type: 'empty' };
  }

  try {
    return { type: 'parsed', value: JSON.parse(contents) as unknown };
  } catch (error) {
    return { type: 'invalid', error };
  }
}

export function corruptFilePath(filePath: string, now: number) {
  return `${filePath}.corrupt-${now}`;
}

export class InvalidJsonFileError extends Error {
  constructor(filePath: string, cause: unknown) {
    super(`${filePath} does not contain valid JSON`, { cause });
    this.name = 'InvalidJsonFileError';
  }
}
