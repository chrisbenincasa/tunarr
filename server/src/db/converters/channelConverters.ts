import { DefaultChannelIcon } from '@/db/schema/base.js';
import type { Channel, SubtitlePreference } from '@tunarr/types';
import { filter, orderBy } from 'lodash-es';
import {
  isDefined,
  isNonEmptyArray,
  nilToUndefined,
  nullToUndefined,
} from '../../util/index.ts';
import { numberToBoolean } from '../../util/sqliteUtil.ts';
import type { ChannelAndLineup } from '../interfaces/IChannelDB.ts';
import type {
  ChannelOrmWithRelations,
  ChannelWithRelations,
} from '../schema/derivedTypes.ts';

export const dbChannelToApiChannel = ({
  channel,
  lineup,
}: ChannelAndLineup<ChannelWithRelations>): Channel => {
  const subtitlePreferences = orderBy(
    channel.subtitlePreferences?.map(
      (pref) =>
        ({
          ...pref,
          allowExternal: numberToBoolean(pref.allowExternal),
          allowImageBased: numberToBoolean(pref.allowImageBased),
          filter: pref.filterType,
          langugeCode: pref.languageCode,
        }) satisfies SubtitlePreference,
    ),
    (pref) => pref.priority,
    'asc',
  );

  return {
    id: channel.uuid,
    number: channel.number,
    watermark: nilToUndefined(channel.watermark),
    fillerCollections: channel.fillerShows?.map((filler) => ({
      id: filler.fillerShowUuid,
      cooldownSeconds: filler.cooldown,
      weight: filler.weight,
    })),
    guideFlexTitle: nullToUndefined(channel.guideFlexTitle),
    icon: channel.icon ?? DefaultChannelIcon,
    guideMinimumDuration: channel.guideMinimumDuration,
    groupTitle: channel.groupTitle || '',
    disableFillerOverlay: channel.disableFillerOverlay === 1,
    fillerRepeatCooldown: nullToUndefined(channel.fillerRepeatCooldown),
    startTime: channel.startTime,
    offline: channel.offline,
    name: channel.name,
    transcoding: nilToUndefined(channel.transcoding),
    duration: channel.duration,
    stealth: channel.stealth === 1,
    onDemand: {
      enabled: isDefined(lineup.onDemandConfig),
    },
    programCount: filter(lineup.items, { type: 'content' }).length,
    streamMode: channel.streamMode,
    transcodeConfigId: channel.transcodeConfigId,
    subtitlesEnabled: numberToBoolean(channel.subtitlesEnabled),
    subtitlePreferences: isNonEmptyArray(subtitlePreferences)
      ? subtitlePreferences
      : undefined,
  };
};

export const ormChannelToApiChannel = ({
  channel,
  lineup,
}: ChannelAndLineup<ChannelOrmWithRelations>): Channel => {
  const subtitlePreferences = orderBy(
    channel.subtitlePreferences?.map(
      (pref) =>
        ({
          ...pref,
          allowExternal: numberToBoolean(pref.allowExternal),
          allowImageBased: numberToBoolean(pref.allowImageBased),
          filter: pref.filterType,
          langugeCode: pref.languageCode,
        }) satisfies SubtitlePreference,
    ),
    (pref) => pref.priority,
    'asc',
  );

  return {
    id: channel.uuid,
    number: channel.number,
    watermark: nilToUndefined(channel.watermark),
    fillerCollections: channel.fillerShows?.map((filler) => ({
      id: filler.fillerShowUuid,
      cooldownSeconds: filler.cooldown,
      weight: filler.weight,
    })),
    guideFlexTitle: nullToUndefined(channel.guideFlexTitle),
    icon: channel.icon ?? DefaultChannelIcon,
    guideMinimumDuration: channel.guideMinimumDuration,
    groupTitle: channel.groupTitle || '',
    disableFillerOverlay: channel.disableFillerOverlay ?? false,
    fillerRepeatCooldown: nullToUndefined(channel.fillerRepeatCooldown),
    startTime: channel.startTime,
    offline: channel.offline,
    name: channel.name,
    transcoding: nilToUndefined(channel.transcoding),
    duration: channel.duration,
    stealth: channel.stealth ?? false,
    onDemand: {
      enabled: isDefined(lineup.onDemandConfig),
    },
    programCount: filter(lineup.items, { type: 'content' }).length,
    streamMode: channel.streamMode,
    transcodeConfigId: channel.transcodeConfigId,
    subtitlesEnabled: channel.subtitlesEnabled ?? false,
    subtitlePreferences: isNonEmptyArray(subtitlePreferences)
      ? subtitlePreferences
      : undefined,
  };
};
