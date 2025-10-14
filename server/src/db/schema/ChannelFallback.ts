import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Selectable } from 'kysely';
import { Channel } from './Channel.ts';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { Program } from './Program.ts';

export const ChannelFallback = sqliteTable(
  'channel_custom_show',
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

export type ChannelFallbackTable = KyselifyBetter<typeof ChannelFallback>;
export type ChannelFallback = Selectable<ChannelFallbackTable>;
