import { Channel } from '@tunarr/types';
import { MarkOptional } from 'ts-essentials';

export const OneDayMillis = 1000 * 60 * 60 * 24;

// Special ID to use for in-progress entity operations
export const UnsavedId = 'unsaved';

// Default channel values that aren't dynamic
export const DefaultChannel: MarkOptional<
  Channel,
  'id' | 'name' | 'number' | 'startTime'
> = {
  duration: 0,
  icon: {
    duration: 0,
    path: '',
    position: 'bottom-right',
    width: 0,
  },
  guideMinimumDuration: 30000,
  fillerRepeatCooldown: 30,
  groupTitle: 'tunarr',
  stealth: false,
  disableFillerOverlay: false,
  offline: {
    mode: 'pic',
    // TODO: Make this work with the backend settings
    picture: 'http://localhost:8000/images/generic-offline-screen.png',
    soundtrack: '',
  },
  onDemand: {
    enabled: false,
  },
  programCount: 0,
} as const;
