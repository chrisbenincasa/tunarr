import type { InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { FillerShowContent } from './FillerShowContent.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';
import { StreamSelectionProfile } from './StreamSelectionProfile.ts';

export const FillerShow = sqliteTable('filler_show', {
  uuid: text().primaryKey(),
  createdAt: integer(),
  updatedAt: integer(),
  name: text().notNull(),
  streamSelectionProfileId: text().references(
    () => StreamSelectionProfile.uuid,
    { onDelete: 'set null' },
  ),
});

export type FillerShowTable = KyselifyBetter<typeof FillerShow>;
export type FillerShow = Selectable<FillerShowTable>;
export type NewFillerShow = Insertable<FillerShowTable>;
export type FillerShowOrm = InferSelectModel<typeof FillerShow>;

export const FillerShowRelations = relations(FillerShow, ({ one, many }) => ({
  fillerShowContent: many(FillerShowContent),
  streamSelectionProfile: one(StreamSelectionProfile, {
    fields: [FillerShow.streamSelectionProfileId],
    references: [StreamSelectionProfile.uuid],
  }),
}));
