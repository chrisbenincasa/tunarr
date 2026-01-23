import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { Channel } from './Channel.ts';
import { FillerShow } from './FillerShow.ts';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { Program } from './Program.ts';

export const ProgramPlayHistory = sqliteTable(
  'program_play_history',
  {
    uuid: text().primaryKey(),
    programUuid: text()
      .notNull()
      .references(() => Program.uuid, { onDelete: 'cascade' }),
    channelUuid: text()
      .notNull()
      .references(() => Channel.uuid, { onDelete: 'cascade' }),
    // Timestamp when this program started playing (milliseconds since epoch)
    playedAt: integer({ mode: 'timestamp_ms' }).notNull(),
    // How long the program was played in milliseconds (useful for tracking partial plays)
    playedDuration: integer(),
    createdAt: integer({ mode: 'timestamp_ms' }).notNull(),
    fillerListId: text().references(() => FillerShow.uuid),
  },
  (table) => [
    index('program_play_history_program_uuid_index').on(table.programUuid),
    index('program_play_history_channel_uuid_index').on(
      table.channelUuid,
      table.programUuid,
      table.fillerListId,
    ),
    index('program_play_history_played_at_index').on(table.playedAt),
    // Composite index for querying play history by channel ordered by time
    index('program_play_history_channel_played_at_index').on(
      table.channelUuid,
      table.playedAt,
    ),
  ],
);

export type ProgramPlayHistoryTable = KyselifyBetter<typeof ProgramPlayHistory>;
export type ProgramPlayHistoryDao = Selectable<ProgramPlayHistoryTable>;
export type ProgramPlayHistoryOrm = InferSelectModel<typeof ProgramPlayHistory>;
export type NewProgramPlayHistoryDao = Insertable<ProgramPlayHistoryTable>;
export type NewProgramPlayHistoryDrizzle = InferInsertModel<
  typeof ProgramPlayHistory
>;

export const ProgramPlayHistoryRelations = relations(
  ProgramPlayHistory,
  ({ one }) => ({
    channel: one(Channel, {
      fields: [ProgramPlayHistory.channelUuid],
      references: [Channel.uuid],
    }),
    program: one(Program, {
      fields: [ProgramPlayHistory.programUuid],
      references: [Program.uuid],
    }),
  }),
);
