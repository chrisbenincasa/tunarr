import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { ChannelCache } from '@/stream/ChannelCache.js';
import { KEYS } from '@/types/inject.js';
import { isNonEmptyString, programExternalIdString } from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import { ContentProgram } from '@tunarr/types';
import {
  CreateFillerListRequest,
  UpdateFillerListRequest,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { CaseWhenBuilder, Kysely } from 'kysely';
import { jsonArrayFrom, jsonBuildObject } from 'kysely/helpers/sqlite';
import {
  chunk,
  filter,
  find,
  forEach,
  groupBy,
  isEmpty,
  isNil,
  isUndefined,
  map,
  mapValues,
  omitBy,
  reduce,
  reject,
  round,
  uniq,
  values,
} from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
import { v4 } from 'uuid';
import { Maybe, Nilable } from '../types/util.ts';
import { ProgramConverter } from './converters/ProgramConverter.ts';
import {
  FillerShowWithContent,
  IFillerListDB,
} from './interfaces/IFillerListDB.ts';
import { createPendingProgramIndexMap } from './programHelpers.ts';
import { withFillerPrograms } from './programQueryHelpers.ts';
import { ChannelFillerShow } from './schema/ChannelFillerShow.ts';
import type { FillerShow, NewFillerShow } from './schema/FillerShow.ts';
import type { NewFillerShowContent } from './schema/FillerShowContent.ts';
import { DB } from './schema/db.ts';
import type { ChannelFillerShowWithContent } from './schema/derivedTypes.ts';
import { DrizzleDBAccess } from './schema/index.ts';

@injectable()
export class FillerDB implements IFillerListDB {
  constructor(
    @inject(ChannelCache) private channelCache: ChannelCache,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(ProgramConverter) private programConverter: ProgramConverter,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess,
  ) {}

  getFiller(id: string): Promise<Maybe<FillerShowWithContent>> {
    return this.db
      .selectFrom('fillerShow')
      .where('uuid', '=', id)
      .selectAll()
      .select((eb) => withFillerPrograms(eb, { fields: ['program.uuid'] }))
      .executeTakeFirst();
  }

  async getFillerListsByIds(
    ids: string[],
  ): Promise<(FillerShow & { contentCount: number })[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.drizzle.query.fillerShows
      .findMany({
        where: (fields, { inArray }) => inArray(fields.uuid, ids),
        with: {
          fillerShowContent: true,
        },
      })
      .then((result) =>
        result.map((r) => ({
          ...r,
          contentCount: r.fillerShowContent.length,
        })),
      );
  }

  async saveFiller(
    id: string,
    updateRequest: UpdateFillerListRequest,
  ): Promise<Nilable<FillerShowWithContent>> {
    const filler = await this.getFiller(id);

    if (isNil(filler)) {
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

      const persistedFillerShowContent = map(
        persisted,
        (p) =>
          ({
            fillerShowUuid: filler.uuid,
            programUuid: p.id!,
            index: programIndexById[p.id!]!,
          }) satisfies NewFillerShowContent,
      );
      const newFillerShowContent = map(
        upsertedPrograms,
        (p) =>
          ({
            fillerShowUuid: filler.uuid,
            programUuid: p.uuid,
            index: programIndexById[programExternalIdString(p)]!,
          }) satisfies NewFillerShowContent,
      );

      await this.db.transaction().execute(async (tx) => {
        await tx
          .deleteFrom('fillerShowContent')
          .where('fillerShowContent.fillerShowUuid', '=', filler.uuid)
          .execute();
        await Promise.all(
          chunk(
            [...persistedFillerShowContent, ...newFillerShowContent],
            1_000,
          ).map((fsc) =>
            tx.insertInto('fillerShowContent').values(fsc).execute(),
          ),
        );
      });
    }

    if (updateRequest.name) {
      await this.db
        .updateTable('fillerShow')
        .where('uuid', '=', filler.uuid)
        .set({ name: updateRequest.name })
        .execute();
    }

    return await this.getFiller(filler.uuid);
  }

  async createFiller(createRequest: CreateFillerListRequest): Promise<string> {
    const now = +dayjs();
    const filler = {
      uuid: v4(),
      updatedAt: now,
      createdAt: now,
      name: createRequest.name,
    } satisfies NewFillerShow;

    const programIndexById = createPendingProgramIndexMap(
      createRequest.programs,
    );

    const persisted = filter(createRequest.programs, (p) => p.persisted);

    const upsertedPrograms = await this.programDB.upsertContentPrograms(
      createRequest.programs,
    );

    await this.db.insertInto('fillerShow').values(filler).execute();

    const persistedFillerShowContent = map(
      persisted,
      (p) =>
        ({
          fillerShowUuid: filler.uuid,
          programUuid: p.id!,
          index: programIndexById[p.id!]!,
        }) satisfies NewFillerShowContent,
    );
    const newFillerShowContent = map(
      upsertedPrograms,
      (p) =>
        ({
          fillerShowUuid: filler.uuid,
          programUuid: p.uuid,
          index: programIndexById[programExternalIdString(p)]!,
        }) satisfies NewFillerShowContent,
    );

    await Promise.all(
      chunk(
        [...persistedFillerShowContent, ...newFillerShowContent],
        1_000,
      ).map((fsc) =>
        this.db.insertInto('fillerShowContent').values(fsc).execute(),
      ),
    );

    return filler.uuid;
  }

  // Returns all channels a given filler list is a part of
  async getFillerChannels(
    id: string,
  ): Promise<Array<{ number: number; name: string }>> {
    return this.db
      .selectFrom('channelFillerShow')
      .where('channelFillerShow.fillerShowUuid', '=', id)
      .innerJoin('channel', 'channel.uuid', 'channelFillerShow.channelUuid')
      .select(['channel.name', 'channel.number'])
      .execute();
  }

  async deleteFiller(id: string): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      const relevantChannelFillers = await tx
        .selectFrom('channelFillerShow')
        .selectAll()
        .where('fillerShowUuid', '=', id)
        .execute();

      const allRelevantChannelFillers = await tx
        .selectFrom('channelFillerShow')
        .selectAll()
        .where(
          'channelFillerShow.channelUuid',
          'in',
          uniq(map(relevantChannelFillers, (cf) => cf.channelUuid)),
        )
        .execute();

      const fillersByChannel = groupBy(
        allRelevantChannelFillers,
        (cf) => cf.channelUuid,
      );

      forEach(values(fillersByChannel), (cfs) => {
        const removedWeight = find(
          cfs,
          (cf) => cf.fillerShowUuid === id,
        )?.weight;
        if (isUndefined(removedWeight)) {
          return;
        }
        const remainingFillers = reject(cfs, (cf) => cf.fillerShowUuid === id);
        const distributeWeight =
          remainingFillers.length > 0
            ? round(removedWeight / remainingFillers.length, 2)
            : 0;
        forEach(remainingFillers, (filler) => {
          filler.weight += distributeWeight;
        });
      });

      await tx
        .deleteFrom('channelFillerShow')
        .where('channelFillerShow.fillerShowUuid', '=', id)
        .execute();

      const reminaingChannelFillers = omitBy<ChannelFillerShow[]>(
        mapValues(fillersByChannel, (cfs) =>
          reject(cfs, (cf) => cf.fillerShowUuid === id),
        ),
        isEmpty,
      );

      if (!isEmpty(fillersByChannel) && !isEmpty(reminaingChannelFillers)) {
        await tx
          .updateTable('channelFillerShow')
          .set(({ eb }) => {
            const weight = reduce(
              reminaingChannelFillers,
              (builder, channelFillers) => {
                return reduce(
                  channelFillers,
                  (caseBuilder, channelFiller) =>
                    caseBuilder
                      .when(
                        eb.and([
                          eb(
                            'channelFillerShow.fillerShowUuid',
                            '=',
                            channelFiller.fillerShowUuid,
                          ),
                          eb(
                            'channelFillerShow.channelUuid',
                            '=',
                            channelFiller.channelUuid,
                          ),
                        ]),
                      )
                      .then(channelFiller.weight),
                  builder,
                );
              },
              eb.case() as unknown as CaseWhenBuilder<
                DB,
                'channelFillerShow',
                unknown,
                number
              >,
            )
              .else(eb.ref('channelFillerShow.weight'))
              .end();
            return { weight };
          })
          .execute();
      }

      await tx
        .deleteFrom('fillerShow')
        .where('uuid', '=', id)
        // TODO: Blocked on https://github.com/oven-sh/bun/issues/16909
        // .limit(1)
        .execute();
    });

    this.channelCache.clear();
    return;
  }

  // Specifically cast these down for now because our TaggedType type is not portable
  async getAllFillerIds(): Promise<string[]> {
    const ids = await this.db
      .selectFrom('fillerShow')
      .select(['uuid'])
      .execute();
    return map(ids, 'uuid');
  }

  async getAllFillers() {
    return await this.db
      .selectFrom('fillerShow')
      .selectAll()
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('fillerShowContent')
            .whereRef(
              'fillerShowContent.fillerShowUuid',
              '=',
              'fillerShow.uuid',
            )
            .select('fillerShowContent.programUuid'),
        ).as('content'),
      )
      .groupBy('fillerShow.uuid')
      .orderBy('fillerShow.name asc')
      .execute();
  }

  async getFillerPrograms(
    id: string,
  ): Promise<MarkRequired<ContentProgram, 'id'>[]> {
    const programs = await this.db
      .selectFrom('fillerShow')
      .where('fillerShow.uuid', '=', id)
      .select((eb) =>
        withFillerPrograms(eb, {
          joins: {
            trackAlbum: true,
            trackArtist: true,
            tvShow: true,
            tvSeason: true,
          },
        }),
      )
      .executeTakeFirst();

    return seq.collect(programs?.fillerContent, (program) =>
      this.programConverter.programDaoToContentProgram(program, []),
    );
  }

  async getFillerProgramsOrm(id: string) {
    return await this.drizzle.query.fillerShowContent
      .findMany({
        where: (fields, { eq }) => eq(fields.fillerShowUuid, id),
        with: {
          program: {
            with: {
              album: true,
              artist: true,
              show: true,
              season: true,
              externalIds: true,
            },
          },
        },
      })
      .then((_) => _.map((fc) => fc.program));
  }

  async getFillersFromChannel(
    channelId: string,
  ): Promise<ChannelFillerShowWithContent[]> {
    return this.db
      .selectFrom('channelFillerShow')
      .where('channelFillerShow.channelUuid', '=', channelId)
      .innerJoin(
        'fillerShow',
        'channelFillerShow.fillerShowUuid',
        'fillerShow.uuid',
      )
      .select((eb) =>
        // Build the JSON object manually so we don't have to deal with
        // nulls down the line from a nested select query
        jsonBuildObject({
          uuid: eb.ref('fillerShow.uuid'),
          name: eb.ref('fillerShow.name'),
          createdAt: eb.ref('fillerShow.createdAt'),
          updatedAt: eb.ref('fillerShow.updatedAt'),
        }).as('fillerShow'),
      )
      .innerJoin(
        'fillerShowContent',
        'fillerShowContent.fillerShowUuid',
        'fillerShow.uuid',
      )
      .selectAll(['channelFillerShow'])
      .select(withFillerPrograms)
      .groupBy('fillerShow.uuid')
      .orderBy('fillerShowContent.index asc')
      .execute();
  }
}
