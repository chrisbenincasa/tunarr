import type { TupleToUnion } from '@tunarr/types';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { ProgramVersion } from './ProgramVersion.ts';

export const ProgramChapterType = ['chapter', 'intro', 'outro'] as const;
export type ProgramChapterType = TupleToUnion<typeof ProgramChapterType>;

export const ProgramChapter = sqliteTable('program_chapter', {
  uuid: text().primaryKey(),
  index: integer().notNull(),
  startTime: integer().notNull(),
  endTime: integer().notNull(),
  title: text(),
  chapterType: text({ enum: ProgramChapterType }).notNull().default('chapter'),

  // Join
  programVersionId: text()
    .notNull()
    .references(() => ProgramVersion.uuid, { onDelete: 'cascade' }),
});

export const ProgramChapterRelations = relations(ProgramChapter, ({ one }) => ({
  version: one(ProgramVersion, {
    fields: [ProgramChapter.programVersionId],
    references: [ProgramVersion.uuid],
  }),
}));

export type ProgramChapterTable = KyselifyBetter<typeof ProgramChapter>;
export type ProgramChapter = Selectable<ProgramChapterTable>;
export type ProgramChapterOrm = InferSelectModel<typeof ProgramChapter>;
export type NewProgramChapterOrm = InferInsertModel<typeof ProgramChapter>;
export type NewProgramChapter = Insertable<ProgramChapterTable>;
