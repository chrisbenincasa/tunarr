import { KEYS } from '@/types/inject.js';
import { and, eq, gt, inArray, isNotNull, isNull } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { chunk } from 'lodash-es';
import { v4 } from 'uuid';
import { Artwork, type NewArtwork } from '../../db/schema/Artwork.ts';
import type { MediaSourceId } from '../../db/schema/base.ts';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import { MediaSource } from '../../db/schema/MediaSource.ts';
import { Program } from '../../db/schema/Program.ts';
import { ProgramGrouping } from '../../db/schema/ProgramGrouping.ts';
import { ProgramGroupingExternalId } from '../../db/schema/ProgramGroupingExternalId.ts';
import { buildArtworkSourcePath } from '../../services/artworkSourcePath.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import throttle from '../../util/throttle.ts';
import Fixer from './fixer.ts';

// Rows read per query. Each batch is resolved and inserted before the next is
// read, so this bounds peak memory rather than total work.
const SELECT_BATCH_SIZE = 500;

// Rows inserted per transaction. One transaction per chunk, so a long backfill
// never holds the single SQLite write lock for its whole duration.
const INSERT_CHUNK_SIZE = 100;

// Upper bound on rows *read* per server start, shared by both scans. Counting
// reads rather than writes is what makes this a bound: a row whose media source
// has no usable uri never produces an insert, so a write counter would let a
// table full of them page on to the end while the budget sat at zero.
//
// A backfill larger than this finishes over several restarts; the XMLTV writer
// emits a derived artwork URL in the meantime, so a partial backfill is not
// user-visible.
const MAX_ROWS_READ_PER_RUN = 5_000;

// Mutable so both scans draw down the same allowance.
type ReadBudget = { remaining: number };

@injectable()
export class BackfillProgramArtworkFixer extends Fixer {
  canRunInBackground = true;

  // Overridable so a test can exercise the budget without inserting 5k rows.
  protected readonly maxRowsReadPerRun: number = MAX_ROWS_READ_PER_RUN;

  @InjectLogger() declare protected readonly logger: Logger;

  constructor(@inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess) {
    super();
  }

  protected async runInternal(): Promise<void> {
    // One budget for the run, not one per scan, so a boot reads at most
    // `maxRowsReadPerRun` rows in total.
    const budget = { remaining: this.maxRowsReadPerRun };

    const programCount = await this.backfillProgramArtwork(budget);
    const groupingCount = await this.backfillGroupingArtwork(budget);

    if (programCount > 0 || groupingCount > 0) {
      this.logger.info(
        'Backfilled artwork for %d programs and %d groupings',
        programCount,
        groupingCount,
      );
    } else {
      this.logger.debug('No programs or groupings needed artwork backfill');
    }
  }

  private async backfillProgramArtwork(budget: ReadBudget): Promise<number> {
    let cursor: string | undefined;
    let written = 0;

    while (budget.remaining > 0) {
      // Programs that already have artwork drop out of this predicate, so the
      // backfill resumes across restarts without storing a cursor. The uuid
      // cursor only has to step past rows this run cannot build a path for.
      const batch = this.drizzleDB
        .select({
          uuid: Program.uuid,
          externalKey: Program.externalKey,
          sourceType: Program.sourceType,
          mediaSourceId: Program.mediaSourceId,
        })
        .from(Program)
        .leftJoin(Artwork, eq(Artwork.programId, Program.uuid))
        .where(
          and(
            isNull(Artwork.uuid),
            inArray(Program.sourceType, ['plex', 'jellyfin', 'emby']),
            isNotNull(Program.mediaSourceId),
            cursor === undefined ? undefined : gt(Program.uuid, cursor),
          ),
        )
        .orderBy(Program.uuid)
        .limit(Math.min(SELECT_BATCH_SIZE, budget.remaining))
        .all();

      if (batch.length === 0) {
        break;
      }

      cursor = batch[batch.length - 1]!.uuid;
      budget.remaining -= batch.length;

      const artworkRecords = this.buildProgramArtwork(batch);
      written += this.insertArtwork(artworkRecords);

      if (batch.length < SELECT_BATCH_SIZE) {
        break;
      }

      await throttle();
    }

    return written;
  }

