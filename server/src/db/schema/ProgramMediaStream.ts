import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { ProgramVersion } from './ProgramVersion.ts';

export const MediaStreamKind = [
  'video',
  'audio',
  'subtitles',
  'external_subtitles',
  'attachment',
] as const;

export const ProgramMediaStream = sqliteTable(
  'program_media_stream',
  {
    uuid: text().primaryKey(),
    index: integer().notNull(),
    codec: text().notNull(),
    profile: text(), //.notNull(),
    streamKind: text({ enum: MediaStreamKind }).notNull(),
    title: text(),

    // Audio
    language: text(), // Required?
    channels: integer(),
    default: integer({ mode: 'boolean' }).notNull().default(false),
    forced: integer({ mode: 'boolean' }).notNull().default(false),

    // Video
    pixelFormat: text(),
    colorRange: text(),
    colorSpace: text(),
    colorTransfer: text(),
    colorPrimaries: text(),
    bitsPerSample: integer(),

    // Join
    programVersionId: text()
      .notNull()
      .references(() => ProgramVersion.uuid, { onDelete: 'cascade' }),
  },
  (table) => [index('index_program_version_id').on(table.programVersionId)],
);

export const ProgramMediaStreamRelations = relations(
  ProgramMediaStream,
  ({ one }) => ({
    version: one(ProgramVersion, {
      fields: [ProgramMediaStream.programVersionId],
      references: [ProgramVersion.uuid],
    }),
  }),
);

export type ProgramMediaStreamTable = KyselifyBetter<typeof ProgramMediaStream>;
export type ProgramMediaStream = Selectable<ProgramMediaStreamTable>;
export type ProgramMediaStreamOrm = InferSelectModel<typeof ProgramMediaStream>;
export type NewProgramMediaStream = Insertable<ProgramMediaStreamTable>;
export type NewProgramMediaStreamOrm = InferInsertModel<
  typeof ProgramMediaStream
>;
