import { Program } from './Program.js';
import { Resolution } from './misc.js';
import { ChannelIconSchema } from './schemas/channelSchema.js';
import z from 'zod';

export type Watermark = {
  url?: string;
  enabled: boolean;
  position: string;
  width: number;
  verticalMargin: number;
  horizontalMargin: number;
  duration: number;
  fixedSize: boolean;
  animated: boolean;
};

export type FillerCollection = {
  id: string;
  weight: number;
  cooldownSeconds: number;
};

export type ChannelTranscodingOptions = {
  targetResolution: Resolution;
  videoBitrate?: number;
  videoBufferSize?: number;
};

export type ChannelOffline = {
  picture?: string;
  soundtrack?: string;
  mode: string;
};

export type ChannelIcon = z.infer<typeof ChannelIconSchema>;

export type Channel = {
  number: number;
  watermark?: Watermark;
  fillerCollections?: FillerCollection[];
  programs: Program[];
  icon: ChannelIcon;
  guideMinimumDurationSeconds: number;
  groupTitle: string;
  disableFillerOverlay: boolean;
  // iconWidth: number;
  // iconDuration: number;
  // iconPosition: string;
  // startTime: Date;
  startTimeEpoch: number;
  offline: ChannelOffline;
  // offlinePicture: string;
  // offlineSoundtrack: string;
  // offlineMode: string;
  name: string;
  transcoding?: ChannelTranscodingOptions;
  duration: number;
  fallback: Program[];
  stealth: boolean;
  guideFlexPlaceholder?: string;
  fillerRepeatCooldown?: number;
};
