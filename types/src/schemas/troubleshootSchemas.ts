import z from 'zod/v4';
import { ChannelSchema } from './channelSchema.js';
import { TranscodeConfigSchema } from './transcodeConfigSchemas.js';

export const TroubleshootRequestSchema = z.object({
  programId: z.uuid(),
  channelId: z.uuid(),
  transcodeConfigId: z.uuid().optional(),
  testDurationSeconds: z.number().min(5).max(120).default(30),
});

export type TroubleshootRequest = z.infer<typeof TroubleshootRequestSchema>;

const VideoStreamInfoSchema = z.object({
  index: z.number(),
  codec: z.string(),
  profile: z.string().optional(),
  width: z.number(),
  height: z.number(),
  framerate: z.string().optional(),
  pixelFormat: z.string().optional(),
  bitDepth: z.number().optional(),
  colorRange: z.string().optional(),
  colorSpace: z.string().optional(),
  colorTransfer: z.string().optional(),
  colorPrimaries: z.string().optional(),
  sampleAspectRatio: z.string().optional(),
  displayAspectRatio: z.string().optional(),
  bitrate: z.number().optional(),
});

const AudioStreamInfoSchema = z.object({
  index: z.number(),
  codec: z.string(),
  language: z.string().optional(),
  channels: z.number().optional(),
  title: z.string().optional(),
  default: z.boolean().optional(),
  selected: z.boolean().optional(),
  forced: z.boolean().optional(),
  bitrate: z.number().optional(),
});

const SubtitleStreamInfoSchema = z.object({
  index: z.number(),
  codec: z.string(),
  language: z.string().optional(),
  title: z.string().optional(),
  type: z.enum(['embedded', 'external']).optional(),
  default: z.boolean().optional(),
  forced: z.boolean().optional(),
  sdh: z.boolean().optional(),
});

const StreamSelectionRuleTraceSchema = z.object({
  label: z.string().optional(),
  condition: z.string(),
  matched: z.boolean(),
  audioAction: z.string().optional(),
  subtitleAction: z.string().optional(),
});

export const StreamSelectionTraceSchema = z.object({
  profileName: z.string().optional(),
  profileSource: z.string().optional(),
  rules: StreamSelectionRuleTraceSchema.array(),
  selectedAudioStream: AudioStreamInfoSchema.optional(),
  selectedSubtitleStream: SubtitleStreamInfoSchema.nullable().optional(),
  subtitleReason: z.string().optional(),
});

const PipelineInfoSchema = z.object({
  hardwareAccelMode: z.string(),
  builderType: z.string(),
  pipelineSteps: z.string().array(),
  ffmpegArgs: z.string().array(),
  ffmpegArgsString: z.string(),
  environmentVariables: z.record(z.string(), z.string()),
});

const TranscodeTimingsSchema = z.object({
  ffmpegStartToFirstSegmentMs: z.number().optional(),
  ffmpegStartToPlaylistMs: z.number().optional(),
  ffmpegStartToStreamReadyMs: z.number().optional(),
  totalTranscodeDurationMs: z.number(),
  segmentsProduced: z.number(),
});

const TestTranscodeResultSchema = z.object({
  exitCode: z.number().nullable(),
  signal: z.string().nullable(),
  success: z.boolean(),
  stderrOutput: z.string(),
  durationProcessed: z.string().optional(),
  hlsSessionId: z.string().optional(),
  timings: TranscodeTimingsSchema.optional(),
});

export const TroubleshootResultSchema = z.object({
  systemInfo: z.object({
    tunarrVersion: z.string(),
    ffmpegVersion: z.string(),
    nodeVersion: z.string(),
    platform: z.string(),
    arch: z.string(),
    availableHwAccels: z.string().array(),
  }),
  mediaInfo: z
    .object({
      title: z.string(),
      type: z.string(),
      duration: z.number(),
      sourceType: z.string().optional(),
      streamSourceType: z.string().optional(),
      streamSourcePath: z.string().optional(),
      videoStreams: VideoStreamInfoSchema.array(),
      audioStreams: AudioStreamInfoSchema.array(),
      subtitleStreams: SubtitleStreamInfoSchema.array(),
    })
    .optional(),
  transcodeConfig: TranscodeConfigSchema.optional(),
  channelConfig: ChannelSchema.optional(),
  streamSelection: StreamSelectionTraceSchema.optional(),
  pipeline: PipelineInfoSchema.optional(),
  testTranscode: TestTranscodeResultSchema.optional(),
  ffmpegLog: z.string().optional(),
  errors: z.string().array(),
  timestamp: z.string(),
});

export type TroubleshootResult = z.infer<typeof TroubleshootResultSchema>;
