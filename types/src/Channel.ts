import { Program } from './Program.js';

export type Resolution = {
  widthPx: number;
  heightPx: number;
};

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

export type ChannelIcon = {
  path: string;
  width: number;
  duration: number;
  position: string;
};

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
