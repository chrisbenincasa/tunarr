import { bootstrapTunarr } from '@/bootstrap.js';
import { DBAccess } from '@/db/DBAccess.js';
import type { DrizzleDBAccess } from '@/db/schema/index.js';
import { Program } from '@/db/schema/Program.js';
import { ProgramMediaStream } from '@/db/schema/ProgramMediaStream.js';
import { ProgramSubtitles } from '@/db/schema/ProgramSubtitles.js';
import { ProgramVersion } from '@/db/schema/ProgramVersion.js';
import { setGlobalOptionsUnchecked } from '@/globals.js';
import type {
  MeilisearchService,
  ProgramIndexPartialUpdate,
} from '@/services/MeilisearchService.js';
import { inMemorySettingsDB } from '@/testing/getFakeSettingsDb.js';
import { copyPreMigratedDb } from '@/testing/testDbFactory.js';
import tmp from 'tmp-promise';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackfillStreamSearchFieldsFixer } from './BackfillStreamSearchFieldsFixer.js';

type StreamRow = {
  kind: 'audio' | 'subtitles' | 'external_subtitles';
  title: string | null;
  language?: string;
};

describe('BackfillStreamSearchFieldsFixer', () => {
  let cleanup: () => Promise<void>;
  let drizzle: DrizzleDBAccess;

  beforeEach(async () => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    const opts = setGlobalOptionsUnchecked({
      database: dbResult.path,
      log_level: 'debug',
      verbose: 0,
    });
    await bootstrapTunarr(opts);
    const connection = DBAccess.instance.drizzle;
    if (!connection) {
      throw new Error('Expected Drizzle DB connection to be initialized');
    }
    drizzle = connection;
    cleanup = async () => {
      await DBAccess.instance.closeConnection(`${dbResult.path}/db.db`);
      await dbResult.cleanup();
    };
  });

  afterEach(async () => {
    await cleanup();
  });

  function insertProgram(uuid: string) {
    drizzle
      .insert(Program)
      .values({
        uuid,
        duration: 60_000,
        externalKey: uuid,
        externalSourceId: 'test-source',
        sourceType: 'jellyfin',
        title: uuid,
        type: 'movie',
      })
      .run();
  }

  function insertVersion(
    programId: string,
    versionId: string,
    createdAt: number,
    streams: StreamRow[],
  ) {
    drizzle
      .insert(ProgramVersion)
      .values({
        uuid: versionId,
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
        duration: 60_000,
        scanKind: 'progressive',
        width: 1920,
        height: 1080,
        programId,
      })
      .run();
    streams.forEach((stream, index) => {
      drizzle
        .insert(ProgramMediaStream)
        .values({
          uuid: `${versionId}-${index}`,
          index,
          codec: 'aac',
          streamKind: stream.kind,
          title: stream.title,
          language: stream.language,
          programVersionId: versionId,
        })
        .run();
    });
  }

  function insertStoredSubtitle(programId: string, language: string) {
    drizzle
      .insert(ProgramSubtitles)
      .values({
        uuid: `${programId}-${language}`,
        subtitleType: 'sidecar',
        codec: 'srt',
        language,
        programId,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();
  }

  function makeFixer(indexedIds: Set<string>, done = false) {
    const updates: ProgramIndexPartialUpdate[] = [];
    const getPrograms = vi.fn(async (ids: string[]) =>
      ids.filter((id) => indexedIds.has(id)).map((id) => ({ id })),
    );
    const searchService = {
      waitUntilReady: () => Promise.resolve(),
      getPrograms,
      updatePrograms: (partials: ProgramIndexPartialUpdate[]) => {
        updates.push(...partials);
        return Promise.resolve();
      },
    } as unknown as MeilisearchService;
    const settingsDB = inMemorySettingsDB({
      migration: { hasBackfilledStreamSearchFields: done },
    });
    const fixer = new BackfillStreamSearchFieldsFixer(
      drizzle,
      searchService,
      settingsDB,
    );
    return { fixer, updates, getPrograms, settingsDB };
  }

  it("publishes each indexed program's track titles from its first version", async () => {
    insertProgram('movie');
    insertVersion('movie', 'movie-v1', 1, [
      { kind: 'audio', title: 'English' },
      { kind: 'audio', title: 'Commentary with the director' },
      { kind: 'audio', title: 'Commentary with the director' },
      { kind: 'audio', title: null },
      { kind: 'subtitles', title: 'English SDH', language: 'eng' },
      { kind: 'external_subtitles', title: 'Signs & Songs', language: 'spa' },
    ]);
    insertVersion('movie', 'movie-v2', 2, [
      { kind: 'audio', title: 'From a later version' },
    ]);
    insertProgram('no-streams');
    insertProgram('not-indexed');
    insertVersion('not-indexed', 'not-indexed-v1', 1, [
      { kind: 'audio', title: 'Commentary' },
    ]);

    const { fixer, updates, settingsDB } = makeFixer(
      new Set(['movie', 'no-streams']),
    );
    await fixer.run();

    expect(updates).toEqual(
      expect.arrayContaining([
        {
          id: 'movie',
          audioTitles: ['English', 'Commentary with the director'],
          subtitleTitles: ['English SDH', 'Signs & Songs'],
          subtitleLanguages: ['eng', 'spa'],
        },
        {
          id: 'no-streams',
          audioTitles: [],
          subtitleTitles: [],
          subtitleLanguages: [],
        },
      ]),
    );
    expect(updates).toHaveLength(2);
    expect(settingsDB.migrationState.hasBackfilledStreamSearchFields).toBe(
      true,
    );
  });

  it('adds sidecar subtitle languages and keeps the stream languages', async () => {
    insertProgram('local-movie');
    insertVersion('local-movie', 'local-movie-v1', 1, [
      { kind: 'subtitles', title: null, language: 'eng' },
    ]);
    insertStoredSubtitle('local-movie', 'eng');
    insertStoredSubtitle('local-movie', 'fre');
    insertStoredSubtitle('local-movie', 'unknown');
    insertProgram('sidecar-only');
    insertStoredSubtitle('sidecar-only', 'jpn');

    const { fixer, updates } = makeFixer(
      new Set(['local-movie', 'sidecar-only']),
    );
    await fixer.run();

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'local-movie',
          subtitleLanguages: ['eng', 'fra'],
        }),
        expect.objectContaining({
          id: 'sidecar-only',
          subtitleLanguages: ['jpn'],
        }),
      ]),
    );
  });

  it('pages through every program', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `program-${i}`);
    ids.forEach(insertProgram);

    const { fixer, updates, getPrograms } = makeFixer(new Set(ids));
    await fixer.run();

    expect(getPrograms).toHaveBeenCalledTimes(2);
    expect(new Set(updates.map(({ id }) => id))).toEqual(new Set(ids));
  });

  it('does nothing once the backfill has run', async () => {
    insertProgram('movie');

    const { fixer, updates, getPrograms } = makeFixer(new Set(['movie']), true);
    await fixer.run();

    expect(getPrograms).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});
