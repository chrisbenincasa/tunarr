// Generated from schema/playout.json by scripts/generate-etv-schemas.ts.
// Do not edit. Refinements belong in the hand-written files one level up.

import { z } from 'zod/v4';

/** Probe metadata for a single audio stream. */
export const AudioHintSchema = z.strictObject({
  stream_index: z.number().int().min(0),
  codec: z.string(),
  channels: z.number().int().min(0),
});
export type AudioHint = z.infer<typeof AudioHintSchema>;

/** A placeholder source resolved at playback time by fetching a `PlayoutItem` JSON document over HTTP(S). The returned item replaces this one; its `start` is forced to the current transcode position and its `finish` is clamped to the placeholder's `finish`. Because `start` advances each tick, the resolver is re-hit while the transcode position remains inside the placeholder window, allowing a sequence of distinct items to be returned for a single placeholder. The resolved item's `source` may not itself be `dynamic`, but it may carry its own `probe_hint`, which is honored exactly as for a directly-specified source. */
export const DynamicSourceSchema = z.strictObject({
  source_type: z.literal('dynamic'),
  uri: z.string(),
  headers: z.array(z.string()).nullable().optional(),
  user_agent: z.string().nullable().optional(),
  timeout_us: z.number().int().min(0).nullable().optional(),
});
export type DynamicSource = z.infer<typeof DynamicSourceSchema>;

/** Probe metadata for a single video (or still-image) stream. Optional fields left out assume progressive, square-pixel, SDR content at 24 fps — the same fallbacks used when ffprobe omits a field. */
export const VideoHintSchema = z.strictObject({
  stream_index: z.number().int().min(0),
  codec: z.string(),
  width: z.number().int().min(0),
  height: z.number().int().min(0),
  pix_fmt: z.string(),
  frame_rate: z.string().nullable().optional(),
  profile: z.string().nullable().optional(),
  field_order: z.string().nullable().optional(),
  sample_aspect_ratio: z.string().nullable().optional(),
  display_aspect_ratio: z.string().nullable().optional(),
  color_range: z.string().nullable().optional(),
  color_space: z.string().nullable().optional(),
  color_transfer: z.string().nullable().optional(),
  color_primaries: z.string().nullable().optional(),
  dv_profile: z.number().int().min(0).nullable().optional(),
  has_hdr10_metadata: z.boolean().nullable().optional(),
});
export type VideoHint = z.infer<typeof VideoHintSchema>;

/** Probe metadata for a single subtitle stream. */
export const SubtitleHintSchema = z.strictObject({
  stream_index: z.number().int().min(0),
  codec: z.string(),
});
export type SubtitleHint = z.infer<typeof SubtitleHintSchema>;

/** Pre-supplied probe metadata for a source. When present, the server trusts these values and skips running ffprobe entirely, so the source is opened only once (at playback) instead of twice. This matters most for slow or expensive inputs such as scripted yt-dlp pipelines. */
export const ProbeHintSchema = z.strictObject({
  video: z.array(VideoHintSchema).optional(),
  audio: z.array(AudioHintSchema).optional(),
  subtitle: z.array(SubtitleHintSchema).optional(),
  format_name: z.string().nullable().optional(),
  duration_ms: z.number().int().min(0).nullable().optional(),
});
export type ProbeHint = z.infer<typeof ProbeHintSchema>;

/** A file on the local filesystem reachable by the server. */
export const LocalSourceSchema = z.strictObject({
  source_type: z.literal('local'),
  path: z.string(),
  in_point_ms: z.number().int().min(0).nullable().optional(),
  out_point_ms: z.number().int().min(0).nullable().optional(),
  probe_hint: ProbeHintSchema.nullable().optional(),
});
export type LocalSource = z.infer<typeof LocalSourceSchema>;

/** A synthetic source produced by an ffmpeg lavfi filter graph. */
export const LavfiSourceSchema = z.strictObject({
  source_type: z.literal('lavfi'),
  params: z.string(),
  probe_hint: ProbeHintSchema.nullable().optional(),
});
export type LavfiSource = z.infer<typeof LavfiSourceSchema>;

/** A remote source fetched over HTTP(S). */
export const HttpSourceSchema = z.strictObject({
  source_type: z.literal('http'),
  uri: z.string(),
  is_live: z.boolean().nullable().optional(),
  in_point_ms: z.number().int().min(0).nullable().optional(),
  out_point_ms: z.number().int().min(0).nullable().optional(),
  headers: z.array(z.string()).nullable().optional(),
  user_agent: z.string().nullable().optional(),
  timeout_us: z.number().int().min(0).nullable().optional(),
  reconnect: z.boolean().nullable().optional(),
  reconnect_delay_max: z.number().int().min(0).nullable().optional(),
  keep_alive: z.boolean().nullable().optional(),
  probe_hint: ProbeHintSchema.nullable().optional(),
});
export type HttpSource = z.infer<typeof HttpSourceSchema>;

/** A live stream pulled from an RTSP server (e.g. an IP camera). Always treated as live: it is never seeked and cannot work ahead. */
export const RtspSourceSchema = z.strictObject({
  source_type: z.literal('rtsp'),
  uri: z.string(),
  timeout_us: z.number().int().min(0).nullable().optional(),
  probe_hint: ProbeHintSchema.nullable().optional(),
});
export type RtspSource = z.infer<typeof RtspSourceSchema>;

