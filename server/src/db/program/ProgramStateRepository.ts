import { KEYS } from '@/types/inject.js';
import { eq, inArray } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { chunk } from 'lodash-es';
import { Program } from '../schema/Program.ts';
import { ProgramGrouping } from '../schema/ProgramGrouping.ts';
import type { ProgramState } from '../schema/base.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';

@injectable()
export class ProgramStateRepository {
  constructor(
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
  ) {}

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

  async emptyTrashPrograms(): Promise<void> {
    await this.drizzleDB.delete(Program).where(eq(Program.state, 'missing'));
  }
}
