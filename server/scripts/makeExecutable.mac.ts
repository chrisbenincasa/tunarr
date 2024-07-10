// Can't use Nexe because of code signing limitations...

import archiver from 'archiver';
import axios from 'axios';
import { createWriteStream, existsSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import stream from 'stream';
import * as tar from 'tar';

if (existsSync('./build/web')) {
  await fs.rm('./build/web', { recursive: true });
}

await fs.cp(path.resolve(process.cwd(), '../web/dist'), './build/web', {
  recursive: true,
});

const NODE_URL =
  'https://nodejs.org/dist/v20.15.0/node-v20.15.0-darwin-x64.tar.gz';

console.log(`Creating Tunarr executable archive: ./build/tunarr-macos-x64.zip`);

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-node-dl-'));

console.log(`Downloading nodejs binary to ${tmp}`);

const nodeTarStream = await axios.get<stream.Readable>(NODE_URL, {
  responseType: 'stream',
});

await new Promise((resolve, reject) => {
  console.log('Extracting nodejs binary...');
  const outstream = nodeTarStream.data.pipe(
    tar.x({
      strip: 1,
      gzip: true,
      C: tmp,
    }),
  );

  outstream.on('end', resolve);
  outstream.on('error', reject);
});

const outputArchive = createWriteStream(`./build/tunarr-macos-x64.zip`);
const archive = archiver('zip');
const outStreamEnd = new Promise((resolve, reject) => {
  outputArchive.on('close', resolve);
  outputArchive.on('error', reject);
});

archive.pipe(outputArchive);

archive
  .file('./build/bundle.js', { name: 'bundle.js' })
  .file('./build/package.json', { name: 'package.json' })
  .file('./scripts/macos-entrypoint.sh', { name: 'macos-entrypoint.sh' })
  .directory(tmp, '')
  .directory('./build/migrations', 'migrations')
  .directory('./build/resources', 'resources')
  .directory('./build/web', 'web')
  .directory('./build/build', 'build');
archive.finalize();

await outStreamEnd;

console.log('Finished writing Tunarr zip!');
