import type { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import { KEYS } from '@/types/inject.js';
import type { Maybe } from '@/types/util.js';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import { chunk, isEmpty, uniq } from 'lodash-es';
import type { MarkRequired } from 'ts-essentials';
import type { ProgramExternalId } from '../schema/ProgramExternalId.ts';
import { ProgramGroupingType } from '../schema/ProgramGrouping.ts';
import type { DB } from '../schema/db.ts';
import type { ProgramWithRelationsOrm } from '../schema/derivedTypes.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';

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
  ): Promise<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[]> {
    const results: MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[] = [];
    for (const idChunk of chunk(uniq(ids), batchSize)) {
      const res = await this.drizzleDB.query.program.findMany({
        where: (fields, { inArray }) => inArray(fields.uuid, idChunk),
        with: {
          album: {
            with: {
              externalIds: true,
              artwork: true,
            },
          },
          artist: {
            with: {
              externalIds: true,
            },
          },
          season: {
            with: {
              externalIds: true,
            },
          },
          show: {
            with: {
              externalIds: true,
              artwork: true,
              tags: {
                with: {
                  tag: true,
                },
              },
              genres: {
                with: {
                  genre: true,
                },
              },
            },
          },
          externalIds: true,
          artwork: true,
          credits: {
            with: {
              artwork: true,
            },
          },
          genres: {
            with: {
              genre: true,
            },
          },
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
