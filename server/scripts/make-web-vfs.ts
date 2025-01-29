import * as makeVfs from 'make-vfs';
import fs from 'node:fs/promises';
import path from 'node:path';

if (!fs.exists('./dist/web')) {
  await fs.rm('./dist/web', { recursive: true });
}

await fs.cp(path.resolve(process.cwd(), '../web/dist'), './src/generated/web', {
  recursive: true,
});

const moduleString = await makeVfs.getVirtualFilesystemModuleFromDirPath({
  dirPath: 'src/generated/web',
  contentFormat: 'import-bunfile',
  targetPath: 'src/generated/web-imports.ts',
});

console.log(moduleString);

await Bun.file('./src/generated/web-imports.ts').write(moduleString);

console.log('Successfully wrote ./src/generated/web-imports.js');
