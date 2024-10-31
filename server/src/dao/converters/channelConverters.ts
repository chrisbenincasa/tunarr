import { Channel } from '@tunarr/types';
import { filter } from 'lodash-es';
import { ChannelAndLineup } from '../../types/internal.js';
import {
  isDefined,
  nilToUndefined,
  nullToUndefined,
} from '../../util/index.js';
import { DefaultChannelIcon } from '../direct/schema/base.ts';

export const dbChannelToApiChannel = ({
  channel,
  lineup,
}: ChannelAndLineup): Channel => {
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
  };
};
