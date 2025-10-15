import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { MediaSourceLibrary } from './MediaSourceLibrary.ts';

export const LocalMediaFolder = sqliteTable(
  'local_media_folder',
  {
    uuid: text().primaryKey(),
    path: text().notNull(),
    libraryId: text()
      .notNull()
      .references(() => MediaSourceLibrary.uuid, { onDelete: 'cascade' }),
    canonicalId: text().notNull(),
    parentId: text(),
  },
  (table) => [
    index('local_media_folder_library_id_path_idx').on(
      table.libraryId,
      table.path,
    ),
    index('local_media_folder_path_idx').on(table.path),
    index('local_media_folder_canonical_id_id').on(table.canonicalId),
  ],
);

export const LocalMediaFolderRelations = relations(
  LocalMediaFolder,
  ({ one, many }) => ({
    parent: one(LocalMediaFolder, {
      fields: [LocalMediaFolder.parentId],
      references: [LocalMediaFolder.uuid],
      relationName: 'hierarchy',
    }),
    children: many(LocalMediaFolder, { relationName: 'hierarchy' }),
    library: one(MediaSourceLibrary, {
      fields: [LocalMediaFolder.libraryId],
      references: [MediaSourceLibrary.uuid],
    }),
  }),
);

export type LocalMediaFolderTable = KyselifyBetter<typeof LocalMediaFolder>;
export type LocalMediaFolderOrm = InferSelectModel<typeof LocalMediaFolder>;
export type NewLocalMediaFolderOrm = InferInsertModel<typeof LocalMediaFolder>;
