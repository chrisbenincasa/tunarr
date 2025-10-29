import { type Channel } from '@tunarr/types';
import { range } from 'lodash-es';
import { type MarkOptional } from 'ts-essentials';

export const OneDayMillis = 1000 * 60 * 60 * 24;
export const OneWeekMillis = OneDayMillis * 7;

// Special ID to use for in-progress entity operations
export const UnsavedId = 'unsaved';

export const DefaultFallbackPicturePath = '/images/generic-offline-screen.png';

// Default channel values that aren't dynamic
export const DefaultChannel: MarkOptional<
  Channel,
  'id' | 'name' | 'number' | 'startTime' | 'transcodeConfigId'
> = {
  duration: 0,
  icon: {
    duration: 0,
    path: '',
    position: 'bottom-right',
    width: 0,
  },
  guideMinimumDuration: 30000,
  fillerRepeatCooldown: 30000,
  groupTitle: 'tunarr',
  stealth: false,
  disableFillerOverlay: false,
  offline: {
    mode: 'pic',
    picture: '',
    soundtrack: '',
  },
  onDemand: {
    enabled: false,
  },
  programCount: 0,
  streamMode: 'hls',
  subtitlesEnabled: false,
} as const;

export const TranscodeResolutionOptions = [
  { value: '420x420', label: '420x420 (1:1)' },
  { value: '480x270', label: '480x270 (HD1080/16 16:9)' },
  { value: '576x320', label: '576x320 (18:10)' },
  { value: '640x360', label: '640x360 (nHD 16:9)' },
  { value: '720x480', label: '720x480 (WVGA 3:2)' },
  { value: '800x480', label: '800x480 (WVGA 15:9)' },
  { value: '854x480', label: '854x480 (FWVGA 16:9)' },
  { value: '800x600', label: '800x600 (SVGA 4:3)' },
  { value: '1024x768', label: '1024x768 (WXGA 4:3)' },
  { value: '1280x720', label: '1280x720 (HD 16:9)' },
  { value: '1920x1080', label: '1920x1080 (FHD 16:9)' },
  { value: '3840x2160', label: '3840x2160 (4K 16:9)' },
] as const;

export const Plex = 'plex';
export const Jellyfin = 'jellyfin';
export const Emby = 'emby';
export const Imported = 'imported';
export const Local = 'local';
export const Playlists = 'playlists';
export const Library = 'library';

export const AlphanumericCharCodes = [
  '#'.charCodeAt(0),
  ...range('a'.charCodeAt(0), 'z'.charCodeAt(0) + 1),
];
