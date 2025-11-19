import { relations } from 'drizzle-orm';
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { FillerShow } from './FillerShow.ts';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { Program } from './Program.ts';

export const FillerShowContent = sqliteTable(
  'filler_show_content',
  {
    fillerShowUuid: text()
      .notNull()
      .references(() => FillerShow.uuid, { onDelete: 'cascade' }),
    index: integer().notNull(),
    programUuid: text()
      .notNull()
      .references(() => Program.uuid, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.fillerShowUuid, table.programUuid] }),
  ],
);

export type FillerShowContentTable = KyselifyBetter<typeof FillerShowContent>;
export type FillerShowContent = Selectable<FillerShowContentTable>;
export type NewFillerShowContent = Insertable<FillerShowContentTable>;

export const FillerShowContentRelations = relations(
  FillerShowContent,
  ({ one }) => ({
    fillerShow: one(FillerShow, {
      fields: [FillerShowContent.fillerShowUuid],
      references: [FillerShow.uuid],
    }),
    program: one(Program, {
      fields: [FillerShowContent.programUuid],
      references: [Program.uuid],
    }),
  }),
);
