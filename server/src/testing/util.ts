import fs from 'node:fs/promises';
import path from 'node:path';

export function readTestFile(filePath: string) {
  const outPath = path.resolve(
    import.meta.dirname,
    'resources',
    ...filePath.split(path.delimiter),
  );
  return fs.readFile(outPath);
}
