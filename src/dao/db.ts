export type Program = {};

export type Watermark = {};

export type FillerCollection = {};

export type ChannelTranscodingOptions = {};

export type Channel = {
  number: number;
  watermark?: Watermark;
  fillerCollections?: FillerCollection[];
  programs?: Program[];
  icon: string;
  guideMinimumDurationSeconds: number;
  groupTitle: string;
  disableFillerOverlay: boolean;
  iconWidth: number;
  iconDuration: number;
  iconPosition: string;
  startTime: Date; // change to millis
  offlinePicture: string;
  offlineSoundtrack: string;
  offlineMode: string;
  name: string;
  transcoding?: ChannelTranscodingOptions;
  duration: number;
};

export type FfmpegSettings = {
  configVersion: number;
  ffmpegPath: string;
  threads: number;
  concatMuxDelay: string;
  logFfmpeg: boolean;
  enableFFMPEGTranscoding: boolean;
  audioVolumePercent: number;
  videoEncoder: string;
  audioEncoder: string;
  targetResolution: string;
  videoBitrate: number;
  videoBufSize: number;
};

export type Settings = {};

export type Schema = {
  channels: Channel[];
};

export class Database {}
