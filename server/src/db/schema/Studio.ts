import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Program } from './Program.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';

export const Studio = sqliteTable('studio', {
  uuid: text().primaryKey(),
  name: text().notNull(),
});

export const StudioEntity = sqliteTable(
  'studio_entity',
  {
    studioId: text()
      .notNull()
      .references(() => Studio.uuid, { onDelete: 'cascade' }),
    programId: text().references(() => Program.uuid, { onDelete: 'cascade' }),
    groupId: text().references(() => ProgramGrouping.uuid, {
      onDelete: 'cascade',
    }),
  },
  (table) => [
    index('studio_entity_id_index').on(table.studioId),
    index('studio_entity_program_id_index').on(table.programId),
    index('studio_entity_group_id_index').on(table.groupId),
  ],
);

export const StudioRelations = relations(StudioEntity, ({ one }) => ({
  studio: one(Studio, {
    fields: [StudioEntity.studioId],
    references: [Studio.uuid],
  }),
  program: one(Program, {
    fields: [StudioEntity.programId],
    references: [Program.uuid],
  }),
  programGrouping: one(ProgramGrouping, {
    fields: [StudioEntity.groupId],
    references: [ProgramGrouping.uuid],
  }),
}));

export type Studio = InferSelectModel<typeof Studio>;
export type StudioEntity = InferSelectModel<typeof StudioEntity>;
export type NewStudio = InferInsertModel<typeof Studio>;
export type NewStudioEntity = InferInsertModel<typeof StudioEntity>;
