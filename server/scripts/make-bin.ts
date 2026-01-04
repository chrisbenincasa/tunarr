import dotenv from '@dotenvx/dotenvx';
dotenv.config({ debug: false, quiet: true, ignore: ['MISSING_ENV_FILE'] });

import { exec } from '@yao-pkg/pkg';
import archiver from 'archiver';
import retry from 'async-retry';
import axios from 'axios';
import nodeAbi from 'node-abi';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import stream from 'node:stream';
import { format } from 'node:util';
import { rimraf } from 'rimraf';
import * as tar from 'tar';
import tmp from 'tmp-promise';
import { match, P } from 'ts-pattern';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import serverPackage from '../package.json' with { type: 'json' };
import { fileExists } from '../src/util/fsUtil.ts';
import { grabMeilisearch } from './download-meilisearch.ts';

const NODE_VERSION = '22.20.0';

const betterSqlite3ReleaseFmt =
  'https://github.com/WiseLibs/better-sqlite3/releases/download/v%s/better-sqlite3-v%s-node-v%s-%s-%s.tar.gz';

function getBetterSqlite3DownloadUrl(
  betterSqliteVersion: string,
  nodeAbiVersion: string,
  osString: string,
  archString: string,
) {
  if (osString === 'macos') {
    osString = 'darwin';
  } else if (osString === 'win') {
    osString = 'win32';
  } else if (osString === 'alpine') {
    osString = 'linuxmusl';
  }

  return format(
    betterSqlite3ReleaseFmt,
    betterSqliteVersion,
    betterSqliteVersion,
    nodeAbiVersion,
    osString,
    archString,
  );
}

const ARCHS = [
  'linux-x64',
  'linux-arm64',
  'alpine-x64',
  'macos-x64',
  'macos-arm64',
  'win-x64',
];

const pkgConfig = () => ({
  pkg: {
    assets: [`./dist/**/*`],
    outputPath: './dist/bin',
  },
});

const isEdgeBuild = process.env['TUNARR_EDGE_BUILD'] === 'true';

const args = await yargs(hideBin(process.argv))
  .scriptName('tunarr-make-exec')
  .option('target', {
    type: 'array',
    choices: ARCHS,
    default: ARCHS.filter((arch) => arch.endsWith(process.arch)),
  })
  .option('debug', {
    type: 'boolean',
    default: false,
  })
  .option('include-version', {
    type: 'boolean',
    default: true,
  })
  .option('clean', {
    type: 'boolean',
    default: false,
  })
  .option('output-archives', {
    type: 'boolean',
    default: false,
  })
  .parseAsync();

!(await fileExists('./bin')) && (await fs.mkdir('./bin'));

if (args.clean) {
  await rimraf('./bin/tunarr*', { glob: true });
}

(await fileExists('./dist/web')) &&
  (await fs.rm('./dist/web', { recursive: true }));

(await fileExists('./dist/bin')) &&
  (await fs.rm('./dist/bin', { recursive: true }));

await fs.cp(path.resolve(process.cwd(), '../web/dist'), './dist/web', {
  recursive: true,
});

await fs.cp(
  path.resolve(process.cwd(), './src/migration/db/sql'),
  './dist/sql',
  { recursive: true },
);

const originalWorkingDir = process.cwd();

console.log(`Going to build archs: ${args.target.join(' ')}`);

