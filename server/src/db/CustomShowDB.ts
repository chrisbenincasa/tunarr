import { KEYS } from '@/types/inject.js';
import { parseFloatOrNull } from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import type { CondensedContentProgram } from '@tunarr/types';
import type {
  CreateCustomShowRequest,
  UpdateCustomShowRequest,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import { and, count, eq, gt, lte, sum } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import { chunk, isNil } from 'lodash-es';
import type { MarkRequired } from 'ts-essentials';
import { v4 } from 'uuid';
import { GenericBadRequestError } from '../types/errors.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import type { BasicProgramRepository } from './program/BasicProgramRepository.ts';
import { CustomShow, type NewCustomShow } from './schema/CustomShow.ts';
import {
  CustomShowContent,
  type NewCustomShowContent,
} from './schema/CustomShowContent.ts';
import type { DB } from './schema/db.ts';
import type { ProgramWithRelationsOrm } from './schema/derivedTypes.ts';
import type { DrizzleDBAccess } from './schema/index.ts';
import { Program } from './schema/Program.ts';

@injectable()
export class CustomShowDB {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess,
    @inject(KEYS.BasicProgramRepository)
    private basicProgramRepo: BasicProgramRepository,
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

    // An omitted field leaves membership alone. An explicit list, including an
    // empty one, replaces it. Resolve every ID before changing anything.
    const replacementPrograms = updateRequest.programs;
    if (replacementPrograms !== undefined) {
      const missingIds = await this.findMissingProgramIds(replacementPrograms);
      if (missingIds.length > 0) {
        throw new GenericBadRequestError(
          `Cannot update custom show programs: ${missingIds.length} program(s) do not exist: ${missingIds.slice(0, 10).join(', ')}`,
        );
      }
    }

    const updates: Partial<typeof CustomShow.$inferInsert> = {};
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

    this.drizzle.transaction((tx) => {
      if (Object.keys(updates).length > 0) {
        tx.update(CustomShow)
          .set(updates)
          .where(eq(CustomShow.uuid, show.uuid))
          .run();
      }

      if (replacementPrograms === undefined) {
        return;
      }

      tx.delete(CustomShowContent)
        .where(eq(CustomShowContent.customShowUuid, show.uuid))
        .run();

      const rows = replacementPrograms.map(
        (program, index) =>
          ({
            customShowUuid: show.uuid,
            contentUuid: program.id,
            index,
          }) satisfies NewCustomShowContent,
      );
      for (const contentChunk of chunk(rows, 1_000)) {
        tx.insert(CustomShowContent).values(contentChunk).run();
      }
    });

    return await this.getShow(show.uuid);
  }

  private async findMissingProgramIds(programs: CondensedContentProgram[]) {
    const ids = [...new Set(programs.map((program) => program.id))];
    const existingIds =
      await this.basicProgramRepo.filterNonExistentProgramIds(ids);
    return ids.filter((programId) => !existingIds.has(programId));
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

    this.drizzle.transaction((tx) => {
      // TODO: Do this deletion in the DB with foreign keys.
      tx.delete(CustomShowContent)
        .where(eq(CustomShowContent.customShowUuid, show.uuid))
        .run();
      tx.delete(CustomShow).where(eq(CustomShow.uuid, show.uuid)).run();
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
        // Matches hasSchedulableDuration. The upper bound excludes infinity.
        schedulableCount: sum(
          this.drizzle
            .select({ matches: count() })
            .from(Program)
            .where(
              and(
                eq(Program.uuid, CustomShowContent.contentUuid),
                gt(Program.duration, 0),
                lte(Program.duration, Number.MAX_VALUE),
              ),
            ),
        ),
      })
      .from(CustomShow)
      .leftJoin(
        CustomShowContent,
        eq(CustomShow.uuid, CustomShowContent.customShowUuid),
      )
      .groupBy(CustomShow.uuid);

    return showsAndContentCount.map(
      ({ customShow, totalDuration, contentCount, schedulableCount }) => ({
        id: customShow.uuid,
        name: customShow.name,
        count: contentCount,
        schedulableCount: schedulableCount
          ? (parseFloatOrNull(schedulableCount) ?? 0)
          : 0,
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
    programs: CondensedContentProgram[],
  ): Promise<void> {
    if (programs.length === 0) {
      this.drizzle
        .delete(CustomShowContent)
        .where(eq(CustomShowContent.customShowUuid, customShowId))
        .run();
      return;
    }

    const incomingProgramIds = new Set(programs.map((program) => program.id));
    const existingProgramIds =
      await this.basicProgramRepo.filterNonExistentProgramIds([
        ...incomingProgramIds.values(),
      ]);

    const missingProgramIds = incomingProgramIds.difference(existingProgramIds);

    // log about not found programs
    if (missingProgramIds.size > 0) {
      this.logger.warn(
        'Attempting to save %d program IDs to a custom show that do not exist in the DB. They will be dropped. IDs: %j',
        missingProgramIds.size,
        [...missingProgramIds.values()],
      );
    }

    const allNewCustomContent = seq.collect(programs, (program, index) => {
      if (!existingProgramIds.has(program.id)) {
        return;
      }

      return {
        customShowUuid: customShowId,
        contentUuid: program.id,
        index,
      } satisfies NewCustomShowContent;
    });

    this.drizzle.transaction((tx) => {
      if (allNewCustomContent.length > 0) {
        tx.delete(CustomShowContent)
          .where(eq(CustomShowContent.customShowUuid, customShowId))
          .run();
        for (const contentChunk of chunk(allNewCustomContent, 1_000)) {
          tx.insert(CustomShowContent).values(contentChunk).run();
        }
      }
    });
  }
}
