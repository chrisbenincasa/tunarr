import axios from 'axios';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path, { dirname } from 'node:path';
import stream from 'node:stream';
import { match, P } from 'ts-pattern';
import * as tar from 'tar';
import tmp from 'tmp-promise';
import unzipper from 'unzipper';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import serverPackage from '../package.json' with { type: 'json' };
import { Nullable } from '../src/types/util.ts';
import { fileExists } from '../src/util/fsUtil.ts';

/**
 * Only the channel worker is needed. The `ersatztv` server is the sidecar shape
 * Tunarr deliberately does not run, and the playout generator is replaced by
 * Tunarr's own scheduling.
 */
const BINARY_NAME = 'ersatztv-channel';

const DefaultOutPath = `./bin/${BINARY_NAME}`;

const { releaseTag, assetVersion, commit } = serverPackage.ersatztvNext;

/**
 * Upstream's release target names, keyed by Tunarr's.
 *
 * Two vocabularies reach this function. `make-bin.ts` splits its own target
 * names and passes `macos`, `win` and `alpine`; a direct CLI run passes
 * `os.platform()`, which says `darwin`, `win32` and `linux`. Alpine is the
 * reason the distinction matters — it needs upstream's musl build, and
 * collapsing it to `linux` would ship a glibc binary that cannot start.
 *
 * Upstream also builds `linux-arm`, which nothing here requests because Tunarr
 * ships no 32-bit ARM target.
 */
export function etvTargetFor(platform: string, arch: string): Nullable<string> {
  return match([platform, arch])
    .returnType<Nullable<string>>()
    .with(['alpine', 'x64'], () => 'linux-musl-x64')
    .with(['linux', 'x64'], () => 'linux-x64')
    .with(['linux', 'arm64'], () => 'linux-arm64')
    .with(
      [P.union('darwin', 'macos'), P.union('x64', 'x86_64')],
      () => 'macos-x64',
    )
    .with([P.union('darwin', 'macos'), 'arm64'], () => 'macos-arm64')
    .with([P.union('win32', 'win'), 'x64'], () => 'windows-x64')
    .otherwise(() => null);
}

function getDownloadUrl(etvTarget: string): {
  url: string;
  archiveName: string;
  isZip: boolean;
} {
  const isZip = etvTarget.startsWith('windows');
  const archiveName = `ersatztv-next-${assetVersion}-${etvTarget}${isZip ? '.zip' : '.tar.gz'}`;

  return {
    url: `https://github.com/ErsatzTV/next/releases/download/${releaseTag}/${archiveName}`,
    archiveName,
    isZip,
  };
}

async function addExecPermission(targetPath: string) {
  const stats = await fs.stat(targetPath);
  await fs.chmod(targetPath, stats.mode | 0o111);
}

/**
 * Whether the binary on disk already matches the pin.
 *
 * The worker prints `ersatztv-channel 0.1.0-ed95077`, so the short commit is
 * comparable against the pin without any network call.
 */
async function needsToDownloadNewBinary(targetPath: string) {
  if (!(await fileExists(targetPath))) {
    return true;
  }

  try {
    await addExecPermission(targetPath);
    const out = execSync(`"${targetPath}" --version`, {
      encoding: 'utf-8',
    }).trim();
    const found = /(\d+\.\d+\.\d+(?:-[0-9a-f]{7,40})?)/.exec(out)?.[1];

    if (found === undefined) {
      console.log(`Could not read a version from ${targetPath}, redownloading`);
      return true;
    }

    const wanted = assetVersion.replace(/^v/, '');
    if (found !== wanted) {
      console.log(`Found ${BINARY_NAME} ${found}, want ${wanted}`);
      return true;
    }

    return false;
  } catch (e) {
    console.log(`Could not run ${targetPath}, redownloading`, e);
    return true;
  }
}

