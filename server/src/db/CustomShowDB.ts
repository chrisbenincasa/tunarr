import { KEYS } from '@/types/inject.js';
import { isNonEmptyString, parseFloatOrNull } from '@/util/index.js';
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
import { count, eq, sum } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { chunk, isNil, orderBy, partition, uniqBy } from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
import { v4 } from 'uuid';
import { IProgramDB } from './interfaces/IProgramDB.ts';
import { MediaSourceId, MediaSourceType } from './schema/base.ts';
import { CustomShow, type NewCustomShow } from './schema/CustomShow.ts';
import {
  CustomShowContent,
  type NewCustomShowContent,
} from './schema/CustomShowContent.ts';
import { DB } from './schema/db.ts';
import { ProgramWithRelationsOrm } from './schema/derivedTypes.ts';
import { DrizzleDBAccess } from './schema/index.ts';
import { Program } from './schema/Program.ts';

@injectable()
export class CustomShowDB {
  constructor(
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess,
  ) {}

  async getShow(id: string) {
    return await this.drizzle.query.customShow.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
      with: {
        content: {
          with: {
            program: {
              columns: {
                uuid: true,
                duration: true,
              },
            },
          },
        },
      },
    });
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

  async getShowPrograms(
    id: string,
  ): Promise<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[]> {
    const result = await this.drizzle.query.customShowContent.findMany({
      where: (fields, { eq }) => eq(fields.customShowUuid, id),
      orderBy: (fields, { asc }) => asc(fields.index),
      with: {
        program: {
          with: {
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
            artwork: true,
            externalIds: true,
            tags: {
              with: {
                tag: true,
              },
            },
          },
        },
      },
    });
    return result.map((r) => r.program);
  }

  async saveShow(id: string, updateRequest: UpdateCustomShowRequest) {
    const show = await this.getShow(id);

    if (isNil(show)) {
      return null;
    }

    if (updateRequest.programs && updateRequest.programs.length > 0) {
      await this.upsertCustomShowContent(show.uuid, updateRequest.programs);
    }

    const updates: Partial<NewCustomShow> = {};
    if (updateRequest.name) {
      updates.name = updateRequest.name;
    }

    if (!updateRequest.enableSync) {
      updates.syncExternalPlaylistId = null;
      updates.syncMediaSourceId = null;
      updates.syncMediaSourceType = null;
    } else {
      updates.syncMediaSourceId = updateRequest.syncMediaSourceId ?? null;
      updates.syncMediaSourceType = updateRequest.syncMediaSourceType ?? null;
      updates.syncExternalPlaylistId =
        updateRequest.syncExternalPlaylistId ?? null;
    }

    if (Object.keys(updates).length > 0) {
      await this.db
        .updateTable('customShow')
        .where('uuid', '=', show.uuid)
        .limit(1)
        .set({
          ...updates,
          // Do not allow clients to set this.
          lastSyncedAt: undefined,
        })
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
      syncMediaSourceId: createRequest.syncMediaSourceId ?? null,
      syncMediaSourceType: createRequest.syncMediaSourceType ?? null,
      syncExternalPlaylistId: createRequest.syncExternalPlaylistId ?? null,
    } satisfies NewCustomShow;

    await this.db.insertInto('customShow').values(show).execute();

    if (createRequest.programs.length > 0) {
      await this.upsertCustomShowContent(show.uuid, createRequest.programs);
    }

    return show.uuid;
  }

  async deleteShow(id: string) {
    const show = await this.getShow(id);
    if (!show) {
      return false;
    }

    await this.db.transaction().execute(async (tx) => {
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
    const showsAndContentCount = await this.drizzle
      .select({
        customShow: CustomShow,
        contentCount: count(CustomShowContent.contentUuid),
        totalDuration: sum(
          this.drizzle
            .select({ duration: Program.duration })
            .from(Program)
            .where(eq(Program.uuid, CustomShowContent.contentUuid)),
        ),
      })
      .from(CustomShow)
      .leftJoin(
        CustomShowContent,
        eq(CustomShow.uuid, CustomShowContent.customShowUuid),
      )
      .groupBy(CustomShow.uuid);

    return showsAndContentCount.map(
      ({ customShow, totalDuration, contentCount }) => ({
        id: customShow.uuid,
        name: customShow.name,
        count: contentCount,
        totalDuration: totalDuration
          ? (parseFloatOrNull(totalDuration) ?? 0)
          : 0,
        syncMediaSourceId: customShow.syncMediaSourceId,
        syncMediaSourceType: customShow.syncMediaSourceType,
        syncExternalPlaylistId: customShow.syncExternalPlaylistId,
        lastSyncedAt: customShow.lastSyncedAt,
      }),
    );
  }

  async getSyncedShows() {
    return this.db
      .selectFrom('customShow')
      .selectAll()
      .where('syncMediaSourceId', 'is not', null)
      .where('syncExternalPlaylistId', 'is not', null)
      .execute();
  }

  async updateLastSyncedAt(id: string) {
    await this.db
      .updateTable('customShow')
      .where('uuid', '=', id)
      .set({ lastSyncedAt: +dayjs() })
      .execute();
  }

  async upsertCustomShowContent(
    customShowId: string,
    programs: ContentProgram[],
  ): Promise<void> {
    if (programs.length === 0) {
      return;
    }
    const newProgramIndexesById = new Map<string, number[]>();
    for (let i = 0; i < programs.length; i++) {
      const program = programs[i]!;
      if (
        (program.persisted ||
          isCustomProgram(program) ||
          program.program.sourceType === 'local') &&
        isNonEmptyString(program.id)
      ) {
        const existing = newProgramIndexesById.get(program.id) ?? [];
        existing.push(i);
        newProgramIndexesById.set(program.id, existing);
      } else if (
        isContentProgram(program) &&
        program.program.sourceType !== 'local'
      ) {
        const key = createExternalId(
          program.program.sourceType,
          tag(program.program.mediaSourceId),
          program.program.externalId,
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
    const upsertedPrograms = await this.programDB.upsertContentPrograms(
      uniqBy(needsPersist, (p) => p.uniqueId),
    );
    const allPrograms: {
      uuid: string;
      sourceType: MediaSourceType;
      mediaSourceId: MediaSourceId;
      externalKey: string;
    }[] = uniqBy(persisted, (p) => p.id!)
      .map((p) => ({
        uuid: p.id!,
        sourceType: p.program.sourceType,
        mediaSourceId: tag<MediaSourceId>(p.program.mediaSourceId),
        externalKey: p.program.externalId,
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
    );

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
