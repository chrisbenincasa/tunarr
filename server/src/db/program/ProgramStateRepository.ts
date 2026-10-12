import { KEYS } from '@/types/inject.js';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { chunk } from 'lodash-es';
import { Program } from '../schema/Program.ts';
import type { ProgramGroupingType } from '../schema/ProgramGrouping.ts';
import { ProgramGrouping } from '../schema/ProgramGrouping.ts';
import type { ProgramState } from '../schema/base.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';

@injectable()
export class ProgramStateRepository {
  constructor(@inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess) {}

  async updateProgramsState(
    programIds: string[],
    newState: ProgramState,
  ): Promise<void> {
    if (programIds.length === 0) {
      return;
    }

    for (const idChunk of chunk(programIds, 100)) {
      await this.drizzleDB
        .update(Program)
        .set({
          state: newState,
        })
        .where(inArray(Program.uuid, idChunk))
        .execute();
    }
  }

  async updateGroupingsState(
    groupingIds: string[],
    newState: ProgramState,
  ): Promise<void> {
    if (groupingIds.length === 0) {
      return;
    }

    for (const idChunk of chunk(groupingIds, 100)) {
      await this.drizzleDB
        .update(ProgramGrouping)
        .set({
          state: newState,
        })
        .where(inArray(ProgramGrouping.uuid, idChunk))
        .execute();
    }
  }

  async countMissingPrograms(): Promise<number> {
    const [result] = await this.drizzleDB
      .select({ count: sql<number>`count(*)` })
      .from(Program)
      .where(eq(Program.state, 'missing'));

    return result?.count ?? 0;
  }

  /**
   * Returns up to `limit` IDs of programs currently in the trash. Callers are
   * expected to delete the returned IDs before asking for the next batch.
   */
  async nextMissingProgramIds(limit: number): Promise<string[]> {
    const rows = await this.drizzleDB
      .select({ uuid: Program.uuid })
      .from(Program)
      .where(eq(Program.state, 'missing'))
      .limit(limit);

    return rows.map(({ uuid }) => uuid);
  }

  /**
   * Pages through every trashed program ID. Used to collect the full ID set
   * once, up front, for lineup cleanup.
   */
  async *allMissingProgramIds(
    pageSize: number,
  ): AsyncGenerator<string[], void, undefined> {
    let offset = 0;
    for (;;) {
      const rows = await this.drizzleDB
        .select({ uuid: Program.uuid })
        .from(Program)
        .where(eq(Program.state, 'missing'))
        .orderBy(Program.uuid)
        .limit(pageSize)
        .offset(offset);

      if (rows.length === 0) {
        return;
      }

      yield rows.map(({ uuid }) => uuid);

      if (rows.length < pageSize) {
        return;
      }

      offset += rows.length;
    }
  }

  async deleteProgramsByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.drizzleDB
      .delete(Program)
      .where(inArray(Program.uuid, ids));

    return result.changes;
  }

  /**
   * Returns trashed grouping IDs that are safe to delete right now: nothing
   * still references them.
   *
   * `program.{season,album,tv_show,artist}_uuid` are plain NO ACTION foreign
   * keys, so deleting a grouping that a surviving program still points at
   * aborts the statement. `program_grouping.{show,artist}_uuid` cascade, so
   * deleting a show would silently take its seasons with it — and those
   * seasons may still have live programs. Both cases are excluded here, which
   * is why callers must drain leaves (season/album) before roots
   * (show/artist).
   */
  async nextDeletableMissingGroupingIds(
    types: readonly ProgramGroupingType[],
    limit: number,
  ): Promise<string[]> {
    if (types.length === 0) {
      return [];
    }

    const rows = await this.drizzleDB
      .select({ uuid: ProgramGrouping.uuid })
      .from(ProgramGrouping)
      .where(
        and(
          eq(ProgramGrouping.state, 'missing'),
          inArray(ProgramGrouping.type, [...types]),
          sql`NOT EXISTS (SELECT 1 FROM ${Program} p
                WHERE p.season_uuid = ${ProgramGrouping.uuid}
                   OR p.album_uuid = ${ProgramGrouping.uuid}
                   OR p.tv_show_uuid = ${ProgramGrouping.uuid}
                   OR p.artist_uuid = ${ProgramGrouping.uuid})`,
          sql`NOT EXISTS (SELECT 1 FROM ${ProgramGrouping} c
                WHERE c.show_uuid = ${ProgramGrouping.uuid}
                   OR c.artist_uuid = ${ProgramGrouping.uuid})`,
        ),
      )
      .limit(limit);

    return rows.map(({ uuid }) => uuid);
  }

  /**
   * Reclaims the WAL grown by a long run of small write transactions and
   * refreshes query planner statistics. Deliberately not VACUUM, which fully
   * blocks while it rewrites the whole file.
   */
  checkpointAndOptimize(): Promise<void> {
    // better-sqlite3 is synchronous; `run` returns a result, not a promise.
    this.drizzleDB.run(sql`PRAGMA wal_checkpoint(TRUNCATE)`);
    this.drizzleDB.run(sql`PRAGMA optimize`);
    return Promise.resolve();
  }

  async deleteGroupingsByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.drizzleDB
      .delete(ProgramGrouping)
      .where(inArray(ProgramGrouping.uuid, ids));

    return result.changes;
  }
}