/**
 * Downloads `ersatztv-channel` for one target and writes it to `targetPath`.
 *
 * Upstream ships a `.tar.gz` (or `.zip` on Windows) containing a single
 * directory with three binaries, so the archive is extracted to a temp dir and
 * only the worker is kept.
 *
 * **This does not pin to an immutable artifact.** Upstream publishes only a
 * rolling `develop` pre-release whose assets are replaced on every push to
 * main, so a build reproduced later may fetch a different binary under the same
 * URL. `assetVersion` carries the commit, which makes drift detectable at
 * download time and again at runtime, but not preventable. Cutting tagged
 * releases upstream is what fixes this.
 */
export async function grabEtvNext(
  targetPath: string = DefaultOutPath,
  platform: string = os.platform(),
  arch: string = os.arch(),
): Promise<Nullable<string>> {
  const etvTarget = etvTargetFor(platform, arch);
  if (etvTarget === null) {
    console.error(
      `No ErsatzTV next release target for platform ${platform}, arch ${arch}`,
    );
    return null;
  }

  if (!(await needsToDownloadNewBinary(targetPath))) {
    console.log(`${BINARY_NAME} ${assetVersion} is already at ${targetPath}`);
    return targetPath;
  }

  const { url, archiveName, isZip } = getDownloadUrl(etvTarget);
  console.log(`Downloading ${url} ...`);

  const response = await axios.get<stream.Readable>(url, {
    responseType: 'stream',
  });

  await fs.mkdir(dirname(targetPath), { recursive: true });

  return await tmp.withDir(
    async (dir) => {
      const extractedBinary = isZip
        ? await extractZip(response.data, dir.path)
        : await extractTarGz(response.data, dir.path);

      if (extractedBinary === null) {
        console.error(`${archiveName} did not contain ${BINARY_NAME}`);
        return null;
      }

      await fs.rename(extractedBinary, targetPath).catch(async (e: unknown) => {
        // A temp dir on another filesystem cannot be renamed across, so fall
        // back to a copy.
        if ((e as NodeJS.ErrnoException).code !== 'EXDEV') {
          throw e;
        }
        await fs.copyFile(extractedBinary, targetPath);
      });

      await addExecPermission(targetPath);
      console.log(`Wrote ${BINARY_NAME} to ${targetPath}`);

      return targetPath;
    },
    { unsafeCleanup: true },
  );
}

/** Strips the archive's single top-level directory and returns the worker path. */
async function extractTarGz(
  data: stream.Readable,
  destination: string,
): Promise<Nullable<string>> {
  await new Promise((resolve, reject) => {
    const out = data.pipe(tar.x({ strip: 1, gzip: true, C: destination }));
    out.on('end', resolve);
    out.on('error', reject);
  });

  const target = path.join(destination, BINARY_NAME);
  return (await fileExists(target)) ? target : null;
}

/** The zip keeps the same single top-level directory as the tarball. */
async function extractZip(
  data: stream.Readable,
  destination: string,
): Promise<Nullable<string>> {
  await data.pipe(unzipper.Extract({ path: destination })).promise;

  const exeName = `${BINARY_NAME}.exe`;
  const entries = await fs.readdir(destination, { withFileTypes: true });
  const candidates = entries.map((entry) =>
    entry.isDirectory()
      ? path.join(destination, entry.name, exeName)
      : path.join(destination, entry.name),
  );

  for (const candidate of candidates) {
    if (path.basename(candidate) === exeName && (await fileExists(candidate))) {
      return candidate;
    }
  }

  return null;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.filename === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const args = await yargs(hideBin(process.argv))
    .scriptName('download-ersatztv-next')
    .option('platform', { type: 'string', default: os.platform() })
    .option('arch', { type: 'string', default: os.arch() })
    .option('outPath', { type: 'string', default: DefaultOutPath })
    .parseAsync();

  console.log(
    `ErsatzTV next pinned to ${assetVersion} (commit ${commit.slice(0, 7)}), release tag "${releaseTag}"`,
  );

  const result = await grabEtvNext(args.outPath, args.platform, args.arch);
  if (result === null) {
    process.exit(1);
  }
}