for (const arch of args.target) {
  await tmp.withDir(
    async (dir) => {
      const [osString, archString] = arch.split('-', 2);
      const betterSqliteDlStream = await retry(() => {
        const url = getBetterSqlite3DownloadUrl(
          serverPackage.dependencies['better-sqlite3'],
          nodeAbi.getAbi(NODE_VERSION, 'node'),
          osString!,
          archString!,
        );
        console.log(`Downloading prebuilt better-sqlite3 ${url} ...`);
        return axios.get<stream.Readable>(url, {
          responseType: 'stream',
        });
      });

      const nodePlatform = match(osString)
        .returnType<NodeJS.Platform>()
        .with('win', () => 'win32')
        .with('macos', () => 'darwin')
        .with(P.union('linux', 'alpine'), () => 'linux')
        .otherwise(() => {
          throw new Error(`Unrecognized osString ${osString}`);
        });

      console.log(
        `Downloading meilisearch (platform ${nodePlatform}, arch ${archString})`,
      );
      const meilisearchBinaryPath = await grabMeilisearch(
        `./bin/meilisearch-${arch}`,
        nodePlatform,
        archString,
      );
      if (!meilisearchBinaryPath) {
        throw new Error('Could not download Meilisearch binary');
      } else {
        console.log(`Meilisearch found at ${meilisearchBinaryPath}`);
      }

      // Untar
      await new Promise((resolve, reject) => {
        const outstream = betterSqliteDlStream.data.pipe(
          tar.x({
            strip: 2,
            gzip: true,
            C: dir.path,
          }),
        );
        outstream.on('end', resolve);
        outstream.on('error', reject);
      });

      // Move the dist directory over to the working directory
      await fs.cp('./dist', `${dir.path}/dist`, { recursive: true });

      // Move the extracted better-sqlite3 to the right place in dist
      await fs.rename(
        path.join(dir.path, 'better_sqlite3.node'),
        path.join(dir.path, 'dist', 'build', 'better_sqlite3.node'),
      );

      // Push directory context
      process.chdir(dir.path);

      // Write
      await fs.writeFile(
        `${dir.path}/pkg.config.json`,
        JSON.stringify(pkgConfig(), undefined, 4),
      );
      console.debug(`Wrote config`);

      let execName = `tunarr`;
      if (args.includeVersion && !isEdgeBuild) {
        execName += `-${serverPackage.version}`;
      }
      execName += `-${arch}`;
      if (arch.startsWith('windows')) {
        execName += '.exe';
      }
      if (arch.startsWith('win')) {
        execName += '.exe';
      }

      console.log(`Building binary for ${arch}: ${execName}`);

      const pkgArgs = [
        ...(args.debug ? ['--debug'] : []),
        '-c',
        'pkg.config.json',
        '-t',
        `node${NODE_VERSION}-${arch}`,
        `${dir.path}/dist/bundle.cjs`,
        // Look into whether we want this sometimes...
        '--no-bytecode',
        '--signature', // for macos arm64
        '--debug',
        '-o',
        `dist/bin/${execName}`,
      ];

      console.debug(`Running pkg with args: ${pkgArgs.join(' ')}`);

      await exec(pkgArgs);

      console.log(`Built binary at ${dir.path}/dist/bin/${execName}`);

      process.chdir(originalWorkingDir);

      await fs.cp(`${dir.path}/dist/bin/${execName}`, `./bin/${execName}`);

      console.info(`Copied binary to bin/${execName}`);

      if (args.outputArchives) {
        console.info('Creating release archive');

        const targetIsWindows = osString === 'win';
        const format = targetIsWindows ? 'zip' : 'tar';
        const archive = archiver(format, { gzip: !targetIsWindows });
        const finishedPromise = new Promise<void>((resolve, reject) => {
          archive.on('end', () => resolve(void 0));
          archive.on('error', reject);
          archive.on('entry', (entry) => {
            console.debug('Added entry to backup: %s', entry.name);
          });
        });

        const outStream = createWriteStream(
          `./bin/${execName}.${format}${targetIsWindows ? '' : '.gz'}`,
        );
        archive.pipe(outStream);
        archive.file(`./bin/${execName}`, { name: execName });
        archive.file(`./bin/meilisearch-${arch}`, {
          name: 'meilisearch' + (targetIsWindows ? '.exe' : ''),
        });
        await archive.finalize();
        await finishedPromise;
      }
    },
    { unsafeCleanup: true, mode: 0o755 },
  );
}
