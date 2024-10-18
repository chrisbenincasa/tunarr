import {
  ColumnType,
  Generated,
  Insertable,
  JSONColumnType,
  Selectable,
  Updateable,
} from 'kysely';
import {
  ChannelOfflineSettings,
  ChannelTranscodingSettings,
  ChannelWatermark,
} from '../../entities/Channel.ts';
import {
  ChannelIcon,
  ChannelStreamMode,
  WithCreatedAt,
  WithUpdatedAt,
  WithUuid,
} from './base.ts';

export interface ChannelTable extends WithUuid, WithCreatedAt, WithUpdatedAt {
  disableFillerOverlay: Generated<number>;
  duration: number;
  fillerRepeatCooldown: number | null;
  groupTitle: string | null;
  guideFlexTitle: string | null;
  guideMinimumDuration: number;
  icon: JSONColumnType<ChannelIcon>;
  name: string;
  number: number;
  offline: JSONColumnType<ChannelOfflineSettings>;
  startTime: number;
  stealth: ColumnType<number, number | undefined>;
  streamMode: ColumnType<ChannelStreamMode, ChannelStreamMode | undefined>;
  transcoding: JSONColumnType<ChannelTranscodingSettings | null, string | null>;
  watermark: JSONColumnType<ChannelWatermark | null, string | null>;
}

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

export interface ChannelFillerShowTable {
  channelUuid: string;
  cooldown: number;
  fillerShowUuid: string;
  weight: number;
}

export type ChannelFillerShow = Selectable<ChannelFillerShowTable>;
export type NewChannelFillerShow = Insertable<ChannelFillerShowTable>;

export interface ChannelFallbackTable {
  channelUuid: string;
  programUuid: string;
}

export type ChannelFallback = Selectable<ChannelFallbackTable>;

export interface ChannelCustomShowsTable {
  channelUuid: string;
  customShowUuid: string;
}

export type ChannelCustomShows = Selectable<ChannelCustomShowsTable>;

export interface ChannelProgramsTable {
  channelUuid: string;
  programUuid: string;
}

export type ChannelPrograms = Selectable<ChannelProgramsTable>;
export type NewChannelProgram = Insertable<ChannelProgramsTable>;
