import {
  ChannelIconSchema,
  ChannelOfflineSchema,
  ChannelTranscodingOptionsSchema,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { ColumnType, Insertable, JSONColumnType, Selectable } from 'kysely';
import { find, isEmpty, pickBy } from 'lodash-es';
import { isDefined } from '../../../util/index.js';
import {
  ChannelOfflineSettings,
  ChannelTranscodingSettings,
  ChannelWatermark,
  ChannelWatermarkSchema,
} from '../../entities/Channel';
import {
  ChannelIcon,
  ChannelStreamMode,
  WithCreatedAt,
  WithUpdatedAt,
  WithUuid,
} from './base';

export interface ChannelTable extends WithUuid, WithCreatedAt, WithUpdatedAt {
  disableFillerOverlay: ColumnType<boolean, boolean | undefined>;
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

export type Channel = Selectable<ChannelTable>;
export type NewChannel = Insertable<ChannelTable>;

export interface ChannelFillerShowTable {
  channelUuid: string;
  cooldown: number;
  fillerShowUuid: string;
  weight: number;
}

export type ChannelFillerShow = Selectable<ChannelFillerShowTable>;

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

export function channelToInsertable(channel: Channel): NewChannel {
  const parseResults = {
    icon: ChannelIconSchema.safeParse(channel.icon),
    offline: ChannelOfflineSchema.safeParse(channel.offline),
    transcode: channel.transcoding
      ? ChannelTranscodingOptionsSchema.safeParse(channel.transcoding)
      : null,
    watermark: channel.watermark
      ? ChannelWatermarkSchema.safeParse(channel.watermark)
      : null,
  };

  const errors = pickBy(parseResults, (res) => res !== null && !res?.success);
  if (!isEmpty(errors)) {
    const error = find(errors, (err) => isDefined(err?.error));
    if (error) throw error;
    throw new Error('Invalid channel schema');
  }

  return {
    uuid: channel.uuid,
    createdAt: +dayjs(),
    updatedAt: +dayjs(),
    disableFillerOverlay: channel.disableFillerOverlay,
    duration: channel.duration,
    fillerRepeatCooldown: channel.fillerRepeatCooldown,
    groupTitle: channel.groupTitle,
    guideFlexTitle: channel.guideFlexTitle,
    guideMinimumDuration: channel.guideMinimumDuration,
    icon: JSON.stringify(parseResults.icon.data),
    name: channel.name,
    number: channel.number,
    offline: JSON.stringify(parseResults.offline.data),
    startTime: channel.startTime,
    stealth: channel.stealth,
    streamMode: channel.streamMode,
    transcoding: parseResults.transcode
      ? JSON.stringify(parseResults.transcode.data)
      : null,
    watermark: parseResults.watermark
      ? JSON.stringify(parseResults.watermark.data)
      : null,
  } satisfies NewChannel;
}
