import { relations } from 'drizzle-orm';
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { CustomShow } from './CustomShow.ts';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { Program } from './Program.ts';

export const CustomShowContent = sqliteTable(
  'custom_show_content',
  {
    contentUuid: text()
      .notNull()
      .references(() => Program.uuid, { onDelete: 'cascade' }),
    customShowUuid: text()
      .notNull()
      .references(() => CustomShow.uuid, { onDelete: 'cascade' }),
    index: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.contentUuid, table.customShowUuid] }),
  ],
);

export type CustomShowContentTable = KyselifyBetter<typeof CustomShowContent>;
export type CustomShowContent = Selectable<CustomShowContentTable>;
export type NewCustomShowContent = Insertable<CustomShowContentTable>;

export const CustomShowContentRelations = relations(
  CustomShowContent,
  ({ one }) => ({
    program: one(Program, {
      fields: [CustomShowContent.contentUuid],
      references: [Program.uuid],
    }),
    customShow: one(CustomShow, {
      fields: [CustomShowContent.customShowUuid],
      references: [CustomShow.uuid],
    }),
  }),
);
