import { and, eq, inArray, sql } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { head, uniq } from 'lodash-es';
import { v4 } from 'uuid';
import { KEYS } from '../types/inject.ts';
import { DrizzleDBAccess } from './schema/index.ts';
import { Tag, TagRelations } from './schema/Tag.ts';

@injectable()
export class TagRepo {
  constructor(@inject(KEYS.DrizzleDB) private db: DrizzleDBAccess) {}

  async upsertTag(tag: string) {
    return head(
      await this.db
        .insert(Tag)
        .values({
          uuid: v4(),
          tag,
        })
        // No-op update to ensure a row is returned.
        .onConflictDoUpdate({
          target: Tag.tag,
          set: {
            tag: sql`excluded.tag`,
          },
        })
        .returning(),
    )!;
  }

  async tagProgram(tagId: string, programId: string) {
    return await this.tagPrograms(tagId, [programId]);
  }

  async tagPrograms(tagId: string, programIds: string[]) {
    if (programIds.length === 0) {
      return;
    }

    await this.db
      .insert(TagRelations)
      .values(
        uniq(programIds).map((id) => ({
          tagId,
          programId: id,
        })),
      )
      .onConflictDoNothing({
        target: [TagRelations.tagId, TagRelations.programId],
      });
  }

  async untagPrograms(tagId: string, programIds: string[]) {
    if (programIds.length === 0) {
      return;
    }

    return await this.db
      .delete(TagRelations)
      .where(
        and(
          eq(TagRelations.tagId, tagId),
          inArray(TagRelations.programId, programIds),
        ),
      );
  }

  async untagProgramGroupings(tagId: string, groupingIds: string[]) {
    if (groupingIds.length === 0) {
      return;
    }

    return await this.db
      .delete(TagRelations)
      .where(
        and(
          eq(TagRelations.tagId, tagId),
          inArray(TagRelations.groupingId, groupingIds),
        ),
      );
  }

  async tagProgramGrouping(tagId: string, groupingId: string) {
    return await this.tagProgramGroupings(tagId, [groupingId]);
  }

  async tagProgramGroupings(tagId: string, groupingIds: string[]) {
    if (groupingIds.length === 0) {
      return;
    }

    await this.db
      .insert(TagRelations)
      .values(
        uniq(groupingIds).map((id) => ({
          tagId,
          groupingId: id,
        })),
      )
      .onConflictDoNothing({
        target: [TagRelations.tagId, TagRelations.groupingId],
      });
  }
}
