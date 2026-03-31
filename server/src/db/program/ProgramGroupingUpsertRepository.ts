import type {
  ProgramGroupingExternalIdLookup,
  UpsertResult,
} from '@/db/interfaces/IProgramDB.js';
import { KEYS } from '@/types/inject.js';
import { devAssert } from '@/util/debug.js';
import { seq } from '@tunarr/shared/util';
import { untag } from '@tunarr/types';
import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import type { RunResult } from 'better-sqlite3';
import { and, isNull as dbIsNull, eq, or, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { inject, injectable } from 'inversify';
import type { InsertResult, Kysely } from 'kysely';
import {
  chunk,
  compact,
  head,
  isNil,
  keys,
  omit,
  partition,
  uniq,
} from 'lodash-es';
import { P, match } from 'ts-pattern';
import { groupByUniq, isDefined } from '../../util/index.ts';
import {
  ProgramGrouping,
  type NewProgramGroupingOrm,
  type ProgramGroupingOrm,
} from '../schema/ProgramGrouping.ts';
import {
  ProgramGroupingExternalId,
  toInsertableProgramGroupingExternalId,
  type NewProgramGroupingExternalId,
  type NewSingleOrMultiProgramGroupingExternalId,
  type ProgramGroupingExternalIdOrm,
} from '../schema/ProgramGroupingExternalId.ts';
import type { DB } from '../schema/db.ts';
import type {
  NewProgramGroupingWithRelations,
  ProgramGroupingOrmWithRelations,
} from '../schema/derivedTypes.ts';
import type { DrizzleDBAccess, schema } from '../schema/index.ts';
import { ProgramMetadataRepository } from './ProgramMetadataRepository.ts';

@injectable()
export class ProgramGroupingUpsertRepository {
  constructor(
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
    @inject(KEYS.ProgramMetadataRepository)
    private metadataRepo: ProgramMetadataRepository,
  ) {}

  async upsertProgramGrouping(
    newGroupingAndRelations: NewProgramGroupingWithRelations,
    forceUpdate: boolean = false,
  ): Promise<UpsertResult<ProgramGroupingOrmWithRelations>> {
    let entity: ProgramGroupingOrmWithRelations | undefined =
      await this.getProgramGrouping(
        newGroupingAndRelations.programGrouping.uuid,
      );
    let shouldUpdate = forceUpdate;
    let wasInserted = false,
      wasUpdated = false;
    const { programGrouping: dao, externalIds } = newGroupingAndRelations;

    if (!entity && dao.sourceType === 'local') {
      const incomingYear = newGroupingAndRelations.programGrouping.year;
      entity = await this.drizzleDB.query.programGrouping.findFirst({
        where: (fields, { eq, and, isNull }) => {
          const parentClause = match(newGroupingAndRelations.programGrouping)
            .with({ type: 'season', showUuid: P.nonNullable }, (season) =>
              compact([
                eq(fields.showUuid, season.showUuid),
                season.index ? eq(fields.index, season.index) : null,
              ]),
            )
            .with({ type: 'album', artistUuid: P.nonNullable }, (album) => [
              eq(fields.artistUuid, album.artistUuid),
            ])
            .otherwise(() => []);
          return and(
            eq(
              fields.libraryId,
              newGroupingAndRelations.programGrouping.libraryId,
            ),
            eq(fields.title, newGroupingAndRelations.programGrouping.title),
            eq(fields.type, newGroupingAndRelations.programGrouping.type),
            eq(fields.sourceType, 'local'),
            isNil(incomingYear)
              ? isNull(fields.year)
              : eq(fields.year, incomingYear),
            ...parentClause,
          );
        },
        with: {
          externalIds: true,
        },
      });
    } else if (!entity && dao.sourceType !== 'local') {
      entity = await this.getProgramGroupingByExternalId({
        sourceType: dao.sourceType,
        externalKey: dao.externalKey,
        externalSourceId: dao.mediaSourceId,
      });
      if (entity) {
        const missingAssociation =
          (entity.type === 'season' &&
            isDefined(dao.showUuid) &&
            dao.showUuid !== entity.showUuid) ||
          (entity.type === 'album' &&
            isDefined(dao.artistUuid) &&
            dao.artistUuid !== entity.artistUuid);
        const differentVersion = entity.canonicalId !== dao.canonicalId;
        shouldUpdate ||= differentVersion || missingAssociation;
      }
    }

    if (entity && shouldUpdate) {
      newGroupingAndRelations.programGrouping.uuid = entity.uuid;
      for (const externalId of newGroupingAndRelations.externalIds) {
        externalId.groupUuid = entity.uuid;
      }
      entity = await this.drizzleDB.transaction(async (tx) => {
        const updated = await this.updateProgramGrouping(
          newGroupingAndRelations,
          entity!,
          tx,
        );
        const upsertedExternalIds = await this.updateProgramGroupingExternalIds(
          entity!.externalIds,
          externalIds,
          tx,
        );
        return {
          ...updated,
          externalIds: upsertedExternalIds,
        } satisfies ProgramGroupingOrmWithRelations;
      });

      wasUpdated = true;
    } else if (!entity) {
      entity = await this.drizzleDB.transaction(async (tx) => {
        const grouping = head(
          await tx
            .insert(ProgramGrouping)
            .values(omit(dao, 'externalIds'))
            .returning(),
        )!;
        const insertedExternalIds: ProgramGroupingExternalIdOrm[] = [];
        if (externalIds.length > 0) {
          insertedExternalIds.push(
            ...(await this.upsertProgramGroupingExternalIdsChunkOrm(
              externalIds,
              tx,
            )),
          );
        }

        return {
          ...grouping,
          externalIds: insertedExternalIds,
        } satisfies ProgramGroupingOrmWithRelations;
      });

      wasInserted = true;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      newGroupingAndRelations.credits.forEach((credit) => {
        credit.credit.groupingId = entity.uuid;
      });

      newGroupingAndRelations.artwork.forEach((artwork) => {
        artwork.groupingId = entity.uuid;
      });

      await this.metadataRepo.upsertCredits(
        newGroupingAndRelations.credits.map(({ credit }) => credit),
      );

      await this.metadataRepo.upsertArtwork(
        newGroupingAndRelations.artwork.concat(
          newGroupingAndRelations.credits.flatMap(({ artwork }) => artwork),
        ),
      );

      await this.metadataRepo.upsertProgramGroupingGenres(
        entity.uuid,
        newGroupingAndRelations.genres,
      );

      await this.metadataRepo.upsertProgramGroupingStudios(
        entity.uuid,
        newGroupingAndRelations.studios,
      );

      await this.metadataRepo.upsertProgramGroupingTags(
        entity.uuid,
        newGroupingAndRelations.tags,
      );
    }

    return {
      entity: entity,
      wasInserted,
      wasUpdated,
    };
  }

  private async getProgramGrouping(
    id: string,
  ): Promise<ProgramGroupingOrmWithRelations | undefined> {
    return this.drizzleDB.query.programGrouping.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
      with: {
        externalIds: true,
        artwork: true,
      },
    });
  }

  private async getProgramGroupingByExternalId(
    eid: ProgramGroupingExternalIdLookup,
  ): Promise<ProgramGroupingOrmWithRelations | undefined> {
    return await this.drizzleDB.query.programGroupingExternalId
      .findFirst({
        where: (row, { and, or, eq }) =>
          and(
            eq(row.externalKey, eid.externalKey),
            eq(row.sourceType, eid.sourceType),
            or(
              eq(row.externalSourceId, untag(eid.externalSourceId)),
              eq(row.mediaSourceId, eid.externalSourceId),
            ),
          ),
        with: {
          grouping: {
            with: {
              externalIds: true,
            },
          },
        },
      })
      .then((result) => result?.grouping ?? undefined);
  }

  private async updateProgramGrouping(
    { programGrouping: incoming }: NewProgramGroupingWithRelations,
    existing: ProgramGroupingOrmWithRelations,
    tx: BaseSQLiteDatabase<'sync', RunResult, typeof schema> = this.drizzleDB,
  ): Promise<ProgramGroupingOrm> {
    const update: NewProgramGroupingOrm = {
      ...omit(existing, 'externalIds'),
      index: incoming.index,
      title: incoming.title,
      summary: incoming.summary,
      icon: incoming.icon,
      year: incoming.year,
      artistUuid: incoming.artistUuid,
      showUuid: incoming.showUuid,
      canonicalId: incoming.canonicalId,
      mediaSourceId: incoming.mediaSourceId,
      libraryId: incoming.libraryId,
      sourceType: incoming.sourceType,
      externalKey: incoming.externalKey,
      plot: incoming.plot,
      rating: incoming.rating,
      releaseDate: incoming.releaseDate,
      tagline: incoming.tagline,
      updatedAt: incoming.updatedAt,
      state: incoming.state,
    };

    return head(
      await tx
        .update(ProgramGrouping)
        .set(update)
        .where(eq(ProgramGrouping.uuid, existing.uuid))
        .limit(1)
        .returning(),
    )!;
  }

  private async updateProgramGroupingExternalIds(
    existingIds: ProgramGroupingExternalId[],
    newIds: NewSingleOrMultiProgramGroupingExternalId[],
    tx: BaseSQLiteDatabase<'sync', RunResult, typeof schema> = this.drizzleDB,
  ): Promise<ProgramGroupingExternalIdOrm[]> {
    devAssert(
      uniq(seq.collect(existingIds, (id) => id.mediaSourceId)).length <= 1,
    );
    devAssert(uniq(existingIds.map((id) => id.libraryId)).length <= 1);
    devAssert(uniq(newIds.map((id) => id.libraryId)).length <= 1);

    const newByUniqueId: Record<
      string,
      NewSingleOrMultiProgramGroupingExternalId
    > = groupByUniq(newIds, (id) => {
      switch (id.type) {
        case 'single':
          return id.sourceType;
        case 'multi':
          return `${id.sourceType}|${id.mediaSourceId}`;
      }
    });
    const newUniqueIds = new Set(keys(newByUniqueId));

    const existingByUniqueId: Record<string, ProgramGroupingExternalId> =
      groupByUniq(existingIds, (id) => {
        if (isValidSingleExternalIdType(id.sourceType)) {
          return id.sourceType;
        } else {
          return `${id.sourceType}|${id.mediaSourceId}`;
        }
      });
    const existingUniqueIds = new Set(keys(existingByUniqueId));

    const deletedUniqueKeys = existingUniqueIds.difference(newUniqueIds);
    const addedUniqueKeys = newUniqueIds.difference(existingUniqueIds);
    const updatedKeys = existingUniqueIds.intersection(newUniqueIds);

    const deletedIds = [...deletedUniqueKeys.values()].map(
      (key) => existingByUniqueId[key]!,
    );
    await Promise.all(
      chunk(deletedIds, 100).map((idChunk) => {
        const clauses = idChunk.map((id) =>
          and(
            id.mediaSourceId
              ? eq(ProgramGroupingExternalId.mediaSourceId, id.mediaSourceId)
              : dbIsNull(ProgramGroupingExternalId.mediaSourceId),
            id.libraryId
              ? eq(ProgramGroupingExternalId.libraryId, id.libraryId)
              : dbIsNull(ProgramGroupingExternalId.libraryId),
            eq(ProgramGroupingExternalId.externalKey, id.externalKey),
            id.externalSourceId
              ? eq(
                  ProgramGroupingExternalId.externalSourceId,
                  id.externalSourceId,
                )
              : dbIsNull(ProgramGroupingExternalId.externalSourceId),
            eq(ProgramGroupingExternalId.sourceType, id.sourceType),
          ),
        );

        return tx
          .delete(ProgramGroupingExternalId)
          .where(or(...clauses))
          .execute();
      }),
    );

    const addedIds = [...addedUniqueKeys.union(updatedKeys).values()].map(
      (key) => newByUniqueId[key]!,
    );

    return await Promise.all(
      chunk(addedIds, 100).map((idChunk) =>
        this.upsertProgramGroupingExternalIdsChunkOrm(idChunk, tx),
      ),
    ).then((_) => _.flat());
  }

  async upsertProgramGroupingExternalIdsChunkOrm(
    ids: (
      | NewSingleOrMultiProgramGroupingExternalId
      | NewProgramGroupingExternalId
    )[],
    tx: BaseSQLiteDatabase<'sync', RunResult, typeof schema> = this.drizzleDB,
  ): Promise<ProgramGroupingExternalIdOrm[]> {
    if (ids.length === 0) {
      return [];
    }

    const [singles, multiples] = partition(ids, (id) =>
      isValidSingleExternalIdType(id.sourceType),
    );

    const promises: Promise<ProgramGroupingExternalIdOrm[]>[] = [];

    if (singles.length > 0) {
      promises.push(
        tx
          .insert(ProgramGroupingExternalId)
          .values(singles.map(toInsertableProgramGroupingExternalId))
          .onConflictDoUpdate({
            target: [
              ProgramGroupingExternalId.groupUuid,
              ProgramGroupingExternalId.sourceType,
            ],
            targetWhere: sql`media_source_id is null`,
            set: {
              updatedAt: sql`excluded.updated_at`,
              externalFilePath: sql`excluded.external_file_path`,
              groupUuid: sql`excluded.group_uuid`,
              externalKey: sql`excluded.external_key`,
            },
          })
          .returning()
          .execute(),
      );
    }

    if (multiples.length > 0) {
      promises.push(
        tx
          .insert(ProgramGroupingExternalId)
          .values(multiples.map(toInsertableProgramGroupingExternalId))
          .onConflictDoUpdate({
            target: [
              ProgramGroupingExternalId.groupUuid,
              ProgramGroupingExternalId.sourceType,
              ProgramGroupingExternalId.mediaSourceId,
            ],
            targetWhere: sql`media_source_id is not null`,
            set: {
              updatedAt: sql`excluded.updated_at`,
              externalFilePath: sql`excluded.external_file_path`,
              groupUuid: sql`excluded.group_uuid`,
              externalKey: sql`excluded.external_key`,
            },
          })
          .returning()
          .execute(),
      );
    }

    return (await Promise.all(promises)).flat();
  }

  async upsertProgramGroupingExternalIdsChunk(
    ids: (
      | NewSingleOrMultiProgramGroupingExternalId
      | NewProgramGroupingExternalId
    )[],
    tx: Kysely<DB> = this.db,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const [singles, multiples] = partition(ids, (id) =>
      isValidSingleExternalIdType(id.sourceType),
    );

    const promises: Promise<InsertResult>[] = [];

    if (singles.length > 0) {
      promises.push(
        tx
          .insertInto('programGroupingExternalId')
          .values(singles.map(toInsertableProgramGroupingExternalId))
          .onConflict((oc) =>
            oc
              .columns(['groupUuid', 'sourceType'])
              .where('mediaSourceId', 'is', null)
              .doUpdateSet((eb) => ({
                updatedAt: eb.ref('excluded.updatedAt'),
                externalFilePath: eb.ref('excluded.externalFilePath'),
                groupUuid: eb.ref('excluded.groupUuid'),
                externalKey: eb.ref('excluded.externalKey'),
              })),
          )
          .executeTakeFirstOrThrow(),
      );
    }

    if (multiples.length > 0) {
      promises.push(
        tx
          .insertInto('programGroupingExternalId')
          .values(multiples.map(toInsertableProgramGroupingExternalId))
          .onConflict((oc) =>
            oc
              .columns(['groupUuid', 'sourceType', 'mediaSourceId'])
              .where('mediaSourceId', 'is not', null)
              .doUpdateSet((eb) => ({
                updatedAt: eb.ref('excluded.updatedAt'),
                externalFilePath: eb.ref('excluded.externalFilePath'),
                groupUuid: eb.ref('excluded.groupUuid'),
                externalKey: eb.ref('excluded.externalKey'),
              })),
          )
          .executeTakeFirstOrThrow(),
      );
    }

    await Promise.all(promises);
  }
}
