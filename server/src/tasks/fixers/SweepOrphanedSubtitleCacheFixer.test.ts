import { tag } from '@tunarr/types';
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { describe, expect, test as baseTest } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import { DBAccess } from '../../db/DBAccess.ts';
import type { MediaSourceId, MediaSourceName } from '../../db/schema/base.ts';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import { MediaSource } from '../../db/schema/MediaSource.ts';
import { Program } from '../../db/schema/Program.ts';
import { ProgramMediaStream } from '../../db/schema/ProgramMediaStream.ts';
import { ProgramSubtitles } from '../../db/schema/ProgramSubtitles.ts';
import { ProgramVersion } from '../../db/schema/ProgramVersion.ts';
import { globalOptions, setGlobalOptionsUnchecked } from '../../globals.ts';
import { FileSystemService } from '../../services/FileSystemService.ts';
import { copyPreMigratedDb } from '../../testing/testDbFactory.ts';
import { fileExists } from '../../util/fsUtil.ts';
import { getSubtitleCacheFilePath } from '../../util/subtitles.ts';
import {
  SubtitleCacheSweepMarker,
  SweepOrphanedSubtitleCacheFixer,
} from './SweepOrphanedSubtitleCacheFixer.ts';

type Fixture = {
  db: string;
  drizzle: DrizzleDBAccess;
  cacheFolder: string;
  fixer: SweepOrphanedSubtitleCacheFixer;
};

const test = baseTest.extend<Fixture>({
  db: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    const opts = setGlobalOptionsUnchecked({
      database: dbResult.path,
      log_level: 'error',
      verbose: 0,
    });
    await bootstrapTunarr(opts);
    await use(dbResult.path);
    await DBAccess.instance.closeConnection(`${dbResult.path}/db.db`);
    await dbResult.cleanup();
  },
  drizzle: async ({ db: _ }, use) => {
    const drizzle = DBAccess.instance.drizzle;
    if (!drizzle) {
      throw new Error('Expected Drizzle DB connection to be initialized');
    }
    await use(drizzle);
  },
  cacheFolder: async ({ db: _ }, use) => {
    const folder = new FileSystemService(
      globalOptions(),
    ).getSubtitleCacheFolder();
    await fs.mkdir(folder, { recursive: true });
    await use(folder);
  },
  fixer: async ({ drizzle }, use) => {
    await use(
      new SweepOrphanedSubtitleCacheFixer(
        drizzle,
        new FileSystemService(globalOptions()),
      ),
    );
  },
});

const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000);

async function writeCacheFile(
  cacheFolder: string,
  relative: string,
  mtime: Date = TWO_HOURS_AGO,
) {
  const fullPath = path.join(cacheFolder, relative);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, 'subtitle');
  await fs.utimes(fullPath, mtime, mtime);
  return fullPath;
}

function makeProgram(drizzle: DrizzleDBAccess) {
  const mediaSourceId = tag<MediaSourceId>(v4());
  drizzle
    .insert(MediaSource)
    .values({
      uuid: mediaSourceId,
      name: tag<MediaSourceName>(`Test Jellyfin ${mediaSourceId}`),
      type: 'jellyfin',
      uri: 'http://jellyfin.local:8096',
      index: 0,
      accessToken: 'token',
      mediaType: 'movies',
    })
    .run();

  const program = {
    uuid: v4(),
    duration: 30_000,
    type: 'movie' as const,
    sourceType: 'jellyfin' as const,
    externalKey: v4(),
    externalSourceId: tag<MediaSourceName>('test-source'),
    title: 'Test Movie',
    mediaSourceId,
  };
  drizzle.insert(Program).values(program).run();
  return program;
}

function cacheNameFor(
  program: ReturnType<typeof makeProgram>,
  streamIndex: number,
) {
  const relative = getSubtitleCacheFilePath(
    {
      id: program.uuid,
      externalKey: program.externalKey,
      externalSourceId: program.mediaSourceId,
      externalSourceType: program.sourceType,
    },
    { streamIndex, codec: 'subrip' },
  );
  if (!relative) {
    throw new Error('Expected a cache path for a text subtitle codec');
  }
  return relative;
}

