import { relations } from 'drizzle-orm';
import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { Channel } from './Channel.ts';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { Program } from './Program.ts';

export const ChannelPrograms = sqliteTable(
  'channel_programs',
  {
    channelUuid: text()
      .notNull()
      .references(() => Channel.uuid, { onDelete: 'cascade' }),
    programUuid: text()
      .notNull()
      .references(() => Program.uuid, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.channelUuid, table.programUuid] })],
);

export type ChannelProgramsTable = KyselifyBetter<typeof ChannelPrograms>;
export type ChannelPrograms = Selectable<ChannelProgramsTable>;
export type NewChannelProgram = Insertable<ChannelProgramsTable>;

export const ChannelProgramsRelations = relations(
  ChannelPrograms,
  ({ one }) => ({
    channel: one(Channel, {
      fields: [ChannelPrograms.channelUuid],
      references: [Channel.uuid],
    }),
    program: one(Program, {
      fields: [ChannelPrograms.programUuid],
      references: [Program.uuid],
    }),
  }),
);
