import { KEYS } from '@/types/inject.js';
import { isNonEmptyString, programExternalIdString } from '@/util/index.js';
import { createExternalId } from '@tunarr/shared';
import { isContentProgram, isCustomProgram, tag } from '@tunarr/types';
import {
  CreateCustomShowRequest,
  UpdateCustomShowRequest,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { chunk, filter, isNil, map, orderBy } from 'lodash-es';
import { v4 } from 'uuid';
import { ProgramDB } from './ProgramDB.ts';
import { createPendingProgramIndexMap } from './programHelpers.ts';
import {
  AllProgramJoins,
  withCustomShowPrograms,
} from './programQueryHelpers.ts';
import type { NewCustomShow } from './schema/CustomShow.ts';
import type { NewCustomShowContent } from './schema/CustomShowContent.ts';
import { DB } from './schema/db.ts';
import {
  ProgramWithRelations,
  ProgramWithRelationsOrm,
} from './schema/derivedTypes.ts';
import { DrizzleDBAccess } from './schema/index.ts';

@injectable()
export class CustomShowDB {
  constructor(
    @inject(KEYS.ProgramDB) private programDB: ProgramDB,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess,
  ) {}

  async getShow(id: string) {
    return this.db
      .selectFrom('customShow')
      .selectAll()
      .where('customShow.uuid', '=', id)
      .select((eb) =>
        withCustomShowPrograms(eb, {
          fields: ['program.uuid', 'program.duration'],
        }),
      )
      .executeTakeFirst();
  }

  async getShows(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    return this.drizzle.query.customShow
      .findMany({
        where: (fields, { inArray }) => inArray(fields.uuid, ids),
        with: {
          content: true,
        },
      })
      .then((results) => {
        return results.map((result) => ({
          ...result,
          contentCount: result.content.length,
        }));
      });

    return this.db
      .selectFrom('customShow')
      .where('customShow.uuid', 'in', ids)
      .innerJoin(
        'customShowContent',
        'customShowContent.customShowUuid',
        'customShow.uuid',
      )
      .selectAll('customShow')
      .select((eb) =>
        eb.fn
          .count<number>('customShowContent.contentUuid')
          .distinct()
          .as('contentCount'),
      )
      .execute();
  }

  async getShowPrograms(id: string): Promise<ProgramWithRelations[]> {
    const programs = await this.db
      .selectFrom('customShow')
      .where('customShow.uuid', '=', id)
      .select((eb) => withCustomShowPrograms(eb, { joins: AllProgramJoins }))
      .executeTakeFirst();

    return programs?.customShowContent ?? [];
  }

  async getShowProgramsOrm(id: string): Promise<ProgramWithRelationsOrm[]> {
    const results = await this.drizzle.query.customShowContent.findMany({
      where: (fields, { eq }) => eq(fields.customShowUuid, id),
      with: {
        program: {
          with: {
            album: true,
            artist: true,
            externalIds: true,
            season: true,
            show: true,
          },
        },
      },
      orderBy: (fields, { asc }) => asc(fields.index),
    });
    return results.map((result) => result.program);
  }

  async saveShow(id: string, updateRequest: UpdateCustomShowRequest) {
    const show = await this.getShow(id);

    if (isNil(show)) {
      return null;
    }

    if (updateRequest.programs && updateRequest.programs.length > 0) {
      const newProgramIndexesById: Record<string, number[]> = {};
      for (let i = 0; i < updateRequest.programs.length; i++) {
        const program = updateRequest.programs[i]!;
        if (
          (program.persisted ||
            isCustomProgram(program) ||
            program.externalSourceType === 'local') &&
          isNonEmptyString(program.id)
        ) {
          newProgramIndexesById[program.id] ??= [];
          newProgramIndexesById[program.id]!.push(i);
        } else if (
          isContentProgram(program) &&
          program.externalSourceType !== 'local'
        ) {
          const key = createExternalId(
            program.externalSourceType,
            tag(program.externalSourceId),
            program.externalKey,
          );
          newProgramIndexesById[key] ??= [];
          newProgramIndexesById[key].push(i);
        }
      }

      const upsertedPrograms = await this.programDB.upsertContentPrograms(
        updateRequest.programs,
      );

      const allNewCustomContent = orderBy(
        upsertedPrograms.flatMap((program) => {
          if (program.sourceType === 'local') {
            return [];
          }
          const externalId = createExternalId(
            program.sourceType,
            program.mediaSourceId,
            program.externalKey,
          );
          const indexes =
            newProgramIndexesById[program.uuid] ??
            newProgramIndexesById[externalId];
          if (!indexes) {
            return [];
          }
          return indexes.map(
            (index) =>
              ({
                customShowUuid: show.uuid,
                contentUuid: program.uuid,
                index,
              }) satisfies NewCustomShowContent,
          );
        }),
        (csc) => csc.index,
        'asc',
      ).map((csc, idx) => {
        csc.index = idx;
        return csc;
      });

      await this.db.transaction().execute(async (tx) => {
        if (allNewCustomContent.length > 0) {
          await tx
            .deleteFrom('customShowContent')
            .where('customShowContent.customShowUuid', '=', show.uuid)
            .execute();
          for (const contentChunk of chunk(allNewCustomContent, 1_000)) {
            await tx
              .insertInto('customShowContent')
              .values(contentChunk)
              .execute();
          }
        }
      });
    }

    if (updateRequest.name) {
      await this.db
        .updateTable('customShow')
        .where('uuid', '=', show.uuid)
        .limit(1)
        .set({ name: updateRequest.name })
        .execute();
    }

    return await this.getShow(show.uuid);
  }

  async createShow(createRequest: CreateCustomShowRequest) {
    const now = +dayjs();
    const show = {
      uuid: v4(),
      createdAt: now,
      updatedAt: now,
      name: createRequest.name,
    } satisfies NewCustomShow;

    const programIndexById = createPendingProgramIndexMap(
      createRequest.programs,
    );

    const persisted = filter(createRequest.programs, (p) => p.persisted);

    const upsertedPrograms = await this.programDB.upsertContentPrograms(
      createRequest.programs,
    );

    await this.db.insertInto('customShow').values(show).execute();

    const persistedCustomShowContent = map(
      persisted,
      (p) =>
        ({
          customShowUuid: show.uuid,
          contentUuid: p.id!,
          index: programIndexById[p.id!]!,
        }) satisfies NewCustomShowContent,
    );
    const newCustomShowContent = map(
      upsertedPrograms,
      (p) =>
        ({
          customShowUuid: show.uuid,
          contentUuid: p.uuid,
          index: programIndexById[programExternalIdString(p)]!,
        }) satisfies NewCustomShowContent,
    );

    await Promise.all(
      chunk(
        [...persistedCustomShowContent, ...newCustomShowContent],
        1_000,
      ).map((csc) =>
        this.db.insertInto('customShowContent').values(csc).execute(),
      ),
    );

    return show.uuid;
  }

  async deleteShow(id: string) {
    const show = await this.getShow(id);
    if (!show) {
      return false;
    }

    await this.db.transaction().execute(async (tx) => {
      // TODO: Do this deletion in the DB with foreign keys.
      await tx
        .deleteFrom('channelCustomShows')
        .where('customShowUuid', '=', show.uuid)
        .execute();
      await tx
        .deleteFrom('customShowContent')
        .where('customShowContent.customShowUuid', '=', show.uuid)
        .execute();
      await tx.deleteFrom('customShow').where('uuid', '=', show.uuid).execute();
    });

    return true;
  }

  async getAllShowIds() {
    return this.db
      .selectFrom('customShow')
      .select('uuid')
      .execute()
      .then((_) => _.map((s) => s.uuid));
  }

  getAllShows() {
    return this.db.selectFrom('customShow').selectAll().execute();
  }

  async getAllShowsInfo() {
    const showsAndContentCount = await this.db
      .selectFrom('customShow')
      .selectAll('customShow')
      .innerJoin(
        'customShowContent',
        'customShow.uuid',
        'customShowContent.customShowUuid',
      )
      .groupBy('customShow.uuid')
      .select((eb) => [
        eb.fn
          .count<number>('customShowContent.contentUuid')
          .distinct()
          .as('contentCount'),
        eb.fn
          .sum<number>(
            eb
              .selectFrom('program')
              .whereRef('program.uuid', '=', 'customShowContent.contentUuid')
              .select('duration'),
          )
          .as('totalDuration'),
      ])
      .execute();
    return showsAndContentCount.map((f) => ({
      id: f.uuid,
      name: f.name,
      count: f.contentCount,
      totalDuration: f.totalDuration,
    }));
  }
}
