import { relations } from 'drizzle-orm';
import {
  foreignKey,
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
    primaryKey({
      columns: [table.contentUuid, table.customShowUuid, table.index],
    }),
    foreignKey({
      name: 'custom_show_content_content_uuid_foreign',
      columns: [table.contentUuid],
      foreignColumns: [Program.uuid],
    }).onDelete('cascade'),
    foreignKey({
      name: 'custom_show_content_custom_show_uuid_foreign',
      columns: [table.customShowUuid],
      foreignColumns: [CustomShow.uuid],
    }).onDelete('cascade'),
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
