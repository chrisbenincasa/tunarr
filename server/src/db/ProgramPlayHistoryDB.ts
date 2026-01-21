import { KEYS } from '@/types/inject.js';
import { and, eq, gt } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { v4 } from 'uuid';
import {
  NewProgramPlayHistoryDrizzle,
  ProgramPlayHistory,
} from './schema/ProgramPlayHistory.ts';
import { DrizzleDBAccess } from './schema/index.ts';

@injectable()
export class ProgramPlayHistoryDB {
  constructor(@inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess) {}

  getById(id: string) {
    return this.drizzle.query.programPlayHistory.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
    });
  }

  getByProgramId(programId: string) {
    return this.drizzle.query.programPlayHistory.findMany({
      where: (fields, { eq }) => eq(fields.programUuid, programId),
      orderBy: (fields, { desc }) => desc(fields.playedAt),
    });
  }

  getByChannelId(channelId: string, limit?: number) {
    return this.drizzle.query.programPlayHistory.findMany({
      where: (fields, { eq }) => eq(fields.channelUuid, channelId),
      orderBy: (fields, { desc }) => desc(fields.playedAt),
      limit,
    });
  }

  getByChannelAndProgram(channelId: string, programId: string) {
    return this.drizzle.query.programPlayHistory.findMany({
      where: (fields, { eq, and }) =>
        and(
          eq(fields.channelUuid, channelId),
          eq(fields.programUuid, programId),
        ),
      orderBy: (fields, { desc }) => desc(fields.playedAt),
    });
  }

  getAll(limit?: number) {
    return this.drizzle.query.programPlayHistory.findMany({
      orderBy: (fields, { desc }) => desc(fields.playedAt),
      limit,
    });
  }

  create(
    data: Omit<NewProgramPlayHistoryDrizzle, 'uuid' | 'createdAt'> & {
      uuid?: string;
      createdAt?: Date;
    },
  ) {
    const now = new Date();
    const record: NewProgramPlayHistoryDrizzle = {
      uuid: data.uuid ?? v4(),
      programUuid: data.programUuid,
      channelUuid: data.channelUuid,
      playedAt: data.playedAt,
      playedDuration: data.playedDuration,
      createdAt: data.createdAt ?? now,
      fillerListId: data.fillerListId,
    };

    return this.drizzle
      .insert(ProgramPlayHistory)
      .values(record)
      .returning()
      .then((rows) => rows[0]);
  }

  update(
    id: string,
    data: Partial<
      Pick<
        NewProgramPlayHistoryDrizzle,
        'playedAt' | 'playedDuration' | 'fillerListId'
      >
    >,
  ) {
    return this.drizzle
      .update(ProgramPlayHistory)
      .set(data)
      .where(eq(ProgramPlayHistory.uuid, id))
      .returning()
      .then((rows) => rows[0]);
  }

  delete(id: string) {
    return this.drizzle
      .delete(ProgramPlayHistory)
      .where(eq(ProgramPlayHistory.uuid, id))
      .returning()
      .then((rows) => rows.length > 0);
  }

  deleteByChannelId(channelId: string) {
    return this.drizzle
      .delete(ProgramPlayHistory)
      .where(eq(ProgramPlayHistory.channelUuid, channelId))
      .returning()
      .then((rows) => rows.length);
  }

  deleteByProgramId(programId: string) {
    return this.drizzle
      .delete(ProgramPlayHistory)
      .where(eq(ProgramPlayHistory.programUuid, programId))
      .returning()
      .then((rows) => rows.length);
  }

  deleteByChannelIdAfter(channelId: string, after: Date) {
    return this.drizzle
      .delete(ProgramPlayHistory)
      .where(
        and(
          eq(ProgramPlayHistory.channelUuid, channelId),
          gt(ProgramPlayHistory.playedAt, after),
        ),
      )
      .returning()
      .then((rows) => rows.length);
  }

  /**
   * Gets the most recent play history entry for a program on a channel.
   * Returns the entry if found, or undefined if no play history exists.
   */
  async getMostRecentPlay(channelId: string, programId: string) {
    return this.drizzle.query.programPlayHistory.findFirst({
      where: (fields, { eq, and }) =>
        and(
          eq(fields.channelUuid, channelId),
          eq(fields.programUuid, programId),
        ),
      orderBy: (fields, { desc }) => desc(fields.playedAt),
    });
  }

  /**
   * Checks if a program is currently playing on a channel.
   * A program is considered "currently playing" if there's a play history entry
   * where playedAt + playedDuration > timestamp.
   */
  async isProgramCurrentlyPlaying(
    channelId: string,
    programId: string,
    timestamp: number,
  ): Promise<boolean> {
    const mostRecent = await this.getMostRecentPlay(channelId, programId);
    if (!mostRecent || !mostRecent.playedDuration) {
      return false;
    }
    const playEndTime =
      mostRecent.playedAt.getTime() + mostRecent.playedDuration;
    return timestamp < playEndTime;
  }
}
