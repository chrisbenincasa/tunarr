// Can't use Nexe because of code signing limitations...

import archiver from 'archiver';
import retry from 'async-retry';
import axios from 'axios';
import { createWriteStream, existsSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import stream from 'stream';
import * as tar from 'tar';
import unzip from 'unzip-stream';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import serverPackage from '../package.json';

const NODE_VERSION = '22.13.0';
const LINUX_TARGET = `linux-x64`;
const LINUX_ARM64V8_TARGET = `linux-arm64`;
const LINUX_ARMV7_TARGET = 'linux-armv7l';
const WINDOWS_TARGET = `windows-x64`;
const WINDOWS_X86_TARGET = `windows-x86`;
const MACOS_TARGET = 'macos-x64';
const MACOS_ARM_TARGET = 'macos-arm64';
const ALL_TARGETS = [
  LINUX_TARGET,
  LINUX_ARMV7_TARGET,
  LINUX_ARM64V8_TARGET,
  WINDOWS_TARGET,
  WINDOWS_X86_TARGET,
  MACOS_TARGET,
  MACOS_ARM_TARGET,
] as const;

const args = await yargs(hideBin(process.argv))
  .scriptName('tunarr-make-exec')
  .option('target', {
    alias: 't',
    type: 'string',
    array: true,
    choices: ALL_TARGETS,
    default: ALL_TARGETS,
  })
  .demandOption('target')
  .option('tempdir', {
    type: 'string',
  })
  .parseAsync();

if (existsSync('./dist/web')) {
  await fs.rm('./dist/web', { recursive: true });
}

await fs.cp(path.resolve(process.cwd(), '../web/dist'), './dist/web', {
  recursive: true,
});

for (const target of args.target) {
  try {
    let nodeBuild: string = target;
    let ext = 'tar.gz';
    if (target.startsWith('macos')) {
      nodeBuild = nodeBuild.replaceAll('macos', 'darwin');
    } else if (target.startsWith('windows')) {
      nodeBuild = nodeBuild.replace('windows', 'win');
      ext = 'zip';
    }

    const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${nodeBuild}.${ext}`;

    console.log(
      `Creating Tunarr executable archive: ./dist/tunarr-${target}-${serverPackage.version}.zip`,
    );

    const tmp = await fs.mkdtemp(
      path.join(os.tmpdir(), `tunarr-node-dl-${target}-`),
    );

    console.log(`Downloading nodejs binary to ${tmp}`, NODE_URL);

    const nodeDlStream = await retry(() => {
      return axios.get<stream.Readable>(NODE_URL, {
        responseType: 'stream',
      });
    });

    await new Promise((resolve, reject) => {
      console.log('Extracting nodejs binary...');
      if (ext === 'zip') {
        const outstresm = nodeDlStream.data.pipe(unzip.Extract({ path: tmp }));
        outstresm.on('close', resolve);
        outstresm.on('error', reject);
      } else {
        const outstream = nodeDlStream.data.pipe(
          tar.x({
            strip: 1,
            gzip: true,
            C: tmp,
          }),
        );

        outstream.on('end', resolve);
        outstream.on('error', reject);
      }
    });

    const outputArchive = createWriteStream(
      `./dist/tunarr-${target}-${serverPackage.version}.zip`,
    );
    const archive = archiver('zip');
    const outStreamEnd = new Promise((resolve, reject) => {
      outputArchive.on('close', resolve);
      outputArchive.on('error', reject);
    });

    archive.pipe(outputArchive);

    archive
      .file('./dist/bundle.js', { name: 'bundle.js' })
      .file('./dist/package.json', { name: 'package.json' })
      .directory(tmp, '')
      .directory('./dist/migrations', 'migrations')
      .directory('./dist/resources', 'resources')
      .directory('./dist/web', 'web')
      .directory('./dist/build', 'build');
    if (target.startsWith('windows')) {
      archive.file('./scripts/tunarr.bat', { name: 'tunarr.bat' });
    } else {
      archive.file('./scripts/tunarr.sh', { name: 'tunarr.sh' });
    }
    archive.finalize();

    await outStreamEnd;

    console.log('Finished writing Tunarr zip!');
  } catch (e) {
    console.error(
      e.message,
      'Error while creating package for target ' + target,
    );
  }
}
