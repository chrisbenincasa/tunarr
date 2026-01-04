import axios from 'axios';
import { execSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import { dirname } from 'node:path';
import stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { format } from 'node:util';
import { match, P } from 'ts-pattern';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import serverPackage from '../package.json' with { type: 'json' };
import { Nullable } from '../src/types/util.ts';
import { fileExists } from '../src/util/fsUtil.ts';

const meilisearchDownloadFmt =
  'https://github.com/meilisearch/meilisearch/releases/download/v%s/meilisearch-%s-%s';

function getMeilisearchDownloadUrl(
  version: string,
  platform: string,
  arch: string,
): string {
  return format(meilisearchDownloadFmt, version, platform, arch);
}

const DefaultOutPath = './bin/meilisearch';
const wantedVersion = serverPackage.meilisearch.version;

async function hasExecutePermission(targetPath: string) {
  try {
    const stats = await fs.stat(targetPath);
    const mode = stats.mode;

    // Check for execute permission for the owner
    const ownerExecute = mode & 0o100;

    // Check for execute permission for the group
    const groupExecute = mode & 0o010;

    // Check for execute permission for others
    const othersExecute = mode & 0o001;

    // Determine the current user's permissions based on their ID and the file's ownership
    if (os.userInfo().uid === stats.uid) {
      return !!ownerExecute;
    } else if (os.userInfo().gid === stats.gid) {
      return !!groupExecute;
    } else {
      return !!othersExecute;
    }
  } catch (err) {
    // Handle errors like the file not existing
    console.error('Error getting file stats:', err);
    return false;
  }
}

async function addExecPermission(targetPath: string) {
  try {
    const stat = await fs.stat(targetPath);
    const currentMode = stat.mode;
    await fs.chmod(targetPath, currentMode | 0o100);
  } catch (e) {
    console.error(e, 'Error while trying to chmod +x meilisearch binary');
  }
}

async function needsToDownloadNewBinary(targetPath: string) {
  const exists = await fileExists(targetPath);
  let shouldDownload = !exists;
  if (exists) {
    // check version against package
    const stdout = execSync(`${targetPath} --version`).toString('utf-8').trim();
    const extractedVersionMatch = /meilisearch\s*(\d+\.\d+\.\d+).*/.exec(
      stdout,
    );
    if (!extractedVersionMatch) {
      console.warn(`Could not parse meilisearch version output: ${stdout}`);
      shouldDownload = true;
    } else {
      const version = extractedVersionMatch[1];
      if (version === wantedVersion) {
        console.info(
          'Skipping meilisearch download. Already have right version',
        );
        const hasExec = await hasExecutePermission(targetPath);
        if (hasExec) {
          console.debug('meilisearch has execute permissions. Woohoo!');
        } else {
          console.warn(
            'meilisearch does not have execute permissions. Attempting to add them',
          );
          await addExecPermission(targetPath);
        }
      } else {
        shouldDownload = true;
      }
    }
  }
  try {
    await fs.mkdir('./bin');
  } catch {
    console.debug('./bin already exists...');
  }
  return shouldDownload;
}

async function copyToTarget(targetPath: string) {
  const dir = dirname(targetPath);
  if (!(await fileExists(dir))) {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.cp(DefaultOutPath, targetPath);
}

export async function grabMeilisearch(
  targetPath: string,
  platform: NodeJS.Platform = os.platform(),
  arch: string = os.arch(),
) {
  const needsDownload = await needsToDownloadNewBinary(targetPath);

  if (!needsDownload) {
    console.debug(
      'Current meilisearch binary version already at version ' + wantedVersion,
    );
    // await copyToTarget(targetPath);

    return targetPath;
  }

  console.info(
    `Downloading meilisearch version ${wantedVersion} for ${platform} ${arch} from Github`,
  );

  const meilisearchPlatformAndArch = match([platform, arch])
    .returnType<
      Nullable<{ meilisearchPlatform: string; meilisearchArch: string }>
    >()
    .with(['linux', 'x64'], () => ({
      meilisearchPlatform: 'linux',
      meilisearchArch: 'amd64',
    }))
    .with(['linux', 'arm64'], () => ({
      meilisearchPlatform: 'linux',
      meilisearchArch: 'aarch64',
    }))
    .with(['darwin', P.union('x64', 'x86_64')], () => ({
      meilisearchPlatform: 'macos',
      meilisearchArch: 'amd64',
    }))
    .with(['darwin', 'arm64'], () => ({
      meilisearchPlatform: 'macos',
      meilisearchArch: 'apple-silicon',
    }))
    .with(['win32', 'x64'], () => ({
      meilisearchPlatform: 'windows',
      meilisearchArch: 'amd64.exe',
    }))
    .otherwise(() => null);
  if (!meilisearchPlatformAndArch) {
    console.error(`Unsupported platform/arch combo: ${platform} / ${arch}`);
    return;
  }

  const downloadUrl = getMeilisearchDownloadUrl(
    wantedVersion,
    meilisearchPlatformAndArch.meilisearchPlatform,
    meilisearchPlatformAndArch.meilisearchArch,
  );
  console.log(`Downloading meilisearch from ${downloadUrl}`);
  const outStream = await axios.request<stream.Readable>({
    method: 'get',
    url: downloadUrl,
    responseType: 'stream',
  });

  await pipeline(outStream.data, createWriteStream(targetPath));

  console.log(`Successfully wrote meilisearch binary to ${targetPath}`);

  await addExecPermission(targetPath);

  console.log('Successfully set exec permissions on new binary');

  // if (targetPath) {
  //   await copyToTarget(targetPath);
  //   console.log(
  //     'Successfully copied meilisearch to configured target: ' + targetPath,
  //   );
  //   return targetPath;
  // }

  return targetPath;
}

if (process.argv[1] === import.meta.filename) {
  const args = await yargs(hideBin(process.argv))
    .scriptName('tunarr-download-meilisearch')
    .option('platform', {
      type: 'string',
      default: os.platform(),
    })
    .option('arch', {
      type: 'string',
      default: os.arch(),
    })
    .option('outPath', {
      type: 'string',
      default: DefaultOutPath,
    })
    .parseAsync();

  console.info(
    'Grabbing meilisearch for platform %s and arch %s',
    args.platform,
    args.arch,
  );
  await grabMeilisearch(
    args.outPath,
    args.platform as NodeJS.Platform,
    args.arch,
  );
}
