import { KEYS } from '@/types/inject.js';
import { isNonEmptyString } from '@/util/index.js';
import { CustomProgram } from '@tunarr/types';
import {
  CreateCustomShowRequest,
  UpdateCustomShowRequest,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { filter, isNil, map } from 'lodash-es';
import { v4 } from 'uuid';
import { getDatabase } from './DBAccess.ts';
import { ProgramDB } from './ProgramDB.ts';
import { ProgramConverter } from './converters/ProgramConverter.ts';
import { createPendingProgramIndexMap } from './programHelpers.ts';
import {
  AllProgramJoins,
  withCustomShowPrograms,
} from './programQueryHelpers.ts';
import type {
  NewCustomShow,
  NewCustomShowContent,
} from './schema/CustomShow.ts';
import { programExternalIdString } from './schema/Program.ts';

@injectable()
export class CustomShowDB {
  @inject(ProgramConverter) private programConverter: ProgramConverter;

  constructor(@inject(KEYS.ProgramDB) private programDB: ProgramDB) {}

  async getShow(id: string) {
    return getDatabase()
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

  async getShowPrograms(id: string): Promise<CustomProgram[]> {
    const programs = await getDatabase()
      .selectFrom('customShow')
      .where('customShow.uuid', '=', id)
      .select((eb) => withCustomShowPrograms(eb, { joins: AllProgramJoins }))
      .executeTakeFirst();

    return map(programs?.customShowContent, (csc) => ({
      type: 'custom' as const,
      persisted: true,
      duration: csc.duration,
      program: this.programConverter.programDaoToContentProgram(csc, []),
      customShowId: id,
      index: csc.index,
      id: csc.uuid,
    }));
  }

  async saveShow(id: string, updateRequest: UpdateCustomShowRequest) {
    const show = await this.getShow(id);

    if (isNil(show)) {
      return null;
    }

    if (updateRequest.programs) {
      const programIndexById = createPendingProgramIndexMap(
        updateRequest.programs,
      );

      const persisted = filter(
        updateRequest.programs,
        (p) => p.persisted && isNonEmptyString(p.id),
      );

      const upsertedPrograms = await this.programDB.upsertContentPrograms(
        updateRequest.programs,
      );

      const persistedCustomShowContent = map(
        persisted,
        (p) =>
          ({
            customShowUuid: show.uuid,
            contentUuid: p.id!,
            index: programIndexById[p.id!],
          }) satisfies NewCustomShowContent,
      );

      const newCustomShowContent = map(
        upsertedPrograms,
        (p) =>
          ({
            customShowUuid: show.uuid,
            contentUuid: p.uuid,
            index: programIndexById[programExternalIdString(p)],
          }) satisfies NewCustomShowContent,
      );

      await getDatabase()
        .transaction()
        .execute(async (tx) => {
          await tx
            .deleteFrom('customShowContent')
            .where('customShowContent.customShowUuid', '=', show.uuid)
            .execute();
          await tx
            .insertInto('customShowContent')
            .values([...persistedCustomShowContent, ...newCustomShowContent])
            .execute();
        });
    }

    if (updateRequest.name) {
      await getDatabase()
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

    await getDatabase().insertInto('customShow').values(show).execute();

    const persistedCustomShowContent = map(
      persisted,
      (p) =>
        ({
          customShowUuid: show.uuid,
          contentUuid: p.id!,
          index: programIndexById[p.id!],
        }) satisfies NewCustomShowContent,
    );
    const newCustomShowContent = map(
      upsertedPrograms,
      (p) =>
        ({
          customShowUuid: show.uuid,
          contentUuid: p.uuid,
          index: programIndexById[programExternalIdString(p)],
        }) satisfies NewCustomShowContent,
    );

    await getDatabase()
      .insertInto('customShowContent')
      .values([...persistedCustomShowContent, ...newCustomShowContent])
      .execute();

    return show.uuid;
  }

  async deleteShow(id: string) {
    const show = await this.getShow(id);
    if (!show) {
      return false;
    }

    await getDatabase()
      .transaction()
      .execute(async (tx) => {
        // TODO: Do this deletion in the DB with foreign keys.
        await tx
          .deleteFrom('channelCustomShows')
          .where('customShowUuid', '=', show.uuid)
          .execute();
        await tx
          .deleteFrom('customShowContent')
          .where('customShowContent.customShowUuid', '=', show.uuid)
          .execute();
        await tx
          .deleteFrom('customShow')
          .where('uuid', '=', show.uuid)
          .execute();
      });

    return true;
  }

  async getAllShowIds() {
    return getDatabase()
      .selectFrom('customShow')
      .select('uuid')
      .execute()
      .then((_) => _.map((s) => s.uuid));
  }

  getAllShows() {
    return getDatabase().selectFrom('customShow').selectAll().execute();
  }

  async getAllShowsInfo() {
    const showsAndContentCount = await getDatabase()
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