/** An external command whose stdout is an MPEG-TS stream, proxied to ffmpeg over loopback HTTP. */
export const ScriptSourceSchema = z.strictObject({
  source_type: z.literal('script'),
  command: z.string(),
  args: z.array(z.string()).optional(),
  is_live: z.boolean().nullable().optional(),
  probe_hint: ProbeHintSchema.nullable().optional(),
});
export type ScriptSource = z.infer<typeof ScriptSourceSchema>;

/** A media source. Exactly one variant, distinguished by `source_type`. */
export const PlayoutItemSourceSchema = z.discriminatedUnion('source_type', [
  LocalSourceSchema,
  LavfiSourceSchema,
  HttpSourceSchema,
  RtspSourceSchema,
  ScriptSourceSchema,
  DynamicSourceSchema,
]);
export type PlayoutItemSource = z.infer<typeof PlayoutItemSourceSchema>;

/** canvas: a full-frame layer whose frames are already the output size and carry alpha. It is composited at (0,0) and is content-locked: the channel seeks it to its own position in the item. `location`, margins, `width_percent`, `within_source_content`, `opacity_percent` and `timing` are ignored (a warning is logged if present). HTTP canvas sources receive `x-etv-channel`, `x-etv-offset-ms`, `x-etv-duration-ms` and `x-etv-frame-rate` headers. */
export const GraphicsLayerKindSchema = z.enum(['media', 'canvas']);
export type GraphicsLayerKind = z.infer<typeof GraphicsLayerKindSchema>;

/** Nine-position anchor within the primary content frame. Read like a 3×3 grid: rows top/center/bottom, columns left/center/right; the dead center is `center`. */
export const GraphicsLocationSchema = z.enum([
  'top_left',
  'top_center',
  'top_right',
  'center_left',
  'center',
  'center_right',
  'bottom_left',
  'bottom_center',
  'bottom_right',
]);
export type GraphicsLocation = z.infer<typeof GraphicsLocationSchema>;

/** Reference clock for periodic timing. `wall` aligns cycles to wall-clock time (so a viewer tuning in at any moment sees the same phase). `content` measures from the start of the containing playout item. */
export const PeriodicClockSchema = z.enum(['wall', 'content']);
export type PeriodicClock = z.infer<typeof PeriodicClockSchema>;

/** Cyclical visibility: the graphics layer fades in, holds, and fades out once every `frequency_ms`. Cycle length is start-to-start, so `2 * fade_ms + hold_ms` must be ≤ `frequency_ms`, and `fade_ms` must be ≤ `hold_ms`. */
export const PeriodicTimingSchema = z.strictObject({
  timing_type: z.literal('periodic'),
  clock: PeriodicClockSchema,
  frequency_ms: z.number().int().min(1),
  phase_offset_ms: z.number().int().min(0).nullable().optional(),
  disable_after_ms: z.number().int().min(1).nullable().optional(),
  fade_ms: z.number().int().min(0).nullable().optional(),
  hold_ms: z.number().int().min(0),
});
export type PeriodicTiming = z.infer<typeof PeriodicTimingSchema>;

/** Controls when the graphics layer is shown. Exactly one variant, distinguished by `timing_type`. */
export const GraphicsTimingSchema = z.discriminatedUnion('timing_type', [
  PeriodicTimingSchema,
]);
export type GraphicsTiming = z.infer<typeof GraphicsTimingSchema>;

/** An image or video graphics layer composited on top of the primary content. Sized and positioned relative to the primary content's frame. */
export const GraphicsLayerSchema = z.strictObject({
  source: PlayoutItemSourceSchema,
  stream_index: z.number().int().min(0).nullable().optional(),
  kind: GraphicsLayerKindSchema.optional(),
  location: GraphicsLocationSchema,
  width_percent: z.number().min(0).max(100).nullable().optional(),
  horizontal_margin_percent: z.number().min(0).max(100).nullable().optional(),
  vertical_margin_percent: z.number().min(0).max(100).nullable().optional(),
  opacity_percent: z.number().min(0).max(100).nullable().optional(),
  within_source_content: z.boolean().nullable().optional(),
  timing: GraphicsTimingSchema.nullable().optional(),
});
export type GraphicsLayer = z.infer<typeof GraphicsLayerSchema>;

/** Selects a single track (video or audio). */
export const TrackSelectionSchema = z.strictObject({
  source: PlayoutItemSourceSchema.nullable().optional(),
  stream_index: z.number().int().min(0).nullable().optional(),
});
export type TrackSelection = z.infer<typeof TrackSelectionSchema>;

/** Per-track overrides for a playout item. Omit a field to use the server default for that track kind (first stream of that kind in the item's `source`, if any). */
export const PlayoutItemTracksSchema = z.strictObject({
  video: TrackSelectionSchema.nullable().optional(),
  audio: TrackSelectionSchema.nullable().optional(),
  subtitle: TrackSelectionSchema.nullable().optional(),
});
export type PlayoutItemTracks = z.infer<typeof PlayoutItemTracksSchema>;

/** A single scheduled item in the playout. */
export const PlayoutItemSchema = z.strictObject({
  id: z.string(),
  start: z.iso.datetime({ offset: true }),
  finish: z.iso.datetime({ offset: true }),
  source: PlayoutItemSourceSchema.nullable().optional(),
  tracks: PlayoutItemTracksSchema.nullable().optional(),
  watermark: GraphicsLayerSchema.nullable().optional(),
  graphics: z.array(GraphicsLayerSchema).optional(),
});
export type PlayoutItem = z.infer<typeof PlayoutItemSchema>;

export const PlayoutSchema = z.strictObject({
  version: z.string(),
  items: z.array(PlayoutItemSchema),
});
export type Playout = z.infer<typeof PlayoutSchema>;
