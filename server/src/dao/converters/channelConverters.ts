import { Channel } from '@tunarr/types';
import { filter } from 'lodash-es';
import { ChannelAndLineup } from '../../types/internal.js';
import { isDefined, nilToUndefined } from '../../util/index.js';
import { DefaultChannelIcon } from '../entities/Channel.js';

export const dbChannelToApiChannel = ({
  channel,
  lineup,
}: ChannelAndLineup): Channel => {
  return {
    id: channel.uuid,
    number: channel.number,
    watermark: nilToUndefined(channel.watermark),
    // filler
    // programs
    // fallback
    icon: channel.icon ?? DefaultChannelIcon,
    guideMinimumDuration: channel.guideMinimumDuration,
    groupTitle: channel.groupTitle || '',
    disableFillerOverlay: channel.disableFillerOverlay,
    startTime: channel.startTime,
    offline: channel.offline,
    name: channel.name,
    transcoding: nilToUndefined(channel.transcoding),
    duration: channel.duration,
    stealth: channel.stealth,
    onDemand: {
      enabled: isDefined(lineup.onDemandConfig),
    },
    programCount: filter(lineup.items, { type: 'content' }).length,
  };
};
