import axios from 'axios';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
import { isNonEmptyString } from '../src/util/index.ts';
import {
  matchesPinnedEtvNextVersion,
  parseEtvNextVersion,
  pinnedEtvNextVersion,
} from '../src/stream/etv/EtvNextVersion.ts';

/**
 * Only the channel worker is needed. The `ersatztv` server is the sidecar shape
 * Tunarr deliberately does not run, and the playout generator is replaced by
 * Tunarr's own scheduling.
 */
const BINARY_NAME = 'ersatztv-channel';

const DefaultOutPath = `./bin/${BINARY_NAME}`;

/**
 * Files the Windows worker needs in its own directory. It loads `libvpl.dll`
 * at runtime for Intel QSV, and the library's MIT license ships with it.
 */
const WindowsCompanionFiles = ['libvpl.dll', 'libvpl-LICENSE.txt'];

export type EtvNextFiles = {
  binaryPath: string;
  /** Files that must sit beside the binary, such as DLLs it loads. */
  companionPaths: string[];
};

export function companionFilesFor(etvTarget: string): string[] {
  return etvTarget.startsWith('windows') ? WindowsCompanionFiles : [];
}

const { releaseRepo, releaseTag, commit } = serverPackage.ersatztvNext;
const pinnedSha256: Record<string, string> = serverPackage.ersatztvNext.sha256;

/** The pinned archive's SHA-256 for one upstream target. */
export function expectedSha256For(etvTarget: string): Nullable<string> {
  const hash = pinnedSha256[etvTarget];
  return isNonEmptyString(hash) ? hash : null;
}

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
  const archiveName = `ersatztv-next-${releaseTag}-${etvTarget}${isZip ? '.zip' : '.tar.gz'}`;

  return {
    url: `https://github.com/${releaseRepo}/releases/download/${releaseTag}/${archiveName}`,
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
 * The worker prints its version, so the check needs no network call. It uses
 * the same exact-match rule as the server's startup check.
 */
async function needsToDownloadNewBinary(
  targetPath: string,
  companionPaths: string[],
) {
  for (const p of [targetPath, ...companionPaths]) {
    if (!(await fileExists(p))) {
      return true;
    }
  }

  try {
    await addExecPermission(targetPath);
    const found = parseEtvNextVersion(
      execSync(`"${targetPath}" --version`, { encoding: 'utf-8' }),
    );

    if (!found) {
      console.log(`Could not read a version from ${targetPath}, redownloading`);
      return true;
    }

    if (!matchesPinnedEtvNextVersion(found)) {
      console.log(
        `Found ${BINARY_NAME} ${found}, want ${pinnedEtvNextVersion}`,
      );
      return true;
    }

    return false;
  } catch (e) {
    console.log(`Could not run ${targetPath}, redownloading`, e);
    return true;
  }
}

/**
 * Downloads `ersatztv-channel` for one target and writes it to `targetPath`,
 * with any companion files beside it.
 *
 * The archive must match the SHA-256 pinned for its target, or nothing is
 * written.
 */
export async function grabEtvNext(
  targetPath: string = DefaultOutPath,
  platform: string = os.platform(),
  arch: string = os.arch(),
): Promise<Nullable<EtvNextFiles>> {
  const etvTarget = etvTargetFor(platform, arch);
  if (!etvTarget) {
    console.error(
      `No ErsatzTV next release target for platform ${platform}, arch ${arch}`,
    );
    return null;
  }

  const expectedSha256 = expectedSha256For(etvTarget);
  if (!expectedSha256) {
    console.error(`No SHA-256 is pinned for ErsatzTV next target ${etvTarget}`);
    return null;
  }

  const companionFiles = companionFilesFor(etvTarget);
  const companionPaths = companionFiles.map((name) =>
    path.join(dirname(targetPath), name),
  );

  if (!(await needsToDownloadNewBinary(targetPath, companionPaths))) {
    console.log(`${BINARY_NAME} ${releaseTag} is already at ${targetPath}`);
    return { binaryPath: targetPath, companionPaths };
  }

  const { url, archiveName, isZip } = getDownloadUrl(etvTarget);
  console.log(`Downloading ${url} ...`);

  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
  });
  const archive = Buffer.from(response.data);

  const actualSha256 = createHash('sha256').update(archive).digest('hex');
  if (actualSha256 !== expectedSha256) {
    console.error(
      `${archiveName} has SHA-256 ${actualSha256}, but ${expectedSha256} is pinned`,
    );
    return null;
  }

  return installEtvNextArchive(archive, {
    archiveName,
    isZip,
    targetPath,
    companionFiles,
  });
}

