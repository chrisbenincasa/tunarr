import { KEYS } from '@/types/inject.js';
import { isNonEmptyString } from '@/util/index.js';
import { createExternalId } from '@tunarr/shared';
import {
  ContentProgram,
  isContentProgram,
  isCustomProgram,
  tag,
} from '@tunarr/types';
import {
  CreateCustomShowRequest,
  UpdateCustomShowRequest,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { chunk, isNil, orderBy, partition } from 'lodash-es';
import { v4 } from 'uuid';
import { IProgramDB } from './interfaces/IProgramDB.ts';
import {
  AllProgramJoins,
  withCustomShowPrograms,
} from './programQueryHelpers.ts';
import { MediaSourceId, MediaSourceType } from './schema/base.ts';
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
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
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
      await this.upsertCustomShowContent(show.uuid, updateRequest.programs);
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

    await this.db.insertInto('customShow').values(show).execute();

    await this.upsertCustomShowContent(show.uuid, createRequest.programs);

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
        eb.fn.count<number>('customShowContent.contentUuid').as('contentCount'),
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

  private async upsertCustomShowContent(
    customShowId: string,
    programs: ContentProgram[],
  ) {
    if (programs.length === 0) {
      return;
    }
    const newProgramIndexesById = new Map<string, number[]>();
    for (let i = 0; i < programs.length; i++) {
      const program = programs[i]!;
      if (
        (program.persisted ||
          isCustomProgram(program) ||
          program.externalSourceType === 'local') &&
        isNonEmptyString(program.id)
      ) {
        const existing = newProgramIndexesById.get(program.id) ?? [];
        existing.push(i);
        newProgramIndexesById.set(program.id, existing);
      } else if (
        isContentProgram(program) &&
        program.externalSourceType !== 'local'
      ) {
        const key = createExternalId(
          program.externalSourceType,
          tag(program.externalSourceId),
          program.externalKey,
        );
        const existing = newProgramIndexesById.get(key) ?? [];
        existing.push(i);
        newProgramIndexesById.set(key, existing);
      }
    }

    const [persisted, needsPersist] = partition(
      programs,
      (p) => p.persisted && isNonEmptyString(p.id),
    );
    const upsertedPrograms =
      await this.programDB.upsertContentPrograms(needsPersist);
    const allPrograms: {
      uuid: string;
      sourceType: MediaSourceType;
      mediaSourceId: MediaSourceId;
      externalKey: string;
    }[] = persisted
      .map((p) => ({
        uuid: p.id!,
        sourceType: p.externalSourceType,
        mediaSourceId: tag<MediaSourceId>(p.externalSourceId),
        externalKey: p.externalKey,
      }))
      .concat(upsertedPrograms);

    const allNewCustomContent = orderBy(
      allPrograms.flatMap((program) => {
        let indexes = newProgramIndexesById.get(program.uuid);
        if (!indexes && program.sourceType !== 'local') {
          const externalId = createExternalId(
            program.sourceType,
            program.mediaSourceId,
            program.externalKey,
          );
          indexes = newProgramIndexesById.get(externalId);
        }
        if (!indexes) {
          return [];
        }
        return indexes.map(
          (index) =>
            ({
              customShowUuid: customShowId,
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
          .where('customShowContent.customShowUuid', '=', customShowId)
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
}
