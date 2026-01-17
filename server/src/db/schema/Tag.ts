import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { index, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { Program } from './Program.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';

export const Tag = sqliteTable(
  'tags',
  {
    uuid: text().primaryKey(),
    tag: text().notNull(),
  },
  (table) => [unique('tags_unique_tag_idx').on(table.tag)],
);

export type Tag = InferSelectModel<typeof Tag>;
export type NewTag = InferInsertModel<typeof Tag>;

export const TagJoinRelationSchema = relations(Tag, ({ many }) => ({
  programs: many(TagRelations),
}));

export const TagRelations = sqliteTable(
  'tag_relations',
  {
    tagId: text()
      .notNull()
      .references(() => Tag.uuid, { onDelete: 'cascade' }),
    programId: text().references(() => Program.uuid, { onDelete: 'cascade' }),
    groupingId: text().references(() => ProgramGrouping.uuid, {
      onDelete: 'cascade',
    }),
  },
  (table) => [
    index('tag_relations_program_id_idx').on(table.programId),
    index('tag_relations_grouping_id_idx').on(table.groupingId),
    unique('tag_program_id_unique_idx').on(table.tagId, table.programId),
    unique('tag_grouping_id_unique_idx').on(table.tagId, table.groupingId),
  ],
);

export type TagRelation = InferSelectModel<typeof TagRelations>;
export type NewTagRelation = InferInsertModel<typeof TagRelations>;

export const TagRelationSchema = relations(TagRelations, ({ one }) => ({
  tag: one(Tag, {
    fields: [TagRelations.tagId],
    references: [Tag.uuid],
  }),
  program: one(Program, {
    fields: [TagRelations.programId],
    references: [Program.uuid],
  }),
  gropuing: one(ProgramGrouping, {
    fields: [TagRelations.groupingId],
    references: [ProgramGrouping.uuid],
  }),
}));
