import { Resolution, TupleToUnion } from '@tunarr/types';
import {
  Generated,
  Insertable,
  JSONColumnType,
  Selectable,
  Updateable,
} from 'kysely';
import { WithUuid } from './base.ts';

export const HardwareAccelerationModes = [
  'none',
  'cuda',
  'vaapi',
  'qsv',
  'videotoolbox',
] as const;

export type HardwareAccelerationMode = TupleToUnion<
  typeof HardwareAccelerationModes
>;

export const VaapiDrivers = [
  'system',
  'ihd',
  'i965',
  'radeonsi',
  'nouveau',
] as const;
export type VaapiDriver = TupleToUnion<typeof VaapiDrivers>;

export const TranscodeVideoOutputFormats = [
  'h264',
  'hevc',
  'mpeg2video',
] as const;

export type TranscodeVideoOutputFormat = TupleToUnion<
  typeof TranscodeVideoOutputFormats
>;

export const TranscodeVideoOutputFormat = {
  H264: 'h264' as const,
  Hevc: 'hevc' as const,
  Mpeg2Video: 'mpeg2video' as const,
} as const;

export const TranscodeAudioOutputFormats = [
  'aac',
  'ac3',
  'copy',
  'mp3',
] as const;

export type TranscodeAudioOutputFormat = TupleToUnion<
  typeof TranscodeAudioOutputFormats
>;

export const TranscodeAudioOutputFormat = {
  Aac: 'aac' as const,
  Ac3: 'ac3' as const,
  Copy: 'copy' as const,
  Mp3: 'mp3' as const,
} as const;

export const ErrorScreenTypes = [
  'static',
  'pic',
  'blank',
  'testsrc',
  'text',
  'kill',
] as const;
export type ErrorScreenType = TupleToUnion<typeof ErrorScreenTypes>;

export const ErrorScreenAudioTypes = ['silent', 'sine', 'whitenoise'] as const;
export type ErrorScreenAudioType = TupleToUnion<typeof ErrorScreenAudioTypes>;

export const TranscodeConfigColumns: (keyof TrannscodeConfigTable)[] = [
  'audioBitRate',
  'audioBufferSize',
  'audioChannels',
  'audioFormat',
  'audioSampleRate',
  'audioVolumePercent',
  'deinterlaceVideo',
  'disableChannelOverlay',
  'errorScreen',
  'errorScreenAudio',
  'hardwareAccelerationMode',
  'isDefault',
  'name',
  'normalizeFrameRate',
  'resolution',
  'threadCount',
  'uuid',
  'vaapiDevice',
  'vaapiDriver',
  'videoBitDepth',
  'videoBitRate',
  'videoBufferSize',
  'videoFormat',
  'videoPreset',
  'videoProfile',
] as const;

type TranscodeConfigFields<Alias extends string = 'transcodeConfig'> =
  readonly `${Alias}.${keyof TrannscodeConfigTable}`[];

export const AllTranscodeConfigColumns: TranscodeConfigFields =
  TranscodeConfigColumns.map((key) => `transcodeConfig.${key}` as const);

export interface TrannscodeConfigTable extends WithUuid {
  name: string;
  threadCount: number;
  hardwareAccelerationMode: HardwareAccelerationMode;
  vaapiDriver: Generated<VaapiDriver>;
  vaapiDevice: string | null;
  resolution: JSONColumnType<Resolution>;
  videoFormat: TranscodeVideoOutputFormat;
  videoProfile: string | null;
  videoPreset: string | null;
  // default 8
  videoBitDepth: 8 | 10 | null; // TODO: See if we want to represent this differently
  videoBitRate: number;
  videoBufferSize: number;

  audioChannels: number;
  audioFormat: TranscodeAudioOutputFormat;
  audioBitRate: number;
  audioBufferSize: number;
  audioSampleRate: number;
  audioVolumePercent: Generated<number>; // Default 100

  normalizeFrameRate: Generated<number>; // Boolean
  deinterlaceVideo: Generated<number>; // Boolean
  disableChannelOverlay: Generated<number>; // Boolean

  errorScreen: Generated<ErrorScreenType>;
  errorScreenAudio: Generated<ErrorScreenAudioType>;

  isDefault: Generated<number>; // boolean,
}

export type TranscodeConfig = Selectable<TrannscodeConfigTable>;
export type NewTranscodeConfig = Insertable<TrannscodeConfigTable>;
export type TranscodeConfigUpdate = Updateable<TrannscodeConfigTable>;
