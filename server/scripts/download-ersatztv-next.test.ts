import archiver from 'archiver';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import stream from 'node:stream';
import tmp from 'tmp-promise';
import { describe, expect, test } from 'vitest';
import {
  companionFilesFor,
  etvTargetFor,
  expectedSha256For,
  installEtvNextArchive,
} from './download-ersatztv-next.ts';

/** Builds a zip shaped like upstream's: one top-level directory of files. */
async function makeZip(files: Record<string, Buffer>): Promise<Buffer> {
  const archive = archiver('zip');
  const chunks: Buffer[] = [];
  const sink = new stream.PassThrough();
  sink.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise((resolve) => sink.on('end', resolve));
  archive.pipe(sink);
  for (const [name, data] of Object.entries(files)) {
    archive.append(data, { name: `ersatztv-next-v0.0.0-windows-x64/${name}` });
  }
  await archive.finalize();
  await done;
  return Buffer.concat(chunks);
}

// The six targets `make-bin.ts` builds, in its own vocabulary.
const tunarrTargets = [
  'linux-x64',
  'linux-arm64',
  'alpine-x64',
  'macos-x64',
  'macos-arm64',
  'win-x64',
] as const;

describe('etvTargetFor', () => {
  test.each(tunarrTargets)('maps the %s build target', (target) => {
    const [platform, arch] = target.split('-', 2);

    expect(etvTargetFor(platform, arch)).not.toBeNull();
  });

  test('sends Alpine to the musl build, not the glibc one', () => {
    expect(etvTargetFor('alpine', 'x64')).toBe('linux-musl-x64');
    expect(etvTargetFor('linux', 'x64')).toBe('linux-x64');
  });

  test('accepts the Node platform vocabulary as well as make-bin', () => {
    expect(etvTargetFor('darwin', 'arm64')).toBe(
      etvTargetFor('macos', 'arm64'),
    );
    expect(etvTargetFor('win32', 'x64')).toBe(etvTargetFor('win', 'x64'));
  });

  test('refuses a target upstream does not publish', () => {
    expect(etvTargetFor('linux', 'arm')).toBeNull();
    expect(etvTargetFor('freebsd', 'x64')).toBeNull();
    expect(etvTargetFor('win32', 'arm64')).toBeNull();
  });
});

describe('expectedSha256For', () => {
  test.each(tunarrTargets)('pins a hash for the %s build target', (target) => {
    const [platform, arch] = target.split('-', 2);
    const etvTarget = etvTargetFor(platform, arch);
    expect(etvTarget).not.toBeNull();
    if (!etvTarget) return;

    expect(expectedSha256For(etvTarget)).toMatch(/^[0-9a-f]{64}$/);
  });

  test('pins nothing for an unknown target', () => {
    expect(expectedSha256For('linux-arm')).toBeNull();
  });
});

describe('companionFilesFor', () => {
  test('ships libvpl and its license beside the Windows worker', () => {
    expect(companionFilesFor('windows-x64')).toEqual([
      'libvpl.dll',
      'libvpl-LICENSE.txt',
    ]);
  });

  test('ships nothing extra for other targets', () => {
    expect(companionFilesFor('linux-x64')).toEqual([]);
    expect(companionFilesFor('macos-arm64')).toEqual([]);
  });
});

describe('installEtvNextArchive', () => {
  // Large enough that extraction cannot finish within a tick.
  const worker = randomBytes(1024 * 1024);
  const dll = randomBytes(64 * 1024);
  const license = Buffer.from('MIT License');

  test('installs the worker and its companions from a Windows zip', async () => {
    const zip = await makeZip({
      'ersatztv-channel.exe': worker,
      'ersatztv.exe': randomBytes(16),
      'libvpl.dll': dll,
      'libvpl-LICENSE.txt': license,
    });

    await tmp.withDir(
      async (dir) => {
        const targetPath = path.join(
          dir.path,
          'bin',
          'ersatztv-channel-win-x64',
        );

        const result = await installEtvNextArchive(zip, {
          archiveName: 'test.zip',
          isZip: true,
          targetPath,
          companionFiles: companionFilesFor('windows-x64'),
        });

        const dllPath = path.join(dir.path, 'bin', 'libvpl.dll');
        const licensePath = path.join(dir.path, 'bin', 'libvpl-LICENSE.txt');
        expect(result).toEqual({
          binaryPath: targetPath,
          companionPaths: [dllPath, licensePath],
        });
        expect((await fs.readFile(targetPath)).equals(worker)).toBe(true);
        expect((await fs.readFile(dllPath)).equals(dll)).toBe(true);
        expect(await fs.readFile(licensePath)).toEqual(license);
        await expect(
          fs.access(path.join(dir.path, 'bin', 'ersatztv.exe')),
        ).rejects.toThrow();
      },
      { unsafeCleanup: true },
    );
  });

  test('writes nothing when a companion is missing', async () => {
    const zip = await makeZip({
      'ersatztv-channel.exe': worker,
      'libvpl-LICENSE.txt': license,
    });

    await tmp.withDir(
      async (dir) => {
        const targetPath = path.join(dir.path, 'ersatztv-channel-win-x64');

        const result = await installEtvNextArchive(zip, {
          archiveName: 'test.zip',
          isZip: true,
          targetPath,
          companionFiles: companionFilesFor('windows-x64'),
        });

        expect(result).toBeNull();
        expect(await fs.readdir(dir.path)).toEqual([]);
      },
      { unsafeCleanup: true },
    );
  });
});
