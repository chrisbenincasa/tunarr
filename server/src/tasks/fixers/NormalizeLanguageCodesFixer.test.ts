import { bootstrapTunarr } from '@/bootstrap.js';
import { DBAccess } from '@/db/DBAccess.js';
import { Program } from '@/db/schema/Program.js';
import { ProgramMediaStream } from '@/db/schema/ProgramMediaStream.js';
import { ProgramSubtitles } from '@/db/schema/ProgramSubtitles.js';
import { ProgramVersion } from '@/db/schema/ProgramVersion.js';
import type { DrizzleDBAccess } from '@/db/schema/index.js';
import { setGlobalOptionsUnchecked } from '@/globals.js';
import type { MeilisearchService } from '@/services/MeilisearchService.js';
import { copyPreMigratedDb } from '@/testing/testDbFactory.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { eq } from 'drizzle-orm';
import tmp from 'tmp-promise';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NormalizeLanguageCodesFixer } from './NormalizeLanguageCodesFixer.js';

/** Enough rows to force more than one batch (the fixer batches at 500). */
const RowCount = 501;

const IndexedProgramId = 'program-indexed';
const UnindexedProgramId = 'program-unindexed';

type PartialDocument = {
  id: string;
  audioLanguages?: string[];
  subtitleLanguages?: string[];
};

describe('NormalizeLanguageCodesFixer', () => {
  let cleanup: () => Promise<void>;
  let drizzle: DrizzleDBAccess;

  function insertProgram(programId: string, versionId: string, index: number) {
    drizzle
      .insert(Program)
      .values({
        uuid: programId,
        duration: 60_000,
        externalKey: programId,
        externalSourceId: 'test-source',
        sourceType: 'plex',
        title: `Test Program ${index}`,
        type: 'movie' as const,
      })
      .run();
    drizzle
      .insert(ProgramVersion)
      .values({
        uuid: versionId,
        createdAt: new Date(index),
        updatedAt: new Date(index),
        duration: 60_000,
        scanKind: 'progressive',
        width: 1920,
        height: 1080,
        programId,
      })
      .run();
  }

  beforeAll(async () => {
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

    insertProgram(IndexedProgramId, 'version-indexed', 0);
    insertProgram(UnindexedProgramId, 'version-unindexed', 1);

    // 501 audio streams on the indexed program: forces two batches.
    drizzle
      .insert(ProgramMediaStream)
      .values(
        Array.from({ length: RowCount }, (_, index) => ({
          uuid: `audio-${index}`,
          index,
          codec: 'aac',
          streamKind: 'audio' as const,
          language: 'ger',
          programVersionId: 'version-indexed',
        })),
      )
      .run();
    // One embedded subtitle stream, so the subtitle facet has a source too.
    drizzle
      .insert(ProgramMediaStream)
      .values({
        uuid: 'subtitle-stream',
        index: RowCount,
        codec: 'srt',
        streamKind: 'subtitles' as const,
        language: 'fre',
        programVersionId: 'version-indexed',
      })
      .run();
    // A program that is not in the index: it must not get a stub document.
    drizzle
      .insert(ProgramMediaStream)
      .values({
        uuid: 'audio-unindexed',
        index: 0,
        codec: 'aac',
        streamKind: 'audio' as const,
        language: 'ger',
        programVersionId: 'version-unindexed',
      })
      .run();
    // Extracted subtitles live in their own table.
    drizzle
      .insert(ProgramSubtitles)
      .values(
        Array.from({ length: RowCount }, (_, index) => ({
          uuid: `subtitle-${index}`,
          subtitleType: 'sidecar' as const,
          codec: 'srt',
          language: 'fre',
          programId: IndexedProgramId,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        })),
      )
      .run();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('waits for search readiness, pages the backfill, and republishes the touched language facets', async () => {
    let markSearchReady: () => void = () => {};
    const searchReady = new Promise<void>((resolve) => {
      markSearchReady = resolve;
    });
    // Only the indexed program exists in the search index.
    const getPrograms = vi.fn(async (ids: string[]) =>
      ids.filter((id) => id === IndexedProgramId).map((id) => ({ id })),
    );
    const updatePrograms = vi.fn(async (_partials: PartialDocument[]) => {});
    const fixer = new NormalizeLanguageCodesFixer(drizzle, {
      waitUntilReady: vi.fn(() => searchReady),
      getPrograms,
      updatePrograms,
    } as unknown as MeilisearchService);
    Object.defineProperty(fixer, 'logger', {
      value: {
        debug: vi.fn(),
        info: vi.fn(),
      } as unknown as Logger,
    });

    const run = fixer.run();
    await Promise.resolve();

    const beforeReady = drizzle
      .select({ language: ProgramMediaStream.language })
      .from(ProgramMediaStream)
      .where(eq(ProgramMediaStream.uuid, 'audio-0'))
      .get();
    expect(beforeReady?.language).toBe('ger');
    expect(updatePrograms).not.toHaveBeenCalled();

    markSearchReady();
    await run;

    // Both columns were rewritten to the terminological codes, across batches.
    const streams = drizzle
      .select({ language: ProgramMediaStream.language })
      .from(ProgramMediaStream)
      .all();
    const subtitles = drizzle
      .select({ language: ProgramSubtitles.language })
      .from(ProgramSubtitles)
      .all();
    expect(new Set(streams.map(({ language }) => language))).toEqual(
      new Set(['deu', 'fra']),
    );
    expect(new Set(subtitles.map(({ language }) => language))).toEqual(
      new Set(['fra']),
    );

    // The backfill paged instead of materializing 1002 rows in one statement.
    expect(updatePrograms.mock.calls.length).toBeGreaterThanOrEqual(4);

    const documents = updatePrograms.mock.calls.flatMap(
      ([partials]) => partials,
    );
    expect(documents.length).toBeGreaterThan(0);
    // Every republished document carries the normalized languages...
    for (const document of documents) {
      expect(document.id).toBe(IndexedProgramId);
    }
    expect(new Set(documents.flatMap((d) => d.audioLanguages ?? []))).toEqual(
      new Set(['deu']),
    );
    expect(
      new Set(documents.flatMap((d) => d.subtitleLanguages ?? [])),
    ).toEqual(new Set(['fra']));
    // ...and the program that is not indexed was never pushed as a stub.
    expect(documents.some((d) => d.id === UnindexedProgramId)).toBe(false);
    expect(
      getPrograms.mock.calls
        .flat()
        .some((ids) => ids.includes(UnindexedProgramId)),
    ).toBe(true);
  });
});
