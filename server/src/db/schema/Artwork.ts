import type { TupleToUnion } from '@tunarr/types';
import {
  relations,
  type InferInsertModel,
  type InferSelectModel,
} from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Credit } from './Credit.ts';
import { Program } from './Program.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';

export const ArtworkTypes = [
  'poster',
  'thumbnail',
  'logo',
  'fanart',
  'watermark',
  'banner',
  'landscape',
] as const;

export type ArtworkType = TupleToUnion<typeof ArtworkTypes>;

type ArtworkTypeMap = {
  [K in Capitalize<ArtworkType>]: Lowercase<K>;
};

export const ArtworkType: ArtworkTypeMap = {
  Banner: 'banner',
  Fanart: 'fanart',
  Poster: 'poster',
  Thumbnail: 'thumbnail',
  Logo: 'logo',
  Watermark: 'watermark',
  Landscape: 'landscape',
};

export const Artwork = sqliteTable(
  'artwork',
  {
    uuid: text().primaryKey(),
    cachePath: text(),
    sourcePath: text().notNull(),
    artworkType: text({ enum: ArtworkTypes }).notNull(),
    blurHash43: text(),
    blurHash64: text(),
    programId: text().references(() => Program.uuid, { onDelete: 'cascade' }),
    groupingId: text().references(() => ProgramGrouping.uuid, {
      onDelete: 'cascade',
    }),
    creditId: text().references(() => Credit.uuid, { onDelete: 'cascade' }),
    createdAt: integer({ mode: 'timestamp_ms' }),
    updatedAt: integer({ mode: 'timestamp_ms' }),
  },
  (table) => [
    index('artwork_program_idx').on(table.programId),
    index('artwork_grouping_idx').on(table.groupingId),
    index('artwork_credit_idx').on(table.creditId),
  ],
);

export const ArtworkRelations = relations(Artwork, ({ one }) => ({
  program: one(Program, {
    fields: [Artwork.programId],
    references: [Program.uuid],
  }),
  programGrouping: one(ProgramGrouping, {
    fields: [Artwork.groupingId],
    references: [ProgramGrouping.uuid],
  }),
  credit: one(Credit, {
    fields: [Artwork.creditId],
    references: [Credit.uuid],
  }),
}));

export type Artwork = InferSelectModel<typeof Artwork>;
export type NewArtwork = InferInsertModel<typeof Artwork>;
