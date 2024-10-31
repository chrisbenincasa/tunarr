import {
  CreateFillerListRequest,
  UpdateFillerListRequest,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import { CaseWhenBuilder } from 'kysely';
import { jsonArrayFrom, jsonBuildObject } from 'kysely/helpers/sqlite';
import {
  filter,
  find,
  forEach,
  groupBy,
  isNil,
  isUndefined,
  map,
  mapValues,
  reduce,
  reject,
  round,
  uniq,
  values,
} from 'lodash-es';
import { v4 } from 'uuid';
import { ChannelCache } from '../stream/ChannelCache.js';
import { isNonEmptyString } from '../util/index.js';
import { ProgramConverter } from './converters/programConverters.js';
import { ChannelFillerShowWithContent } from './direct/derivedTypes.js';
import { directDbAccess } from './direct/directDbAccess.js';
import { withFillerPrograms } from './direct/programQueryHelpers.js';
import {
  NewFillerShow,
  NewFillerShowContent,
} from './direct/schema/FillerShow.js';
import { programExternalIdString } from './direct/schema/Program.js';
import { DB } from './direct/schema/db.js';
import { ProgramDB } from './programDB.js';
import { createPendingProgramIndexMap } from './programHelpers.js';

export class FillerDB {
  #programConverter: ProgramConverter = new ProgramConverter();

  constructor(
    private channelCache: ChannelCache = new ChannelCache(),
    private programDB: ProgramDB = new ProgramDB(),
  ) {}

  getFiller(id: string) {
    return directDbAccess()
      .selectFrom('fillerShow')
      .where('uuid', '=', id)
      .selectAll()
      .select((eb) => withFillerPrograms(eb, { fields: ['program.uuid'] }))
      .executeTakeFirst();
  }

  async saveFiller(id: string, updateRequest: UpdateFillerListRequest) {
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
            index: programIndexById[p.id!],
          }) satisfies NewFillerShowContent,
      );
      const newFillerShowContent = map(
        upsertedPrograms,
        (p) =>
          ({
            fillerShowUuid: filler.uuid,
            programUuid: p.uuid,
            index: programIndexById[programExternalIdString(p)],
          }) satisfies NewFillerShowContent,
      );

      await directDbAccess()
        .transaction()
        .execute(async (tx) => {
          await tx
            .deleteFrom('fillerShowContent')
            .where('fillerShowContent.fillerShowUuid', '=', filler.uuid)
            .execute();
          await directDbAccess()
            .insertInto('fillerShowContent')
            .values([...persistedFillerShowContent, ...newFillerShowContent])
            .execute();
        });
    }

    if (updateRequest.name) {
      await directDbAccess()
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

    await directDbAccess().insertInto('fillerShow').values(filler).execute();

    const persistedFillerShowContent = map(
      persisted,
      (p) =>
        ({
          fillerShowUuid: filler.uuid,
          programUuid: p.id!,
          index: programIndexById[p.id!],
        }) satisfies NewFillerShowContent,
    );
    const newFillerShowContent = map(
      upsertedPrograms,
      (p) =>
        ({
          fillerShowUuid: filler.uuid,
          programUuid: p.uuid,
          index: programIndexById[programExternalIdString(p)],
        }) satisfies NewFillerShowContent,
    );

    await directDbAccess()
      .insertInto('fillerShowContent')
      .values([...persistedFillerShowContent, ...newFillerShowContent])
      .execute();

    return filler.uuid;
  }

  // Returns all channels a given filler list is a part of
  async getFillerChannels(id: string) {
    return directDbAccess()
      .selectFrom('channelFillerShow')
      .where('channelFillerShow.fillerShowUuid', '=', id)
      .innerJoin('channel', 'channel.uuid', 'channelFillerShow.channelUuid')
      .select(['channel.name', 'channel.number'])
      .execute();
  }

  async deleteFiller(id: string): Promise<void> {
    await directDbAccess()
      .transaction()
      .execute(async (tx) => {
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
          const removedWeight = find(cfs, (cf) => cf.fillerShowUuid === id)
            ?.weight;
          if (isUndefined(removedWeight)) {
            return;
          }
          const remainingFillers = reject(
            cfs,
            (cf) => cf.fillerShowUuid === id,
          );
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

        await tx
          .updateTable('channelFillerShow')
          .set(({ eb }) => {
            const weight = reduce(
              mapValues(fillersByChannel, (cfs) =>
                reject(cfs, (cf) => cf.fillerShowUuid === id),
              ),
              (builder, v) => {
                return reduce(
                  v,
                  (b, cf) =>
                    b
                      .when(
                        eb.and([
                          eb(
                            'channelFillerShow.fillerShowUuid',
                            '=',
                            cf.fillerShowUuid,
                          ),
                          eb(
                            'channelFillerShow.channelUuid',
                            '=',
                            cf.channelUuid,
                          ),
                        ]),
                      )
                      .then(cf.weight),
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
      });

    this.channelCache.clear();
    return;
  }

  // Specifically cast these down for now because our TaggedType type is not portable
  async getAllFillerIds(): Promise<string[]> {
    const ids = await directDbAccess()
      .selectFrom('fillerShow')
      .select(['uuid'])
      .execute();
    return map(ids, 'uuid');
  }

  async getAllFillers() {
    return await directDbAccess()
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
      .execute();
  }

  async getFillerPrograms(id: string) {
    const programs = await directDbAccess()
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

    return map(programs?.fillerContent, (program) =>
      this.#programConverter.directEntityToContentProgramSync(program, []),
    );
  }

  async getFillersFromChannel(
    channelId: string,
  ): Promise<ChannelFillerShowWithContent[]> {
    return directDbAccess()
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
