import {
  relations,
  sql,
  type InferInsertModel,
  type InferSelectModel,
} from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { Artwork } from './Artwork.ts';
import { MediaSource } from './MediaSource.ts';
import { MediaSourceLibrary } from './MediaSourceLibrary.ts';
import { Program } from './Program.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';
import { RemoteSourceTypes } from './base.ts';

export const ExtraTypes = [
  'clip',
  'trailer',
  'behind_the_scenes',
  'deleted_scene',
  'interview',
  'scene',
  'sample',
  'featurette',
  'short',
  'theme_song',
  'theme_video',
] as const;

export type ExtraType = (typeof ExtraTypes)[number];

export const ProgramExtra = sqliteTable(
  'program_extra',
  {
    uuid: text().primaryKey(),
    parentProgramUuid: text().references(() => Program.uuid, {
      onDelete: 'cascade',
    }),
    parentGroupingUuid: text().references(() => ProgramGrouping.uuid, {
      onDelete: 'cascade',
    }),
    extraType: text({ enum: ExtraTypes }).notNull(),
    title: text().notNull(),
    summary: text(),
    duration: integer().notNull(),
    externalKey: text().notNull(),
    sourceType: text({ enum: RemoteSourceTypes }).notNull(),
    mediaSourceId: text()
      .notNull()
      .references(() => MediaSource.uuid, { onDelete: 'cascade' }),
    libraryId: text().references(() => MediaSourceLibrary.uuid, {
      onDelete: 'cascade',
    }),
    filePath: text(),
    canonicalId: text(),
    state: text({ enum: ['ok', 'missing'] }).notNull().default('ok'),
    createdAt: integer({ mode: 'timestamp_ms' }),
    updatedAt: integer({ mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('unique_program_extra').on(
      table.sourceType,
      table.mediaSourceId,
      table.externalKey,
    ),
    index('program_extra_program_idx').on(table.parentProgramUuid, table.extraType),
    index('program_extra_grouping_idx').on(table.parentGroupingUuid, table.extraType),
    check(
      'one_parent_required',
      sql`(${table.parentProgramUuid} IS NOT NULL AND ${table.parentGroupingUuid} IS NULL)
          OR (${table.parentProgramUuid} IS NULL AND ${table.parentGroupingUuid} IS NOT NULL)`,
    ),
  ],
);

export const ProgramExtraRelations = relations(ProgramExtra, ({ one, many }) => ({
  parentProgram: one(Program, {
    fields: [ProgramExtra.parentProgramUuid],
    references: [Program.uuid],
  }),
  parentGrouping: one(ProgramGrouping, {
    fields: [ProgramExtra.parentGroupingUuid],
    references: [ProgramGrouping.uuid],
  }),
  artwork: many(Artwork),
}));

export type ProgramExtraOrm = InferSelectModel<typeof ProgramExtra>;
export type NewProgramExtra = InferInsertModel<typeof ProgramExtra>;
