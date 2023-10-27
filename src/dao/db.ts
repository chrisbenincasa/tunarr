import { once } from 'lodash-es';
import { argv } from '../args';
import path from 'path';

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

const defaultData: Schema = {
  channels: [],
};

export class Database {}

export const getDB = once(async () => {
  const { JSONPreset } = await import('lowdb/node');
  return JSONPreset<Schema>(
    path.resolve(argv.database, 'db.json'),
    defaultData,
  );
});
