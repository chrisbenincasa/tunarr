import type { InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  getTableConfig,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable, Updateable } from 'kysely';
import {
  ChannelStreamModes,
  type ChannelIcon,
  type ChannelOfflineSettings,
  type ChannelTranscodingSettings,
  type ChannelWatermark,
} from './base.ts';
import { ChannelCustomShow } from './ChannelCustomShow.ts';
import { ChannelFillerShow } from './ChannelFillerShow.ts';
import { ChannelPrograms } from './ChannelPrograms.ts';
import type { KyselifyBetter } from './KyselifyBetter.ts';

export const Channel = sqliteTable('channel', {
  uuid: text().primaryKey(),
  createdAt: integer(),
  updatedAt: integer(),
  disableFillerOverlay: integer({ mode: 'boolean' }).default(false),
  duration: integer().notNull(),
  fillerRepeatCooldown: integer(),
  groupTitle: text(),
  guideFlexTitle: text(),
  guideMinimumDuration: integer().notNull(),
  icon: text({ mode: 'json' }).$type<ChannelIcon>().notNull(),
  name: text().notNull(),
  number: integer().notNull().unique(),
  offline: text({ mode: 'json' }).$type<ChannelOfflineSettings>().notNull(),
  startTime: integer().notNull(),
  stealth: integer({ mode: 'boolean' }).default(false),
  streamMode: text({ enum: ChannelStreamModes }).default('hls').notNull(),
  transcoding: text({ mode: 'json' }).$type<ChannelTranscodingSettings>(),
  transcodeConfigId: text().notNull(),
  watermark: text({ mode: 'json' }).$type<ChannelWatermark>(),
  subtitlesEnabled: integer({ mode: 'boolean' }).default(false),
});

export type ChannelTable = KyselifyBetter<typeof Channel>;

type ChannelFields<Alias extends string = 'channel'> =
  readonly `${Alias}.${keyof ChannelTable}`[];

const ChannelTableKeys = getTableConfig(Channel).columns.map(
  (col) => col.name,
) as (keyof (typeof Channel)['_']['columns'])[];

export const AllChannelTableKeys: ChannelFields = ChannelTableKeys.map(
  (key) => `channel.${key}` as const,
);

export type Channel = Selectable<ChannelTable>;
export type NewChannel = Insertable<ChannelTable>;
export type ChannelUpdate = Updateable<ChannelTable>;
export type ChannelOrm = InferSelectModel<typeof Channel>;

export const ChannelRelations = relations(Channel, ({ many }) => ({
  channelPrograms: many(ChannelPrograms),
  channelCustomShows: many(ChannelCustomShow),
  channelFillerShow: many(ChannelFillerShow),
}));
