import type { InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable } from 'kysely';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { LocalMediaFolder } from './LocalMediaFolder.ts';
import { ProgramVersion } from './ProgramVersion.ts';

export const ProgramMediaFile = sqliteTable(
  'program_media_file',
  {
    uuid: text().primaryKey(),
    path: text().notNull(),
    programVersionId: text()
      .notNull()
      .references(() => ProgramVersion.uuid, { onDelete: 'cascade' }),
    localMediaFolderId: text().references(() => LocalMediaFolder.uuid, {
      onDelete: 'cascade',
    }),
  },
  (table) => [
    index('program_media_file_program_version_idx').on(table.programVersionId),
    index('program_media_file_folder_idx').on(table.localMediaFolderId),
  ],
);

export const ProgramMediaFileRelations = relations(
  ProgramMediaFile,
  ({ one }) => ({
    version: one(ProgramVersion, {
      fields: [ProgramMediaFile.programVersionId],
      references: [ProgramVersion.uuid],
    }),
    localMediaFolder: one(LocalMediaFolder, {
      fields: [ProgramMediaFile.localMediaFolderId],
      references: [LocalMediaFolder.uuid],
    }),
  }),
);

export type ProgramMediaFileTable = KyselifyBetter<typeof ProgramMediaFile>;
export type ProgramMediaFile = InferSelectModel<typeof ProgramMediaFile>;
export type NewProgramMediaFile = Insertable<ProgramMediaFileTable>;
