import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { type KyselifyBetter } from './KyselifyBetter.ts';
import { Program } from './Program.ts';

export const FillerShow = sqliteTable('filler_show', {
  uuid: text().primaryKey(),
  createdAt: integer(),
  updatedAt: integer(),
  name: text().notNull(),
});

export type FillerShowTable = KyselifyBetter<typeof FillerShow>;

export type FillerShow = Selectable<FillerShowTable>;
export type NewFillerShow = Insertable<FillerShowTable>;

export const FillerShowContent = sqliteTable(
  'filler_show_content',
  {
    fillerShowUuid: text()
      .notNull()
      .references(() => FillerShow.uuid),
    index: integer().notNull(),
    programUuid: text()
      .notNull()
      .references(() => Program.uuid),
  },
  (table) => [
    primaryKey({ columns: [table.fillerShowUuid, table.programUuid] }),
  ],
);

export type FillerShowContentTable = KyselifyBetter<typeof FillerShowContent>;
export type FillerShowContent = Selectable<FillerShowContentTable>;
export type NewFillerShowContent = Insertable<FillerShowContentTable>;
