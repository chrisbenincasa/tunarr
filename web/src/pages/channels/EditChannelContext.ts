import { SaveChannelRequest } from '@tunarr/types';
import { createContext } from 'react';
import { FieldPath } from 'react-hook-form';

export type ChannelEditTab = 'properties' | 'flex' | 'epg' | 'ffmpeg';

export type ChannelEditContextState = {
  isNewChannel: boolean;
  currentTab: ChannelEditTabProps;
};

export type ChannelEditTabProps = {
  value: ChannelEditTab;
  description: string;
  fields: FieldPath<SaveChannelRequest>[];
  next?: ChannelEditTab;
  prev?: ChannelEditTab;
};

export const channelEditTabs: ChannelEditTabProps[] = [
  {
    value: 'properties',
    description: 'Properties',
    fields: ['number', 'name', 'groupTitle', 'icon'],
    next: 'flex',
  },
  {
    value: 'flex',
    description: 'Flex',
    fields: ['offline', 'fillerCollections', 'fillerRepeatCooldown'],
    next: 'epg',
    prev: 'properties',
  },
  {
    value: 'epg',
    description: 'EPG',
    fields: ['stealth', 'guideFlexTitle', 'guideMinimumDuration'],
    next: 'ffmpeg',
    prev: 'flex',
  },
  {
    value: 'ffmpeg',
    description: 'FFMPEG',
    fields: ['transcoding', 'watermark'],
    prev: 'epg',
  },
];

export const ChannelEditContext = createContext<ChannelEditContextState>({
  currentTab: channelEditTabs[0],
  isNewChannel: true,
});
