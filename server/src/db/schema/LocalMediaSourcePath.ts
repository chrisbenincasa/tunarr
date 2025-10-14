import type { InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import type { MediaSourceId } from './base.ts';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { LocalMediaFolder } from './LocalMediaFolder.ts';
import { MediaSource } from './MediaSource.ts';
import { Program } from './Program.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';

export const LocalMediaSourcePath = sqliteTable('local_media_source_path', {
  uuid: text().primaryKey(),
  mediaSourceId: text()
    .references(() => MediaSource.uuid, { onDelete: 'cascade' })
    .notNull()
    .$type<MediaSourceId>(),
  path: text().notNull(),
  lastScannedAt: integer({ mode: 'timestamp_ms' }),
  // libraryId: text()
  //   .notNull()
  //   .references(() => MediaSourceLibrary.uuid, { onDelete: 'cascade' }),
});

export const LocalMediaSourcePathRelations = relations(
  LocalMediaSourcePath,
  ({ many, one }) => ({
    folders: many(LocalMediaFolder),
    mediaSource: one(MediaSource, {
      fields: [LocalMediaSourcePath.mediaSourceId],
      references: [MediaSource.uuid],
    }),
    // mediaSourceLibrary: one(MediaSourceLibrary, {
    //   fields: [LocalMediaSourcePath.libraryId],
    //   references: [MediaSourceLibrary.uuid],
    // }),
    programs: many(Program),
    programGroupings: many(ProgramGrouping),
  }),
);

export type LocalMediaSourcePathTable = KyselifyBetter<
  typeof LocalMediaSourcePath
>;
export type LocalMediaSourcePathOrm = InferSelectModel<
  typeof LocalMediaSourcePath
>;
export type LocalMediaSourcePath = Selectable<LocalMediaSourcePathTable>;
export type NewLocalMediaSourcePath = Insertable<LocalMediaSourcePathTable>;
