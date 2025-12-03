import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { Program } from './Program.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';

export const Genre = sqliteTable(
  'genre',
  {
    uuid: text().primaryKey(),
    name: text().notNull(),
  },
  (table) => [index('genre_name_idx').on(table.name)],
);

export const EntityGenre = sqliteTable(
  'genre_entity',
  {
    genreId: text()
      .notNull()
      .references(() => Genre.uuid, { onDelete: 'cascade' }),
    programId: text().references(() => Program.uuid, { onDelete: 'cascade' }),
    groupId: text().references(() => ProgramGrouping.uuid, {
      onDelete: 'cascade',
    }),
  },
  (table) => [
    index('genre_entity_id_index').on(table.genreId),
    index('genre_entity_program_id_index').on(table.programId),
    index('genre_entity_group_id_index').on(table.groupId),
    uniqueIndex('genre_program_unique_idx').on(table.genreId, table.programId),
    uniqueIndex('genre_grouping_unique_idx').on(table.genreId, table.groupId),
  ],
);

export const GenreRelations = relations(EntityGenre, ({ one }) => ({
  genre: one(Genre, {
    fields: [EntityGenre.genreId],
    references: [Genre.uuid],
  }),
  program: one(Program, {
    fields: [EntityGenre.programId],
    references: [Program.uuid],
  }),
  programGrouping: one(ProgramGrouping, {
    fields: [EntityGenre.groupId],
    references: [ProgramGrouping.uuid],
  }),
}));

export type Genre = InferSelectModel<typeof Genre>;
export type NewGenre = InferInsertModel<typeof Genre>;
export type GenreEntity = InferSelectModel<typeof EntityGenre>;
export type NewGenreEntity = InferInsertModel<typeof EntityGenre>;
