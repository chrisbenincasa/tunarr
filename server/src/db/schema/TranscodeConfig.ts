import type { Resolution, TupleToUnion } from '@tunarr/types';
import { inArray } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable, Updateable } from 'kysely';
import { v4 } from 'uuid';
import { VideoFormats } from '../../ffmpeg/builder/constants.ts';
import { booleanToNumber } from '../../util/sqliteUtil.ts';
import { type KyselifyBetter } from './KyselifyBetter.ts';

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

export const HardwareAccelerationMode: Record<
  Capitalize<HardwareAccelerationMode>,
  HardwareAccelerationMode
> = {
  Cuda: 'cuda' as const,
  None: 'none' as const,
  Qsv: 'qsv' as const,
  Videotoolbox: 'videotoolbox' as const,
  Vaapi: 'vaapi' as const,
} as const;

export const VaapiDrivers = [
  'system',
  'ihd',
  'i965',
  'radeonsi',
  'nouveau',
] as const;
export type VaapiDriver = TupleToUnion<typeof VaapiDrivers>;

export const TranscodeVideoOutputFormats = [
  VideoFormats.H264,
  VideoFormats.Hevc,
  VideoFormats.Mpeg2Video,
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

export const TranscodeConfigColumns: (keyof TranscodeConfigTable)[] = [
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
  readonly `${Alias}.${keyof TranscodeConfigTable}`[];

export const AllTranscodeConfigColumns: TranscodeConfigFields =
  TranscodeConfigColumns.map((key) => `transcodeConfig.${key}` as const);

export const TranscodeConfig = sqliteTable(
  'transcode_config',
  {
    uuid: text().primaryKey(),
    name: text().notNull(),
    threadCount: integer().notNull(),
    hardwareAccelerationMode: text({
      enum: HardwareAccelerationModes,
    }).notNull(),
    vaapiDriver: text({ enum: VaapiDrivers }).notNull().default('system'),
    vaapiDevice: text(),
    resolution: text({ mode: 'json' }).$type<Resolution>().notNull(),
    videoFormat: text({ enum: TranscodeVideoOutputFormats }).notNull(),
    videoProfile: text(),
    videoPreset: text(),
    videoBitDepth: integer().$type<8 | 10>().default(8), // TODO: See if we want to represent this differently
    videoBitRate: integer().notNull(),
    videoBufferSize: integer().notNull(),

    audioChannels: integer().notNull(),
    audioFormat: text({ enum: TranscodeAudioOutputFormats }).notNull(),
    audioBitRate: integer().notNull(),
    audioBufferSize: integer().notNull(),
    audioSampleRate: integer().notNull(),
    audioVolumePercent: integer().notNull().default(100), // Default 100

    normalizeFrameRate: integer({ mode: 'boolean' }).default(false),
    deinterlaceVideo: integer({ mode: 'boolean' }).default(true),
    disableChannelOverlay: integer({ mode: 'boolean' }).default(false),

    errorScreen: text({ enum: ErrorScreenTypes }).default('pic').notNull(),
    errorScreenAudio: text({ enum: ErrorScreenAudioTypes })
      .default('silent')
      .notNull(),

    isDefault: integer({ mode: 'boolean' }).default(false).notNull(),

    disableHardwareDecoder: integer({ mode: 'boolean' }).default(false),
    disableHardwareEncoding: integer({ mode: 'boolean' }).default(false),
    disableHardwareFilters: integer({ mode: 'boolean' }).default(false),
  },
  (table) => [
    check(
      'transcode_config_hardware_accel_check',
      inArray(
        table.hardwareAccelerationMode,
        table.hardwareAccelerationMode.enumValues,
      ).inlineParams(),
    ),
    check(
      'transcode_config_vaapi_driver_check',
      inArray(table.vaapiDriver, table.vaapiDriver.enumValues).inlineParams(),
    ),
    check(
      'transcode_config_video_format_check',
      inArray(table.videoFormat, table.videoFormat.enumValues).inlineParams(),
    ),
    check(
      'transcode_config_audio_format_check',
      inArray(table.audioFormat, table.audioFormat.enumValues).inlineParams(),
    ),
    check(
      'transcode_config_error_screen_check',
      inArray(table.errorScreen, table.errorScreen.enumValues).inlineParams(),
    ),
    check(
      'transcode_config_error_screen_audio_check',
      inArray(
        table.errorScreenAudio,
        table.errorScreenAudio.enumValues,
      ).inlineParams(),
    ),
  ],
);

export type TranscodeConfigTable = KyselifyBetter<typeof TranscodeConfig>;
export type TranscodeConfig = Selectable<TranscodeConfigTable>;
export type NewTranscodeConfig = Insertable<TranscodeConfigTable>;
export type TranscodeConfigUpdate = Updateable<TranscodeConfigTable>;

export const defaultTranscodeConfig = (
  isDefault?: boolean,
): NewTranscodeConfig => {
  return {
    threadCount: 0,
    audioBitRate: 192,
    audioBufferSize: 192 * 2,
    audioChannels: 2,
    audioFormat: 'aac',
    audioSampleRate: 48,
    hardwareAccelerationMode: 'none',
    name: isDefault ? 'Default' : `h264 @ 1920x1080`,
    resolution: JSON.stringify({
      widthPx: 1920,
      heightPx: 1080,
    } satisfies Resolution),
    uuid: v4(),
    videoBitRate: 2000,
    videoBufferSize: 4000,
    videoFormat: 'h264',
    disableChannelOverlay: booleanToNumber(false),
    normalizeFrameRate: booleanToNumber(false),
    videoBitDepth: 8,
    isDefault: booleanToNumber(!!isDefault),
  };
};
