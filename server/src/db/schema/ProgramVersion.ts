import type { InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable, Updateable } from 'kysely';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { Program } from './Program.ts';
import { ProgramChapter } from './ProgramChapter.ts';
import { ProgramMediaStream } from './ProgramMediaStream.ts';

export const VideoScanKind = ['unknown', 'progressive', 'interlaced'] as const;

export const ProgramVersion = sqliteTable(
  'program_version',
  {
    uuid: text().primaryKey(),
    createdAt: integer().notNull(),
    updatedAt: integer().notNull(),
    duration: integer().notNull(),
    sampleAspectRatio: text().notNull(),
    displayAspectRatio: text().notNull(),
    frameRate: text(),
    scanKind: text({ enum: VideoScanKind }),
    width: integer(),
    height: integer(),

    // Join
    programId: text()
      .notNull()
      .references(() => Program.uuid, { onDelete: 'cascade' }),
  },
  (table) => [index('index_program_version_program_id').on(table.programId)],
);

export const ProgramVersionRelations = relations(
  ProgramVersion,
  ({ one, many }) => ({
    program: one(Program, {
      fields: [ProgramVersion.programId],
      references: [Program.uuid],
      relationName: 'versions',
    }),
    mediaStreams: many(ProgramMediaStream),
    chapters: many(ProgramChapter),
  }),
);

export type ProgramVersionTable = KyselifyBetter<typeof ProgramVersion>;
export type ProgramVersion = Selectable<ProgramVersionTable>;
export type ProgramVersionOrm = InferSelectModel<typeof ProgramVersion>;
export type NewProgramVersionDao = Insertable<ProgramVersionTable>;
export type ProgramVersionUpdate = Updateable<ProgramVersionTable>;
