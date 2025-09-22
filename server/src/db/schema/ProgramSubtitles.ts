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
  path: text(),
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
