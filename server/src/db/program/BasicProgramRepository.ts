import type { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import { KEYS } from '@/types/inject.js';
import type { Maybe } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import throttle from '@/util/throttle.js';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import { chunk, isEmpty, uniq } from 'lodash-es';
import type { MarkRequired } from 'ts-essentials';
import type { ProgramExternalId } from '../schema/ProgramExternalId.ts';
import { ProgramGroupingType } from '../schema/ProgramGrouping.ts';
import type { DB } from '../schema/db.ts';
import type {
  ProgramGroupingOrmWithRelations,
  ProgramWithRelationsOrm,
} from '../schema/derivedTypes.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';
import {
  GuideProgramRelations,
  GuideProgramRelationsWithCreditArtwork,
  GuideShowRelations,
  GuideShowRelationsWithCreditArtwork,
  LineupProgramRelations,
  MaterializedProgramRelations,
  ProgramStreamRelations,
  StreamProgramRelations,
} from './programRelations.ts';

@injectable()
export class BasicProgramRepository {
  constructor(
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
  ) {}

  async getProgramById(
    id: string,
  ): Promise<Maybe<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>>> {
    return this.drizzleDB.query.program.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
      with: {
        ...MaterializedProgramRelations,
        ...ProgramStreamRelations,
      },
    });
  }

  async getLineupProgramById(
    id: string,
  ): Promise<Maybe<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>>> {
    return this.drizzleDB.query.program.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
      with: LineupProgramRelations,
    });
  }

  async getStreamProgramById(
    id: string,
  ): Promise<Maybe<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>>> {
    return this.drizzleDB.query.program.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
      with: StreamProgramRelations,
    });
  }

  async getProgramExternalIds(
    id: string,
    externalIdTypes?: ProgramExternalIdType[],
  ): Promise<ProgramExternalId[]> {
    return await this.db
      .selectFrom('programExternalId')
      .selectAll()
      .where('programExternalId.programUuid', '=', id)
      .$if(!isEmpty(externalIdTypes), (qb) =>
        qb.where('programExternalId.sourceType', 'in', externalIdTypes!),
      )
      .execute();
  }

  async getShowIdFromTitle(title: string): Promise<Maybe<string>> {
    const matchedGrouping = await this.db
      .selectFrom('programGrouping')
      .select('uuid')
      .where('title', '=', title)
      .where('type', '=', ProgramGroupingType.Show)
      .executeTakeFirst();

    return matchedGrouping?.uuid;
  }

  async updateProgramDuration(
    programId: string,
    duration: number,
  ): Promise<void> {
    await this.db
      .updateTable('program')
      .where('uuid', '=', programId)
      .set({
        duration,
      })
      .executeTakeFirst();
  }

  async getProgramsByIds(
    ids: string[] | readonly string[],
    batchSize: number = 500,
  ): Promise<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[]> {
    const results: MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[] = [];
    for (const idChunk of chunk(uniq(ids), batchSize)) {
      const res = await this.drizzleDB.query.program.findMany({
        where: (fields, { inArray }) => inArray(fields.uuid, idChunk),
        with: MaterializedProgramRelations,
      });
      results.push(...res);
    }
    return results;
  }

  async getGuideProgramsByIds(
    ids: string[] | readonly string[],
    { includeCreditArtwork }: { includeCreditArtwork: boolean },
    batchSize: number = 200,
  ): Promise<ProgramWithRelationsOrm[]> {
    // better-sqlite3 is synchronous, so awaiting a query never lets other
    // requests in. Yield between chunks so the load runs as short slices.
    const programs: Omit<ProgramWithRelationsOrm, 'show'>[] = [];
    for (const idChunk of chunk(uniq(ids), batchSize)) {
      await throttle();
      const res = includeCreditArtwork
        ? await this.drizzleDB.query.program.findMany({
            where: (fields, { inArray }) => inArray(fields.uuid, idChunk),
            with: GuideProgramRelationsWithCreditArtwork,
          })
        : await this.drizzleDB.query.program.findMany({
            where: (fields, { inArray }) => inArray(fields.uuid, idChunk),
            with: GuideProgramRelations,
          });
      programs.push(...res);
    }

    // Each show loads once and is shared by its episodes.
    const showIds = uniq(
      programs.flatMap(({ tvShowUuid }) =>
        isNonEmptyString(tvShowUuid) ? [tvShowUuid] : [],
      ),
    );
    const showsById: Record<string, ProgramGroupingOrmWithRelations> = {};
    for (const idChunk of chunk(showIds, batchSize)) {
      await throttle();
      const res = includeCreditArtwork
        ? await this.drizzleDB.query.programGrouping.findMany({
            where: (fields, { inArray }) => inArray(fields.uuid, idChunk),
            with: GuideShowRelationsWithCreditArtwork,
          })
        : await this.drizzleDB.query.programGrouping.findMany({
            where: (fields, { inArray }) => inArray(fields.uuid, idChunk),
            with: GuideShowRelations,
          });
      for (const show of res) {
        showsById[show.uuid] = show;
      }
    }

    return programs.map((program) => ({
      ...program,
      show: isNonEmptyString(program.tvShowUuid)
        ? (showsById[program.tvShowUuid] ?? null)
        : null,
    }));
  }

  async getLineupProgramsByIds(
    ids: string[] | readonly string[],
    batchSize: number = 500,
  ): Promise<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[]> {
    const results: MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[] = [];
    for (const idChunk of chunk(uniq(ids), batchSize)) {
      const res = await this.drizzleDB.query.program.findMany({
        where: (fields, { inArray }) => inArray(fields.uuid, idChunk),
        with: LineupProgramRelations,
      });
      results.push(...res);
    }
    return results;
  }

  /**
   * Given an array of program IDs, return the set of those IDs which exist in
   * the database.
   */
  async filterNonExistentProgramIds(
    programIds: string[],
  ): Promise<Set<string>> {
    const uniqIds = uniq(programIds);
    if (uniqIds.length === 0) {
      return new Set();
    }

    const promises = chunk(programIds, 500).map((programChunk) =>
      this.drizzleDB.query.program.findMany({
        where: (fields, { inArray }) => inArray(fields.uuid, programChunk),
        columns: {
          uuid: true,
        },
      }),
    );

    const allPrograms = await Promise.all(promises);

    return new Set([...allPrograms.flat().map(({ uuid }) => uuid)]);
  }
}
