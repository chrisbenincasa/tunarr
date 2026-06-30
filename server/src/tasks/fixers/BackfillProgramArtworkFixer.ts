import { KEYS } from '@/types/inject.js';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
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
import { InjectLogger } from '../../util/inject.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import Fixer from './fixer.ts';

@injectable()
export class BackfillProgramArtworkFixer extends Fixer {
  canRunInBackground = true;

  @InjectLogger() declare protected readonly logger: Logger;

  constructor(@inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess) {
    super();
  }

  protected runInternal(): Promise<void> {
    const programCount = this.backfillProgramArtwork();
    const groupingCount = this.backfillGroupingArtwork();

    if (programCount > 0 || groupingCount > 0) {
      this.logger.info(
        'Backfilled artwork for %d programs and %d groupings',
        programCount,
        groupingCount,
      );
    } else {
      this.logger.debug('No programs or groupings needed artwork backfill');
    }

    return Promise.resolve(void 0);
  }

  private backfillProgramArtwork(): number {
    // Find programs that have no artwork records, have a remote media source,
    // and have the data needed to construct an artwork URL.
    const programsWithoutArtwork = this.drizzleDB
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
        ),
      )
      .all();

    if (programsWithoutArtwork.length === 0) {
      return 0;
    }

    // Collect all unique media source IDs and fetch their URIs in one query
    const mediaSourceIds = [
      ...new Set(
        programsWithoutArtwork
          .map((p) => p.mediaSourceId)
          .filter((id): id is MediaSourceId => id !== null),
      ),
    ];

    if (mediaSourceIds.length === 0) {
      return 0;
    }

    const mediaSources = this.drizzleDB
      .select({
        uuid: MediaSource.uuid,
        uri: MediaSource.uri,
        type: MediaSource.type,
      })
      .from(MediaSource)
      .where(inArray(MediaSource.uuid, mediaSourceIds))
      .all();

    const mediaSourceMap = new Map(mediaSources.map((ms) => [ms.uuid, ms]));

    const artworkRecords: NewArtwork[] = [];

    for (const program of programsWithoutArtwork) {
      if (program.mediaSourceId === null) {
        continue;
      }

      const mediaSource = mediaSourceMap.get(program.mediaSourceId);
      if (mediaSource === undefined) {
        continue;
      }

      const sourcePath = this.buildArtworkSourcePath(
        mediaSource.uri,
        program.externalKey,
        mediaSource.type,
      );

      if (sourcePath === undefined) {
        continue;
      }

      artworkRecords.push({
        uuid: v4(),
        sourcePath,
        artworkType: 'poster',
        programId: program.uuid,
        groupingId: null,
        cachePath: null,
        creditId: null,
      });
    }

    if (artworkRecords.length === 0) {
      return 0;
    }

    this.drizzleDB.transaction((tx) => {
      for (const batch of chunk(artworkRecords, 100)) {
        tx.insert(Artwork).values(batch).run();
      }
    });

    return artworkRecords.length;
  }

  private backfillGroupingArtwork(): number {
    // Find program groupings that have no artwork records, joined with their
    // external IDs to get source type and external key.
    const groupingsWithoutArtwork = this.drizzleDB
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
        ),
      )
      .all();

    if (groupingsWithoutArtwork.length === 0) {
      return 0;
    }

    // Deduplicate by grouping UUID -- a grouping might have multiple external IDs
    // and we only need one artwork record per grouping.
    const seenGroupings = new Set<string>();
    const uniqueGroupings = groupingsWithoutArtwork.filter((g) => {
      if (seenGroupings.has(g.uuid)) {
        return false;
      }
      seenGroupings.add(g.uuid);
      return true;
    });

    // Collect all unique media source IDs and fetch their URIs
    const mediaSourceIds = [
      ...new Set(
        uniqueGroupings
          .map((g) => g.mediaSourceId)
          .filter((id): id is MediaSourceId => id !== null),
      ),
    ];

    if (mediaSourceIds.length === 0) {
      return 0;
    }

    const mediaSources = this.drizzleDB
      .select({
        uuid: MediaSource.uuid,
        uri: MediaSource.uri,
        type: MediaSource.type,
      })
      .from(MediaSource)
      .where(inArray(MediaSource.uuid, mediaSourceIds))
      .all();

    const mediaSourceMap = new Map(mediaSources.map((ms) => [ms.uuid, ms]));

    const artworkRecords: NewArtwork[] = [];

    for (const grouping of uniqueGroupings) {
      if (grouping.mediaSourceId === null) {
        continue;
      }

      const mediaSource = mediaSourceMap.get(grouping.mediaSourceId);
      if (mediaSource === undefined) {
        continue;
      }

      const sourcePath = this.buildArtworkSourcePath(
        mediaSource.uri,
        grouping.externalKey,
        mediaSource.type,
      );

      if (sourcePath === undefined) {
        continue;
      }

      artworkRecords.push({
        uuid: v4(),
        sourcePath,
        artworkType: 'poster',
        programId: null,
        groupingId: grouping.uuid,
        cachePath: null,
        creditId: null,
      });
    }

    if (artworkRecords.length === 0) {
      return 0;
    }

    this.drizzleDB.transaction((tx) => {
      for (const batch of chunk(artworkRecords, 100)) {
        tx.insert(Artwork).values(batch).run();
      }
    });

    return artworkRecords.length;
  }

  private buildArtworkSourcePath(
    mediaSourceUri: string,
    externalKey: string,
    sourceType: string,
  ): string | undefined {
    try {
      switch (sourceType) {
        case 'plex':
          return new URL(
            `/library/metadata/${externalKey}/thumb`,
            mediaSourceUri,
          ).href;
        case 'jellyfin':
        case 'emby':
          return new URL(`/Items/${externalKey}/Images/Primary`, mediaSourceUri)
            .href;
        default:
          return undefined;
      }
    } catch {
      this.logger.warn(
        'Failed to construct artwork URL for source type %s, key %s, uri %s',
        sourceType,
        externalKey,
        mediaSourceUri,
      );
      return undefined;
    }
  }
}
