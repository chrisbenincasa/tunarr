import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Program } from './Program.ts';

export const ProgramSubtitles = sqliteTable('program_subtitles', {
  uuid: text().primaryKey(),
  subtitleType: text({ enum: ['embedded', 'sidecar'] }).notNull(),
  streamIndex: integer(),
  codec: text().notNull(),
  default: integer({ mode: 'boolean' }).notNull().default(false),
  forced: integer({ mode: 'boolean' }).notNull().default(false),
  sdh: integer({ mode: 'boolean' }).notNull().default(false),
  language: text().notNull(),
  /**
   * A path Tunarr can open directly: either a sidecar discovered on a local
   * library, or the cached copy downloaded from a media source.
   */
  path: text(),
  /**
   * Where the media source says the subtitle file lives, in the media source's
   * own filesystem namespace. Only usable after applying the source's path
   * replacements, and only when Tunarr can see the same storage.
   */
  sourcePath: text(),
  /**
   * The source-relative route that serves the subtitle file over HTTP (Plex:
   * the stream key, Jellyfin/Emby: the subtitle delivery URL). Always usable,
   * at the cost of a network round trip.
   */
  sourceKey: text(),
  programId: text()
    .notNull()
    .references(() => Program.uuid, { onDelete: 'cascade' }),
  createdAt: integer({ mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer({ mode: 'timestamp_ms' }).notNull(),
  isExtracted: integer({ mode: 'boolean' }).default(false),
});

export const ProgramSubtitlesRelations = relations(
  ProgramSubtitles,
  ({ one }) => ({
    program: one(Program, {
      fields: [ProgramSubtitles.programId],
      references: [Program.uuid],
    }),
  }),
);

export type ProgramSubtitles = InferSelectModel<typeof ProgramSubtitles>;
export type NewProgramSubtitles = InferInsertModel<typeof ProgramSubtitles>;
