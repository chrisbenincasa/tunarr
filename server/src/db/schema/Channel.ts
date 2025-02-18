import {
  integer,
  primaryKey,
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
import { CustomShow } from './CustomShow.ts';
import { FillerShow } from './FillerShow.ts';
import type { KyselifyBetter } from './KyselifyBetter.ts';
import { Program } from './Program.ts';

const Channel = sqliteTable('channel', {
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
});

export type ChannelTable = KyselifyBetter<typeof Channel>;

type ChannelFields<Alias extends string = 'channel'> =
  readonly `${Alias}.${keyof ChannelTable}`[];

const ChannelTableKeys: (keyof ChannelTable)[] = [
  'createdAt',
  'disableFillerOverlay',
  'duration',
  'fillerRepeatCooldown',
  'groupTitle',
  'guideFlexTitle',
  'guideMinimumDuration',
  'icon',
  'name',
  'number',
  'offline',
  'startTime',
  'stealth',
  'streamMode',
  'transcoding',
  'transcodeConfigId',
  'updatedAt',
  'uuid',
  'watermark',
];

export const AllChannelTableKeys: ChannelFields = ChannelTableKeys.map(
  (key) => `channel.${key}` as const,
);

export type Channel = Selectable<ChannelTable>;
export type NewChannel = Insertable<ChannelTable>;
export type ChannelUpdate = Updateable<ChannelTable>;

export const ChannelFillerShow = sqliteTable(
  'channel_filler_show',
  {
    channelUuid: text()
      .notNull()
      .references(() => Channel.uuid, { onDelete: 'cascade' }),
    fillerShowUuid: text()
      .notNull()
      .references(() => FillerShow.uuid, { onDelete: 'cascade' }),
    cooldown: integer().notNull(),
    weight: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.channelUuid, table.fillerShowUuid] }),
  ],
);

export type ChannelFillerShowTable = KyselifyBetter<typeof ChannelFillerShow>;
export type ChannelFillerShow = Selectable<ChannelFillerShowTable>;
export type NewChannelFillerShow = Insertable<ChannelFillerShowTable>;

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

export const ChannelCustomShow = sqliteTable(
  'channel_custom_show',
  {
    channelUuid: text()
      .notNull()
      .references(() => Channel.uuid, { onDelete: 'cascade' }),
    customShowUuid: text()
      .notNull()
      .references(() => CustomShow.uuid, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.channelUuid, table.customShowUuid] }),
  ],
);

export type ChannelCustomShowsTable = KyselifyBetter<typeof ChannelCustomShow>;
export type ChannelCustomShows = Selectable<ChannelCustomShowsTable>;

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
