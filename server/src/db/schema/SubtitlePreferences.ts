import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import type { TupleToUnion } from '../../types/util.ts';
import { Channel } from './Channel.ts';
import { CustomShow } from './CustomShow.ts';
import type { KyselifyBetter } from './KyselifyBetter.ts';

export const SubtitleFilters = ['none', 'forced', 'default', 'any'] as const;

const commonSubtitlePreferenceCols = {
  uuid: text().primaryKey(),
  // iso6392 - 3-letter code
  languageCode: text().notNull(),
  priority: integer().notNull(),
  allowImageBased: integer({ mode: 'boolean' }).notNull().default(true),
  allowExternal: integer({ mode: 'boolean' }).notNull().default(true),
  filterType: text({ enum: SubtitleFilters }).notNull().default('any'),
};

export const ChannelSubtitlePreferences = sqliteTable(
  'channel_subtitle_preferences',
  {
    ...commonSubtitlePreferenceCols,
    channelId: text()
      .notNull()
      .references(() => Channel.uuid, { onDelete: 'cascade' }),
  },
  (table) => [
    index('channel_priority_index').on(table.channelId, table.priority),
  ],
);

export type ChannelSubtitlePreferencesTable = KyselifyBetter<
  typeof ChannelSubtitlePreferences
>;
export type ChannelSubtitlePreferences =
  Selectable<ChannelSubtitlePreferencesTable>;
export type NewChannelSubtitlePreference =
  Insertable<ChannelSubtitlePreferencesTable>;

export const CustomShowSubtitlePreferences = sqliteTable(
  'custom_show_subtitle_preferences',
  {
    ...commonSubtitlePreferenceCols,
    customShowId: text()
      .notNull()
      .references(() => CustomShow.uuid, { onDelete: 'cascade' }),
  },
  (table) => [
    index('custom_show_priority_index').on(table.customShowId, table.priority),
  ],
);

export type CustomShowSubtitlePreferencesTable = KyselifyBetter<
  typeof CustomShowSubtitlePreferences
>;
export type CustomShowSubtitlePreferences =
  Selectable<CustomShowSubtitlePreferencesTable>;

type SubtitleFilter = TupleToUnion<typeof SubtitleFilters>;

const SubtitleFilter: Record<Capitalize<SubtitleFilter>, SubtitleFilter> = {
  None: 'none',
  Forced: 'forced',
  Default: 'default',
  Any: 'any',
} as const;
