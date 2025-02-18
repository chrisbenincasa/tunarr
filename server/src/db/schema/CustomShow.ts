import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { type KyselifyBetter } from './KyselifyBetter.ts';

export const CustomShow = sqliteTable('custom_show', {
  uuid: text().primaryKey(),
  createdAt: integer(),
  updatedAt: integer(),
  name: text().notNull(),
});

export type CustomShowTable = KyselifyBetter<typeof CustomShow>;

export type CustomShow = Selectable<CustomShowTable>;
export type NewCustomShow = Insertable<CustomShowTable>;

export const CustomShowContent = sqliteTable(
  'custom_show_content',
  {
    contentUuid: text().notNull(),
    customShowUuid: text()
      .notNull()
      .references(() => CustomShow.uuid),
    index: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.contentUuid, table.customShowUuid] }),
  ],
);

export type CustomShowContentTable = KyselifyBetter<typeof CustomShowContent>;
export type CustomShowContent = Selectable<CustomShowContentTable>;
export type NewCustomShowContent = Insertable<CustomShowContentTable>;
