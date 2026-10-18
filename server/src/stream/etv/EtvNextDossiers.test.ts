import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  dossierDirectory,
  listDossierFiles,
  listDossiers,
  pruneDossiers,
  redactDossierFile,
} from './EtvNextDossiers.ts';

const channelUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

let tempDirs: string[] = [];

async function makeRoot() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'etv-dossiers-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Writes what the worker writes: a directory per failure, holding the FFmpeg
 * report and the JSON it resolved.
 */
async function writeDossier(
  directory: string,
  name: string,
  { mtimeMs, bytes = 32 }: { mtimeMs: number; bytes?: number },
) {
  const full = path.join(directory, name);
  await fs.mkdir(full, { recursive: true });
  await fs.writeFile(path.join(full, 'ffreport.log'), 'x'.repeat(bytes));
  await fs.writeFile(path.join(full, 'outcome.txt'), '');

  const when = new Date(mtimeMs);
  await fs.utimes(full, when, when);
}

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
  tempDirs = [];
});

describe('dossierDirectory', () => {
  test('gives each channel its own folder under the root', async () => {
    const root = await makeRoot();

    expect(dossierDirectory(channelUuid, root)).toBe(
      path.join(root, channelUuid),
    );
  });
});

describe('listDossiers', () => {
  test('is empty for a channel that has never failed', async () => {
    const root = await makeRoot();

    await expect(
      listDossiers(path.join(root, 'nothing-here')),
    ).resolves.toEqual([]);
  });

  test('orders newest first and measures each one', async () => {
    const root = await makeRoot();
    await writeDossier(root, '7_0001', { mtimeMs: 1_000_000, bytes: 10 });
    await writeDossier(root, '7_0003', { mtimeMs: 3_000_000, bytes: 30 });
    await writeDossier(root, '7_0002', { mtimeMs: 2_000_000, bytes: 20 });

    const dossiers = await listDossiers(root);

    expect(dossiers.map((d) => d.name)).toEqual(['7_0003', '7_0002', '7_0001']);
    // The report plus an empty outcome file.
    expect(dossiers[0]?.sizeBytes).toBe(30);
  });

  test('ignores loose files beside the dossiers', async () => {
    const root = await makeRoot();
    await writeDossier(root, '7_0001', { mtimeMs: 1_000_000 });
    await fs.writeFile(path.join(root, 'stray.log'), 'not a dossier');

    const dossiers = await listDossiers(root);

    expect(dossiers.map((d) => d.name)).toEqual(['7_0001']);
  });
});

describe('pruneDossiers', () => {
  test('keeps the newest and drops the rest', async () => {
    const root = await makeRoot();
    for (let i = 1; i <= 6; i++) {
      await writeDossier(root, `7_000${i}`, { mtimeMs: i * 1_000_000 });
    }

    await pruneDossiers(root, 2);

    expect((await listDossiers(root)).map((d) => d.name)).toEqual([
      '7_0006',
      '7_0005',
    ]);
  });

  test('leaves a folder already under the cap alone', async () => {
    const root = await makeRoot();
    await writeDossier(root, '7_0001', { mtimeMs: 1_000_000 });

    await pruneDossiers(root, 5);

    expect(await listDossiers(root)).toHaveLength(1);
  });

  test('does nothing for a folder that is not there', async () => {
    const root = await makeRoot();

    await expect(
      pruneDossiers(path.join(root, 'nothing-here')),
    ).resolves.toBeUndefined();
  });
});

describe('listDossierFiles', () => {
  test('lists nested files relative to the dossier', async () => {
    const root = await makeRoot();
    await writeDossier(root, '1_100', { mtimeMs: 1_000 });
    await fs.mkdir(path.join(root, '1_100', 'json'));
    await fs.writeFile(path.join(root, '1_100', 'json', 'item.json'), '{}');

    const files = await listDossierFiles(path.join(root, '1_100'));

    expect(files.sort()).toEqual(
      ['ffreport.log', 'outcome.txt', path.join('json', 'item.json')].sort(),
    );
  });
});

describe('redactDossierFile', () => {
  test('redacts media-server tokens in text', () => {
    const content = Buffer.from(
      'ffmpeg -i "http://plex:32400/library/parts/1?X-Plex-Token=abc123"',
    );

    expect(redactDossierFile(content)).toBe(
      'ffmpeg -i "http://plex:32400/library/parts/1?X-Plex-Token=REDACTED"',
    );
  });

  test('passes binary content through unchanged', () => {
    const content = Buffer.from([0x47, 0x00, 0x11, 0x10]);

    expect(redactDossierFile(content)).toBe(content);
  });
});