function insertSubtitle(
  drizzle: DrizzleDBAccess,
  programId: string,
  values: Partial<typeof ProgramSubtitles.$inferInsert>,
) {
  const now = new Date();
  drizzle
    .insert(ProgramSubtitles)
    .values({
      uuid: v4(),
      programId,
      createdAt: now,
      updatedAt: now,
      language: 'eng',
      subtitleType: 'embedded',
      codec: 'subrip',
      ...values,
    })
    .run();
}

function insertSubtitleStream(
  drizzle: DrizzleDBAccess,
  programId: string,
  index: number,
) {
  const versionId = v4();
  const now = new Date();
  drizzle
    .insert(ProgramVersion)
    .values({
      uuid: versionId,
      createdAt: now,
      updatedAt: now,
      duration: 30_000,
      scanKind: 'progressive',
      width: 1920,
      height: 1080,
      programId,
    })
    .run();
  drizzle
    .insert(ProgramMediaStream)
    .values({
      uuid: v4(),
      index,
      codec: 'subrip',
      streamKind: 'subtitles',
      programVersionId: versionId,
    })
    .run();
}

describe('SweepOrphanedSubtitleCacheFixer', () => {
  test('removes unreferenced files and keeps everything still in use', async ({
    drizzle,
    cacheFolder,
    fixer,
  }) => {
    const program = makeProgram(drizzle);

    const sidecar = await writeCacheFile(cacheFolder, 'aa/bb/sidecar.srt');
    insertSubtitle(drizzle, program.uuid, {
      subtitleType: 'sidecar',
      path: sidecar,
    });

    const embeddedRow = await writeCacheFile(
      cacheFolder,
      cacheNameFor(program, 3),
    );
    insertSubtitle(drizzle, program.uuid, { streamIndex: 3 });

    const embeddedStream = await writeCacheFile(
      cacheFolder,
      cacheNameFor(program, 4),
    );
    insertSubtitleStream(drizzle, program.uuid, 4);

    const orphan = await writeCacheFile(cacheFolder, 'cc/dd/orphan.srt');

    await fixer.run();

    expect(await fileExists(orphan)).toBe(false);
    expect(await fileExists(sidecar)).toBe(true);
    expect(await fileExists(embeddedRow)).toBe(true);
    expect(await fileExists(embeddedStream)).toBe(true);
    expect(
      await fileExists(path.join(cacheFolder, SubtitleCacheSweepMarker)),
    ).toBe(true);
  });

  test('keeps recent files and sweeps again until none are left', async ({
    cacheFolder,
    fixer,
  }) => {
    const marker = path.join(cacheFolder, SubtitleCacheSweepMarker);
    const fresh = await writeCacheFile(
      cacheFolder,
      'cc/dd/fresh.srt',
      new Date(),
    );

    await fixer.run();

    expect(await fileExists(fresh)).toBe(true);
    expect(await fileExists(marker)).toBe(false);

    await fs.utimes(fresh, TWO_HOURS_AGO, TWO_HOURS_AGO);
    await fixer.run();

    expect(await fileExists(fresh)).toBe(false);
    expect(await fileExists(marker)).toBe(true);
  });

  test('does nothing once the marker exists', async ({
    cacheFolder,
    fixer,
  }) => {
    await fs.writeFile(path.join(cacheFolder, SubtitleCacheSweepMarker), '');
    const orphan = await writeCacheFile(cacheFolder, 'cc/dd/orphan.srt');

    await fixer.run();

    expect(await fileExists(orphan)).toBe(true);
  });

  test('ignores files outside the two-level cache layout', async ({
    cacheFolder,
    fixer,
  }) => {
    const topLevel = await writeCacheFile(cacheFolder, 'stray.srt');
    const shallow = await writeCacheFile(cacheFolder, 'aa/stray.srt');

    await fixer.run();

    expect(await fileExists(topLevel)).toBe(true);
    expect(await fileExists(shallow)).toBe(true);
  });
});