  private async backfillGroupingArtwork(budget: ReadBudget): Promise<number> {
    let cursor: string | undefined;
    let written = 0;

    while (budget.remaining > 0) {
      const batch = this.drizzleDB
        .select({
          uuid: ProgramGrouping.uuid,
          externalKey: ProgramGroupingExternalId.externalKey,
          sourceType: ProgramGroupingExternalId.sourceType,
          mediaSourceId: ProgramGroupingExternalId.mediaSourceId,
        })
        .from(ProgramGrouping)
        .innerJoin(
          ProgramGroupingExternalId,
          eq(ProgramGroupingExternalId.groupUuid, ProgramGrouping.uuid),
        )
        .leftJoin(Artwork, eq(Artwork.groupingId, ProgramGrouping.uuid))
        .where(
          and(
            isNull(Artwork.uuid),
            inArray(ProgramGroupingExternalId.sourceType, [
              'plex',
              'jellyfin',
              'emby',
            ]),
            isNotNull(ProgramGroupingExternalId.externalKey),
            isNotNull(ProgramGroupingExternalId.mediaSourceId),
            cursor === undefined ? undefined : gt(ProgramGrouping.uuid, cursor),
          ),
        )
        .orderBy(ProgramGrouping.uuid)
        .limit(Math.min(SELECT_BATCH_SIZE, budget.remaining))
        .all();

      if (batch.length === 0) {
        break;
      }

      cursor = batch[batch.length - 1]!.uuid;
      budget.remaining -= batch.length;

      // A grouping can carry several external ids; one artwork row per grouping
      // is enough, and a duplicate would violate nothing but is wasted work.
      const seen = new Set<string>();
      const unique = batch.filter((grouping) => {
        if (seen.has(grouping.uuid)) {
          return false;
        }
        seen.add(grouping.uuid);
        return true;
      });

      const artworkRecords = this.buildGroupingArtwork(unique);
      written += this.insertArtwork(artworkRecords);

      if (batch.length < SELECT_BATCH_SIZE) {
        break;
      }

      await throttle();
    }

    return written;
  }

  private buildProgramArtwork(
    rows: {
      uuid: string;
      externalKey: string;
      sourceType: string;
      mediaSourceId: MediaSourceId | null;
    }[],
  ): NewArtwork[] {
    const mediaSources = this.loadMediaSources(rows);
    const records: NewArtwork[] = [];

    for (const row of rows) {
      const sourcePath = this.resolveSourcePath(row, mediaSources);
      if (sourcePath === undefined) {
        continue;
      }

      records.push({
        uuid: v4(),
        sourcePath,
        artworkType: 'poster',
        programId: row.uuid,
        groupingId: null,
        cachePath: null,
        creditId: null,
      });
    }

    return records;
  }

  private buildGroupingArtwork(
    rows: {
      uuid: string;
      externalKey: string;
      sourceType: string;
      mediaSourceId: MediaSourceId | null;
    }[],
  ): NewArtwork[] {
    const mediaSources = this.loadMediaSources(rows);
    const records: NewArtwork[] = [];

    for (const row of rows) {
      const sourcePath = this.resolveSourcePath(row, mediaSources);
      if (sourcePath === undefined) {
        continue;
      }

      records.push({
        uuid: v4(),
        sourcePath,
        artworkType: 'poster',
        programId: null,
        groupingId: row.uuid,
        cachePath: null,
        creditId: null,
      });
    }

    return records;
  }

  private loadMediaSources(
    rows: { mediaSourceId: MediaSourceId | null }[],
  ): Map<MediaSourceId, { uri: string; type: string }> {
    const ids = [
      ...new Set(
        rows
          .map((row) => row.mediaSourceId)
          .filter((id): id is MediaSourceId => id !== null),
      ),
    ];

    if (ids.length === 0) {
      return new Map();
    }

    const sources = this.drizzleDB
      .select({
        uuid: MediaSource.uuid,
        uri: MediaSource.uri,
        type: MediaSource.type,
      })
      .from(MediaSource)
      .where(inArray(MediaSource.uuid, ids))
      .all();

    return new Map(
      sources.map((source) => [
        source.uuid,
        { uri: source.uri, type: source.type },
      ]),
    );
  }

  private resolveSourcePath(
    row: { externalKey: string; mediaSourceId: MediaSourceId | null },
    mediaSources: Map<MediaSourceId, { uri: string; type: string }>,
  ): string | undefined {
    if (row.mediaSourceId === null) {
      return undefined;
    }

    const mediaSource = mediaSources.get(row.mediaSourceId);
    if (mediaSource === undefined) {
      return undefined;
    }

    return this.buildArtworkSourcePath(
      mediaSource.uri,
      row.externalKey,
      mediaSource.type,
    );
  }

  private insertArtwork(records: NewArtwork[]): number {
    if (records.length === 0) {
      return 0;
    }

    // One transaction per chunk. Wrapping the whole loop in a single
    // transaction would hold the write lock for the length of the backfill.
    for (const batch of chunk(records, INSERT_CHUNK_SIZE)) {
      this.drizzleDB.transaction(
        (tx) => {
          tx.insert(Artwork).values(batch).run();
        },
        { behavior: 'immediate' },
      );
    }

    return records.length;
  }

  private buildArtworkSourcePath(
    mediaSourceUri: string,
    externalKey: string,
    sourceType: string,
  ): string | undefined {
    return buildArtworkSourcePath(
      mediaSourceUri,
      externalKey,
      sourceType,
      this.logger,
    );
  }
}
