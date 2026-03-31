import type {
  ProgramCanonicalIdLookupResult,
  ProgramGroupingCanonicalIdLookupResult,
} from '@/db/interfaces/IProgramDB.js';
import { KEYS } from '@/types/inject.js';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import { last } from 'lodash-es';
import type { Dictionary, StrictExclude } from 'ts-essentials';
import { match } from 'ts-pattern';
import {
  AllProgramFields,
  selectProgramsBuilder,
  withProgramExternalIds,
} from '../programQueryHelpers.ts';
import type { ProgramType } from '../schema/Program.ts';
import type { ProgramGroupingType } from '../schema/ProgramGrouping.ts';
import type { MediaSourceId, MediaSourceType } from '../schema/base.ts';
import type { DB } from '../schema/db.ts';
import type { ProgramWithRelations } from '../schema/derivedTypes.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';
import { isDefined } from '../../util/index.ts';
import type { ProgramDao } from '../schema/Program.ts';

@injectable()
export class ProgramSearchRepository {
  constructor(
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
  ) {}

  async getProgramsForMediaSource(
    mediaSourceId: MediaSourceId,
    type?: ProgramType,
  ): Promise<ProgramDao[]> {
    return this.db
      .selectFrom('mediaSource')
      .where('mediaSource.uuid', '=', mediaSourceId)
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('program')
            .select(AllProgramFields)
            .$if(isDefined(type), (eb) => eb.where('program.type', '=', type!))
            .whereRef('mediaSource.uuid', '=', 'program.mediaSourceId'),
        ).as('programs'),
      )
      .executeTakeFirst()
      .then((dbResult) => dbResult?.programs ?? []);
  }

  async getMediaSourceLibraryPrograms(
    libraryId: string,
  ): Promise<ProgramWithRelations[]> {
    return selectProgramsBuilder(this.db, { includeGroupingExternalIds: true })
      .where('libraryId', '=', libraryId)
      .selectAll()
      .select(withProgramExternalIds)
      .execute();
  }

  async getProgramInfoForMediaSource(
    mediaSourceId: MediaSourceId,
    type: ProgramType,
    parentFilter?: [ProgramGroupingType, string],
  ): Promise<Dictionary<ProgramCanonicalIdLookupResult>> {
    const results = await this.drizzleDB.query.program.findMany({
      where: (fields, { eq, and, isNotNull }) => {
        const parentField = match([type, parentFilter?.[0]])
          .with(['episode', 'show'], () => fields.tvShowUuid)
          .with(['episode', 'season'], () => fields.seasonUuid)
          .with(['track', 'album'], () => fields.albumUuid)
          .with(['track', 'artist'], () => fields.artistUuid)
          .otherwise(() => null);

        return and(
          eq(fields.mediaSourceId, mediaSourceId),
          eq(fields.type, type),
          isNotNull(fields.canonicalId),
          parentField && parentFilter
            ? eq(parentField, parentFilter[1])
            : undefined,
        );
      },
    });

    const grouped: Dictionary<ProgramCanonicalIdLookupResult> = {};
    for (const result of results) {
      if (!result.canonicalId || !result.libraryId) {
        continue;
      }
      grouped[result.externalKey] = {
        canonicalId: result.canonicalId,
        externalKey: result.externalKey,
        libraryId: result.libraryId,
        uuid: result.uuid,
      };
    }

    return grouped;
  }

  async getProgramInfoForMediaSourceLibrary(
    mediaSourceLibraryId: string,
    type: ProgramType,
    parentFilter?: [ProgramGroupingType, string],
  ): Promise<Dictionary<ProgramCanonicalIdLookupResult>> {
    const grouped: Dictionary<ProgramCanonicalIdLookupResult> = {};
    for await (const result of this.getProgramInfoForMediaSourceLibraryAsync(
      mediaSourceLibraryId,
      type,
      parentFilter,
    )) {
      grouped[result.externalKey] = {
        canonicalId: result.canonicalId,
        externalKey: result.externalKey,
        libraryId: result.libraryId,
        uuid: result.uuid,
      };
    }

    return grouped;
  }

  async *getProgramInfoForMediaSourceLibraryAsync(
    mediaSourceLibraryId: string,
    type: ProgramType,
    parentFilter?: [ProgramGroupingType, string],
  ): AsyncGenerator<ProgramCanonicalIdLookupResult> {
    let lastId: string | undefined;
    for (;;) {
      const page = await this.drizzleDB.query.program.findMany({
        where: (fields, { eq, and, isNotNull, gt }) => {
          const parentField = match([type, parentFilter?.[0]])
            .with(['episode', 'show'], () => fields.tvShowUuid)
            .with(['episode', 'season'], () => fields.seasonUuid)
            .with(['track', 'album'], () => fields.albumUuid)
            .with(['track', 'artist'], () => fields.artistUuid)
            .otherwise(() => null);

          return and(
            eq(fields.libraryId, mediaSourceLibraryId),
            eq(fields.type, type),
            isNotNull(fields.canonicalId),
            parentField && parentFilter
              ? eq(parentField, parentFilter[1])
              : undefined,
            lastId ? gt(fields.uuid, lastId) : undefined,
          );
        },
        orderBy: (fields, ops) => ops.asc(fields.uuid),
        columns: {
          uuid: true,
          canonicalId: true,
          libraryId: true,
          externalKey: true,
        },
        limit: 500,
      });

      if (page.length === 0) {
        return;
      }

      lastId = last(page)?.uuid;
      for (const item of page) {
        yield {
          externalKey: item.externalKey,
          canonicalId: item.canonicalId,
          uuid: item.uuid,
          libraryId: item.libraryId,
        };
      }
    }
  }

  async getExistingProgramGroupingDetails(
    mediaSourceLibraryId: string,
    type: ProgramGroupingType,
    sourceType: StrictExclude<MediaSourceType, 'local'>,
    parentFilter?: string,
  ): Promise<Dictionary<ProgramGroupingCanonicalIdLookupResult>> {
    const results = await this.drizzleDB.query.programGrouping.findMany({
      where: (fields, { and, eq, isNotNull }) => {
        const parentField = match(type)
          .with('album', () => fields.artistUuid)
          .with('season', () => fields.showUuid)
          .otherwise(() => null);
        return and(
          eq(fields.libraryId, mediaSourceLibraryId),
          eq(fields.type, type),
          isNotNull(fields.canonicalId),
          parentField && parentFilter
            ? eq(parentField, parentFilter)
            : undefined,
        );
      },
      with: {
        externalIds: {
          where: (fields, { eq }) => eq(fields.sourceType, sourceType),
        },
      },
      columns: {
        uuid: true,
        canonicalId: true,
        libraryId: true,
        externalKey: true,
      },
    });

    const grouped: Dictionary<ProgramGroupingCanonicalIdLookupResult> = {};
    for (const result of results) {
      const key = result.externalKey ?? result.externalIds[0]?.externalKey;
      if (!key) {
        continue;
      }

      grouped[key] = {
        canonicalId: result.canonicalId,
        externalKey: key,
        libraryId: result.libraryId!,
        uuid: result.uuid,
      };
    }

    return grouped;
  }
}