/**
 * Extracts a release archive and installs the worker at `targetPath`, with
 * each companion file beside it.
 *
 * Upstream ships a `.tar.gz` (or `.zip` on Windows) containing a single
 * directory of binaries, so the archive is extracted to a temp dir and only
 * the worker and its companions are kept.
 */
export async function installEtvNextArchive(
  archive: Buffer,
  opts: {
    archiveName: string;
    isZip: boolean;
    targetPath: string;
    companionFiles: string[];
  },
): Promise<Nullable<EtvNextFiles>> {
  const { archiveName, isZip, targetPath, companionFiles } = opts;

  await fs.mkdir(dirname(targetPath), { recursive: true });

  return await tmp.withDir(
    async (dir) => {
      const data = stream.Readable.from(archive);
      const extractedBinary = isZip
        ? await extractZip(data, dir.path)
        : await extractTarGz(data, dir.path);

      if (!extractedBinary) {
        console.error(`${archiveName} did not contain ${BINARY_NAME}`);
        return null;
      }

      // Check every companion before writing anything, so a bad archive
      // leaves the previous install intact.
      const extractedCompanions = companionFiles.map((name) =>
        path.join(dirname(extractedBinary), name),
      );
      for (const companion of extractedCompanions) {
        if (!(await fileExists(companion))) {
          console.error(
            `${archiveName} did not contain ${path.basename(companion)}`,
          );
          return null;
        }
      }

      await moveFile(extractedBinary, targetPath);
      await addExecPermission(targetPath);
      console.log(`Wrote ${BINARY_NAME} to ${targetPath}`);

      const companionPaths: string[] = [];
      for (const companion of extractedCompanions) {
        const destination = path.join(
          dirname(targetPath),
          path.basename(companion),
        );
        await moveFile(companion, destination);
        companionPaths.push(destination);
        console.log(`Wrote ${path.basename(companion)} to ${destination}`);
      }

      return { binaryPath: targetPath, companionPaths };
    },
    { unsafeCleanup: true },
  );
}

async function moveFile(from: string, to: string) {
  await fs.rename(from, to).catch(async (e: unknown) => {
    // A temp dir on another filesystem cannot be renamed across, so fall back
    // to a copy.
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') {
      throw e;
    }
    await fs.copyFile(from, to);
  });
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
  await data.pipe(unzipper.Extract({ path: destination })).promise();

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
    .option('optional', {
      type: 'boolean',
      default: false,
      description:
        'Warn instead of failing, so `pnpm dev` still starts offline',
    })
    .parseAsync();

  console.log(
    `ErsatzTV next pinned to ${releaseTag} (commit ${commit.slice(0, 7)}) from ${releaseRepo}`,
  );

  const result = await grabEtvNext(
    args.outPath,
    args.platform,
    args.arch,
  ).catch((e: unknown) => {
    console.error(`Could not download ${BINARY_NAME}`, e);
    return null;
  });

  if (!result) {
    if (args.optional) {
      console.warn(
        `Continuing without ${BINARY_NAME}. ErsatzTV next streams will fail until \`pnpm download-ersatztv-next\` succeeds.`,
      );
    } else {
      process.exit(1);
    }
  }
}
