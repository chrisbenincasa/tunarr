import { KEYS } from '@/types/inject.js';
import type {
  BulkAssignFillersRequest,
  BulkAssignFillersResponse,
  CreateFillerListRequest,
  UpdateFillerListRequest,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import {
  chunk,
  find,
  forEach,
  groupBy,
  head,
  isEmpty,
  isNil,
  isUndefined,
  map,
  mapValues,
  omitBy,
  reject,
  round,
  tail,
  uniq,
  values,
} from 'lodash-es';
import { v4 } from 'uuid';
import { Maybe, Nilable } from '../types/util.ts';
import { caseWhen } from './DrizzleSqlCaseWhen.ts';
import {
  FillerShowWithContent,
  IFillerListDB,
} from './interfaces/IFillerListDB.ts';
import { createPendingProgramIndexMap } from './programHelpers.ts';
import { ChannelFillerShow } from './schema/ChannelFillerShow.ts';
import { FillerShow, NewFillerShow } from './schema/FillerShow.ts';
import {
  FillerShowContent,
  type NewFillerShowContent,
} from './schema/FillerShowContent.ts';
import { DB } from './schema/db.ts';
import type {
  ChannelFillerShowWithContent,
  ProgramOrmWithExternalIds,
} from './schema/derivedTypes.ts';
import { DrizzleDBAccess } from './schema/index.ts';

@injectable()
export class FillerDB implements IFillerListDB {
  constructor(
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess,
  ) {}

  async getFiller(id: string): Promise<Maybe<FillerShowWithContent>> {
    const result = await this.drizzle.query.fillerShows.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
      with: {
        fillerShowContent: {
          with: {
            program: true,
          },
        },
      },
    });

    if (!result) return;

    return {
      ...result,
      fillerContent: result.fillerShowContent.map((content, idx) => ({
        ...content.program,
        index: idx,
      })),
    } satisfies FillerShowWithContent;
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

      const persistedFillerShowContent = map(
        updateRequest.programs,
        (p) =>
          ({
            fillerShowUuid: filler.uuid,
            programUuid: p.id,
            index: programIndexById[p.id]!,
          }) satisfies NewFillerShowContent,
      );

      this.drizzle.transaction((tx) => {
        tx.delete(FillerShowContent)
          .where(eq(FillerShowContent.fillerShowUuid, filler.uuid))
          .run();

        for (const fsc of chunk(persistedFillerShowContent, 1_000)) {
          tx.insert(FillerShowContent).values(fsc).run();
        }
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

    await this.db.insertInto('fillerShow').values(filler).execute();

    const persistedFillerShowContent = map(
      createRequest.programs,
      (p) =>
        ({
          fillerShowUuid: filler.uuid,
          programUuid: p.id,
          index: programIndexById[p.id]!,
        }) satisfies NewFillerShowContent,
    );

    await Promise.all(
      chunk(persistedFillerShowContent, 1_000).map((fsc) =>
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

  deleteFiller(id: string): void {
    this.drizzle.transaction((tx) => {
      const relevantChannelFillers = tx
        .select()
        .from(ChannelFillerShow)
        .where(eq(ChannelFillerShow.fillerShowUuid, id))
        .all();

      const allRelevantChannelFillers = tx
        .select()
        .from(ChannelFillerShow)
        .where(
          inArray(
            ChannelFillerShow.channelUuid,
            uniq(map(relevantChannelFillers, (cf) => cf.channelUuid)),
          ),
        )
        .all();

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

      tx.delete(ChannelFillerShow)
        .where(eq(ChannelFillerShow.fillerShowUuid, id))
        .run();

      const reminaingChannelFillers = omitBy<ChannelFillerShow[]>(
        mapValues(fillersByChannel, (cfs) =>
          reject(cfs, (cf) => cf.fillerShowUuid === id),
        ),
        isEmpty,
      );

      const allRemainingFillers = Object.values(reminaingChannelFillers).flat();
      if (!isEmpty(fillersByChannel) && !isEmpty(allRemainingFillers)) {
        const firstFiller = head(allRemainingFillers)!;
        const rest = tail(allRemainingFillers);
        const baseCase = caseWhen(
          and(
            eq(ChannelFillerShow.fillerShowUuid, firstFiller.fillerShowUuid),
            eq(ChannelFillerShow.channelUuid, firstFiller.channelUuid),
          )!,
          sql`${firstFiller.weight}`,
        );
        const cases = rest
          .reduce(
            (caseBuilder, channelFiller) =>
              caseBuilder.when(
                and(
                  eq(
                    ChannelFillerShow.fillerShowUuid,
                    channelFiller.fillerShowUuid,
                  ),
                  eq(ChannelFillerShow.channelUuid, channelFiller.channelUuid),
                )!,
                sql`${channelFiller.weight}`,
              ),
            baseCase,
          )
          .else(ChannelFillerShow.weight);

        tx.update(ChannelFillerShow).set({ weight: cases }).run();
      }

      tx.delete(FillerShow).where(eq(FillerShow.uuid, id)).run();
    });

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

  async getFillerPrograms(id: string): Promise<ProgramOrmWithExternalIds[]> {
    return (
      await this.drizzle.query.fillerShowContent.findMany({
        where: (fields, { eq }) => eq(fields.fillerShowUuid, id),
        with: {
          program: {
            with: {
              album: {
                with: {
                  externalIds: true,
                },
              },
              artist: {
                with: {
                  externalIds: true,
                },
              },
              show: {
                with: {
                  externalIds: true,
                },
              },
              season: {
                with: {
                  externalIds: true,
                },
              },
              externalIds: true,
            },
          },
        },
      })
    ).map(({ program }) => program);
  }

  async getFillersFromChannel(
    channelId: string,
  ): Promise<ChannelFillerShowWithContent[]> {
    const results = await this.drizzle.query.channelFillerShow.findMany({
      where: (fields, { eq }) => eq(fields.channelUuid, channelId),
      with: {
        filler: {
          with: {
            fillerShowContent: {
              with: {
                program: {
                  with: {
                    externalIds: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return results.map((result) => {
      return {
        channelUuid: channelId,
        cooldown: result.cooldown,
        fillerContent: result.filler.fillerShowContent.map(
          ({ program }) => program,
        ),
        fillerShow: result.filler,
        fillerShowUuid: result.fillerShowUuid,
        weight: result.weight,
      } satisfies ChannelFillerShowWithContent;
    });
  }

  bulkAssignFillers(
    request: BulkAssignFillersRequest,
  ): BulkAssignFillersResponse {
    let added = 0;
    let alreadyExisted = 0;

    this.drizzle.transaction((tx) => {
      if (request.mode === 'replace') {
        tx.delete(ChannelFillerShow)
          .where(inArray(ChannelFillerShow.channelUuid, request.channelIds))
          .run();

        const rows = request.channelIds.flatMap((channelId) =>
          request.fillers.map((filler) => ({
            channelUuid: channelId,
            fillerShowUuid: filler.fillerShowId,
            weight: filler.weight,
            cooldown: filler.cooldownSeconds,
          })),
        );

        for (const batch of chunk(rows, 1_000)) {
          tx.insert(ChannelFillerShow).values(batch).run();
        }

        added = rows.length;
      } else {
        const existing = tx
          .select({
            channelUuid: ChannelFillerShow.channelUuid,
            fillerShowUuid: ChannelFillerShow.fillerShowUuid,
          })
          .from(ChannelFillerShow)
          .where(inArray(ChannelFillerShow.channelUuid, request.channelIds))
          .all();

        const existingSet = new Set(
          existing.map((e) => `${e.channelUuid}:${e.fillerShowUuid}`),
        );

        const toInsert: Array<{
          channelUuid: string;
          fillerShowUuid: string;
          weight: number;
          cooldown: number;
        }> = [];

        for (const channelId of request.channelIds) {
          for (const filler of request.fillers) {
            const key = `${channelId}:${filler.fillerShowId}`;
            if (existingSet.has(key)) {
              alreadyExisted++;
            } else {
              toInsert.push({
                channelUuid: channelId,
                fillerShowUuid: filler.fillerShowId,
                weight: filler.weight,
                cooldown: filler.cooldownSeconds,
              });
            }
          }
        }

        for (const batch of chunk(toInsert, 1_000)) {
          tx.insert(ChannelFillerShow).values(batch).run();
        }

        added = toInsert.length;
      }
    });

    return { added, alreadyExisted };
  }
}
