import type { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import { KEYS } from '@/types/inject.js';
import type { Maybe } from '@/types/util.js';
import type { ProgramExternalId } from '../schema/ProgramExternalId.ts';
import { ProgramGroupingType } from '../schema/ProgramGrouping.ts';
import type { ProgramWithRelationsOrm } from '../schema/derivedTypes.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';
import type { DB } from '../schema/db.ts';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import { chunk, isEmpty } from 'lodash-es';
import type { MarkRequired } from 'ts-essentials';

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
        externalIds: true,
        artwork: true,
        subtitles: true,
        credits: true,
        versions: {
          with: {
            mediaStreams: true,
            mediaFiles: true,
            chapters: true,
          },
        },
      },
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
  ): Promise<ProgramWithRelationsOrm[]> {
    const results: ProgramWithRelationsOrm[] = [];
    for (const idChunk of chunk(ids, batchSize)) {
      const res = await this.drizzleDB.query.program.findMany({
        where: (fields, { inArray }) => inArray(fields.uuid, idChunk),
        with: {
          album: {
            with: {
              artwork: true,
            },
          },
          artist: true,
          season: true,
          show: {
            with: {
              artwork: true,
            },
          },
          externalIds: true,
          artwork: true,
          tags: {
            with: {
              tag: true,
            },
          },
        },
      });
      results.push(...res);
    }
    return results;
  }
}
