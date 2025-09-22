import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { FillerShowContent } from './FillerShowContent.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';

export const FillerShow = sqliteTable('filler_show', {
  uuid: text().primaryKey(),
  createdAt: integer(),
  updatedAt: integer(),
  name: text().notNull(),
});

export type FillerShowTable = KyselifyBetter<typeof FillerShow>;
export type FillerShow = Selectable<FillerShowTable>;
export type NewFillerShow = Insertable<FillerShowTable>;

export const FillerShowRelations = relations(FillerShow, ({ many }) => ({
  fillerShowContent: many(FillerShowContent),
}));
