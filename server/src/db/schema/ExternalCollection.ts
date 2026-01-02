import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';
import type { MediaSourceId } from './base.ts';
import { MediaSourceTypes } from './base.ts';
import { MediaSource } from './MediaSource.ts';
import { MediaSourceLibrary } from './MediaSourceLibrary.ts';
import { Program } from './Program.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';

export const ExternalCollection = sqliteTable(
  'external_collections',
  {
    uuid: text().primaryKey(),
    mediaSourceId: text()
      .notNull()
      .$type<MediaSourceId>()
      .references(() => MediaSource.uuid, { onDelete: 'cascade' }),
    libraryId: text()
      .notNull()
      .references(() => MediaSourceLibrary.uuid, { onDelete: 'cascade' }),
    externalKey: text().notNull(),
    sourceType: text({ enum: MediaSourceTypes }).notNull(),
    title: text().notNull(),
  },
  (table) => [
    unique().on(table.mediaSourceId, table.externalKey),
    index('external_collection_media_source_id_external_key_idx').on(
      table.mediaSourceId,
      table.externalKey,
    ),
    index('external_collection_library_id_external_key_idx').on(
      table.libraryId,
      table.externalKey,
    ),
  ],
);

export type ExternalCollection = InferSelectModel<typeof ExternalCollection>;
export type NewExternalCollection = InferInsertModel<typeof ExternalCollection>;

export const ExternalCollectionPrograms = sqliteTable(
  'external_collection_programs',
  {
    collectionId: text()
      .notNull()
      .references(() => ExternalCollection.uuid, { onDelete: 'cascade' }),
    programId: text().references(() => Program.uuid, { onDelete: 'cascade' }),
    groupingId: text().references(() => ProgramGrouping.uuid, {
      onDelete: 'cascade',
    }),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.programId] }),
    index('external_collection_program_idx').on(table.programId),
  ],
);

export const ExternalCollectionRelations = relations(
  ExternalCollection,
  ({ many }) => ({
    programs: many(ExternalCollectionPrograms),
    groupings: many(ExternalCollectionPrograms),
  }),
);

export const ExternalCollectionProgramRelations = relations(
  ExternalCollectionPrograms,
  ({ one }) => ({
    collection: one(ExternalCollection, {
      fields: [ExternalCollectionPrograms.collectionId],
      references: [ExternalCollection.uuid],
    }),
    program: one(Program, {
      fields: [ExternalCollectionPrograms.programId],
      references: [Program.uuid],
    }),
    grouping: one(ProgramGrouping, {
      fields: [ExternalCollectionPrograms.groupingId],
      references: [ProgramGrouping.uuid],
    }),
  }),
);
