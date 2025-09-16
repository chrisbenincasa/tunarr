import { Endpoints } from '@octokit/types';
import axios from 'axios';
import { execSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import { dirname } from 'node:path';
import stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { match } from 'ts-pattern';
import serverPackage from '../package.json' with { type: 'json' };
import { fileExists } from '../src/util/fsUtil.ts';
import { groupByUniq } from '../src/util/index.ts';

const outPath = './bin/meilisearch';
const wantedVersion = serverPackage.meilisearch.version;

async function hasExecutePermission() {
  try {
    const stats = await fs.stat(outPath);
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

async function addExecPermission() {
  try {
    const stat = await fs.stat(outPath);
    const currentMode = stat.mode;
    await fs.chmod(outPath, currentMode | 0o100);
  } catch (e) {
    console.error(e, 'Error while trying to chmod +x meilisearch binary');
  }
}

async function needsToDownloadNewBinary() {
  const exists = await fileExists(outPath);
  let shouldDownload = !exists;
  if (exists) {
    // check version against package
    const stdout = execSync(`${outPath} --version`).toString('utf-8').trim();
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
        const hasExec = await hasExecutePermission();
        if (hasExec) {
          console.debug('meilisearch has execute permissions. Woohoo!');
        } else {
          console.warn(
            'meilisearch does not have execute permissions. Attempting to add them',
          );
          await addExecPermission();
        }
      } else {
        shouldDownload = true;
      }
    }
  }
  return shouldDownload;
}

type getReleaseByTagResponse =
  Endpoints['GET /repos/{owner}/{repo}/releases/tags/{tag}']['response']['data'];

async function copyToTarget(targetPath: string) {
  const dir = dirname(targetPath);
  if (!(await fileExists(dir))) {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.cp(outPath, targetPath);
}

export async function grabMeilisearch(
  platform: NodeJS.Platform = os.platform(),
  arch: string = os.arch(),
  targetPath?: string,
) {
  const outPath = `meilisearch-${platform}-${arch}`;
  const needsDownload = await needsToDownloadNewBinary();

  if (!needsDownload) {
    console.debug(
      'Current meilisearch binary version already at version ' + wantedVersion,
    );
    if (targetPath) {
      await copyToTarget(targetPath);
    }

    return outPath;
  }

  console.info(
    `Downloading meilisearch version ${wantedVersion} for ${platform} ${arch} from Github`,
  );

  const response = await axios.get<getReleaseByTagResponse>(
    `https://api.github.com/repos/meilisearch/meilisearch/releases/tags/v${wantedVersion}`,
  );
  const assetsByName = groupByUniq(response.data.assets, (asset) => asset.name);
  const meilisearchArchName = match([platform, arch])
    .with(['linux', 'x64'], () => 'linux-amd64')
    .with(['linux', 'arm64'], () => 'linux-aarch64')
    .with(['darwin', 'x64'], () => 'macos-amd64')
    .with(['darwin', 'arm64'], () => 'macos-apple-silicon')
    .with(['win32', 'x64'], () => 'windows-amd64')
    .otherwise(() => null);
  if (!meilisearchArchName) {
    console.error(`Unsupported platform/arch combo: ${platform} / ${arch}`);
    return;
  }

  const asset = assetsByName[`meilisearch-${meilisearchArchName}`];
  if (!asset) {
    console.error(`No asset found for type: ${meilisearchArchName}`);
    return;
  }

  const outStream = await axios.request<stream.Readable>({
    method: 'get',
    url: asset.browser_download_url,
    responseType: 'stream',
  });

  await pipeline(outStream.data, createWriteStream(outPath));

  console.log(`Successfully wrote meilisearch binary to ${outPath}`);

  await addExecPermission();

  console.log('Successfully set exec permissions on new binary');

  if (targetPath) {
    await copyToTarget(targetPath);
    return targetPath;
  }

  return outPath;
}

if (process.argv[1] === import.meta.filename) {
  await grabMeilisearch(os.platform(), os.arch(), process.argv?.[2]);
}
