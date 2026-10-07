import type { StreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type {
  ErrorScreenAudioType,
  ErrorScreenType,
} from '@/db/schema/TranscodeConfig.js';
import type { ChannelOfflineSettings } from '@/db/schema/base.js';
import { titleTextFilter } from '@/ffmpeg/builder/filter/TitleTextFilter.js';
import { isHttpUrl, isNonEmptyString } from '@/util/index.js';
import type { Resolution, Watermark } from '@tunarr/types';
import dayjs from 'dayjs';
import type { Maybe } from '../../types/util.ts';
import type {
  AudioStreamDetails,
  StreamDetails,
  StreamSource,
  SubtitleStreamDetails,
} from '../types.ts';
import type {
  GraphicsLayer,
  GraphicsLocation,
  GraphicsTiming,
  PlayoutItem,
  PlayoutItemSource,
  PlayoutItemTracks,
} from './generated/playout.ts';
import { PlayoutItemSchema } from './generated/playout.ts';

/**
 * `next` has no notion of a redirect and rejects a nested dynamic source, so
 * the resolver has to follow redirects to a content item before it answers.
 */
export class UnresolvedRedirectError extends Error {
  constructor(readonly targetChannel: string) {
    super(
      `A redirect to channel ${targetChannel} reached the playout mapper. Redirects must be resolved to a content item first.`,
    );
    this.name = 'UnresolvedRedirectError';
  }
}

export class MissingStreamSourceError extends Error {
  constructor(readonly itemType: string) {
    super(
      `A ${itemType} lineup item reached the playout mapper with no stream`,
    );
    this.name = 'MissingStreamSourceError';
  }
}

/**
 * The `kill` error screen ends the stream instead of showing something, which
 * only the caller can do. Callers must catch this and tear the session down
 * rather than degrade the item to another screen.
 */
export class StreamTerminationRequestedError extends Error {
  constructor(readonly reason: string) {
    super(
      `The error screen is set to 'kill', so the stream must be terminated (${reason})`,
    );
    this.name = 'StreamTerminationRequestedError';
  }
}

export type PlayoutItemMapping = {
  item: PlayoutItem;
  ignored: string[];
};

const lavfi = (params: string): PlayoutItemSource => ({
  source_type: 'lavfi',
  params,
});

const blackVideo = (resolution: Resolution): PlayoutItemSource =>
  lavfi(`color=c=black:s=${resolution.widthPx}x${resolution.heightPx}`);

const testSourceVideo = (resolution: Resolution): PlayoutItemSource =>
  lavfi(`testsrc=size=${resolution.widthPx}x${resolution.heightPx}`);

/**
 * `geq` evaluates per pixel, so Tunarr generates its static small and lets the
 * scaler blow it up. Keeping the same size keeps the same cost and look.
 */
const staticVideo = (): PlayoutItemSource =>
  lavfi('nullsrc=s=480x270,geq=random(1)*255:128:128');

const silentAudio: PlayoutItemSource = lavfi('anullsrc');

/** 400 Hz is the tone Tunarr's own error stream plays. */
const sineAudio: PlayoutItemSource = lavfi('sine=f=400');

const whiteNoiseAudio: PlayoutItemSource = lavfi('anoisesrc=c=white:a=0.7');

/**
 * Channel media settings hold either a local path or a URL, including the URL
 * of a screen Tunarr serves itself.
 */
const fileOrHttpSource = (location: string): PlayoutItemSource =>
  isHttpUrl(location)
    ? { source_type: 'http', uri: location }
    : { source_type: 'local', path: location };

/** A watermark whose image `WatermarkResolver` has already located. */
export type ResolvedWatermark = Watermark & { url: string };

const WatermarkLocations: Record<Watermark['position'], GraphicsLocation> = {
  'top-left': 'top_left',
  'top-right': 'top_right',
  'bottom-left': 'bottom_left',
  'bottom-right': 'bottom_right',
};

/** Tunarr fades a watermark in and out over one second. */
const WatermarkFadeMs = 1_000;

/**
 * When a watermark is visible.
 *
 * - A fade config cycles on wall clock, so every viewer sees the same phase.
 *   The watermark is visible for one period and hidden for the next.
 *   `leadingEdge` puts the visible half first.
 * - `duration` alone shows the watermark for that many seconds from the start
 *   of the item, then hides it. That is one content-clock appearance with no
 *   fade, and a cap that stops a second one from starting.
 *
 * Like Tunarr's own pipeline, only the first fade config applies.
 */
function watermarkTiming(watermark: Watermark): GraphicsTiming | undefined {
  const durationMs = watermark.duration * 1000;
  const fade = watermark.fadeConfig?.[0];

  if (fade && fade.periodMins > 0) {
    const periodMs = fade.periodMins * 60_000;
    return {
      timing_type: 'periodic',
      clock: 'wall',
      frequency_ms: 2 * periodMs,
      phase_offset_ms: fade.leadingEdge === true ? 0 : periodMs,
      fade_ms: WatermarkFadeMs,
      hold_ms: periodMs - WatermarkFadeMs,
      ...(durationMs > 0 ? { disable_after_ms: durationMs } : {}),
    };
  }

  if (durationMs > 0) {
    return {
      timing_type: 'periodic',
      clock: 'content',
      frequency_ms: durationMs,
      phase_offset_ms: 0,
      fade_ms: 0,
      hold_ms: durationMs,
      disable_after_ms: 1,
    };
  }

  return;
}

/**
 * Maps a resolved watermark to the item's graphics layer.
 *
 * Margins and width are percentages of the padded output frame, as in Tunarr's
 * pipeline, so `within_source_content` stays unset.
 */
export function toWatermarkLayer(watermark: ResolvedWatermark): GraphicsLayer {
  const timing = watermarkTiming(watermark);

  return {
    source: fileOrHttpSource(watermark.url),
    location: WatermarkLocations[watermark.position],
    ...(watermark.fixedSize === true
      ? {}
      : { width_percent: Math.min(watermark.width, 100) }),
    horizontal_margin_percent: watermark.horizontalMargin,
    vertical_margin_percent: watermark.verticalMargin,
    ...(watermark.opacity < 100 ? { opacity_percent: watermark.opacity } : {}),
    ...(timing ? { timing } : {}),
  };
}

/**
 * The tracks a stream selection profile chose for a content item.
 *
 * Indices are absolute container indices, which is what upstream matches
 * `stream_index` against.
 */
export type PlayoutTrackSelection = {
  audioStream?: AudioStreamDetails;
  subtitleStream?: SubtitleStreamDetails;
};

type MediaRange = { inPointMs: number; outPointMs: number };

/**
 * Picks the audio and subtitle tracks out of a content item's source.
 *
 * A subtitle with a path lives in its own file, an extracted or external one,
 * so it becomes a separate source seeked with the video. Upstream skips an
 * embedded text subtitle under burn mode, which is why the extracted file is
 * preferred whenever the selector found one.
 *
 * Upstream errors to its fallback card on a source with no audio stream (B8),
 * so a video-only file gets silence sourced separately.
 */
function contentTracks(
  details: StreamDetails | undefined,
  selection: PlayoutTrackSelection | undefined,
  range: MediaRange,
): PlayoutItemTracks | undefined {
  const tracks: PlayoutItemTracks = {};

  if (details && !details.audioDetails) {
    tracks.audio = { source: silentAudio };
  } else if (selection?.audioStream) {
    tracks.audio = { stream_index: selection.audioStream.index };
  }

  const subtitle = selection?.subtitleStream;
  if (subtitle) {
    tracks.subtitle = isNonEmptyString(subtitle.path)
      ? { source: seekableSource(subtitle.path, range) }
      : { stream_index: subtitle.index ?? 0 };
  }

  return tracks.audio || tracks.subtitle ? tracks : undefined;
}

const seekableSource = (
  location: string,
  { inPointMs, outPointMs }: MediaRange,
): PlayoutItemSource =>
  isHttpUrl(location)
    ? {
        source_type: 'http',
        uri: location,
        in_point_ms: inPointMs,
        out_point_ms: outPointMs,
      }
    : {
        source_type: 'local',
        path: location,
        in_point_ms: inPointMs,
        out_point_ms: outPointMs,
      };

function errorMessage(error: Error | string | boolean): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : '';
}

const errorTextVideo = (
  resolution: Resolution,
  title: string,
  subtitle: string,
): PlayoutItemSource =>
  lavfi(
    `color=c=black:s=${resolution.widthPx}x${resolution.heightPx},${titleTextFilter(resolution.heightPx, title, subtitle)}`,
  );

function errorAudio(audioType: ErrorScreenAudioType): PlayoutItemSource {
  switch (audioType) {
    case 'silent':
      return silentAudio;
    case 'sine':
      return sineAudio;
    case 'whitenoise':
      return whiteNoiseAudio;
  }
}

/**
 * @throws StreamTerminationRequestedError when the error screen is `kill`.
 */
function errorVideo(
  screenType: ErrorScreenType,
  resolution: Resolution,
  message: string,
  errorPicture: Maybe<string>,
  ignored: string[],
): PlayoutItemSource {
  switch (screenType) {
    case 'kill':
      throw new StreamTerminationRequestedError(message);
    case 'blank':
      return blackVideo(resolution);
    case 'testsrc':
      return testSourceVideo(resolution);
    case 'static':
      return staticVideo();
    case 'text':
      // Tunarr titles its error stream 'Error' and puts the detail underneath.
      return errorTextVideo(resolution, 'Error', message);
    case 'pic': {
      if (isNonEmptyString(errorPicture)) {
        return fileOrHttpSource(errorPicture);
      }

      ignored.push(
        'no error picture is configured, so the error item plays as black',
      );
      return blackVideo(resolution);
    }
  }
}

/**
 * Turns Tunarr's stream source into the playout equivalent.
 *
 * Only `local` and `http` read `in_point_ms`/`out_point_ms` upstream, so a
 * seekable range is attached to those two and nothing else.
 */
function toSource(
  streamSource: StreamSource,
  range: MediaRange,
): PlayoutItemSource {
  switch (streamSource.type) {
    case 'file':
      return {
        source_type: 'local',
        path: streamSource.path,
        in_point_ms: range.inPointMs,
        out_point_ms: range.outPointMs,
      };
    case 'http': {
      const headers = Object.entries(streamSource.extraHeaders).map(
        ([name, value]) => `${name}: ${value}`,
      );
      return {
        source_type: 'http',
        uri: streamSource.path,
        in_point_ms: range.inPointMs,
        out_point_ms: range.outPointMs,
        ...(headers.length > 0 ? { headers } : {}),
      };
    }
    case 'offline':
    case 'error':
      throw new MissingStreamSourceError(streamSource.type);
  }
}

export type ToPlayoutItemArgs = {
  id: string;
  startMs: number;
  lineupItem: StreamLineupItem;
  stream?: {
    source: StreamSource;
    details?: StreamDetails;
    selection?: PlayoutTrackSelection;
    /** Error and flex items never carry one. */
    watermark?: ResolvedWatermark;
  };
  resolution: Resolution;
  /** `channel.offline.picture`, shown instead of black when the channel sets one. */
  offlinePicture?: string;
  /** `channel.offline.soundtrack`, played instead of silence when set. */
  offlineSoundtrack?: string;
  /** `channel.offline.mode`. Defaults to the still-picture screen. */
  offlineMode?: ChannelOfflineSettings['mode'];
  /** `transcodeConfig.errorScreen`. Defaults to plain black. */
  errorScreen?: ErrorScreenType;
  /** `transcodeConfig.errorScreenAudio`. Defaults to silence. */
  errorScreenAudio?: ErrorScreenAudioType;
  /** Picture for the `pic` error screen, usually Tunarr's generic error screen. */
  errorPicture?: string;
};

/**
 * Builds one `PlayoutItem` from a resolved lineup item.
 *
 * `startMs` is the wall-clock instant the item begins, and `startOffset` is the
 * media offset at that same instant — the invariant that makes one arithmetic
 * serve both call sites. Upstream seeks to `in_point_ms + (now - start)`, so:
 *
 * - On the dynamic path the worker overwrites `start` with the position it is
 *   transcoding, making the elapsed term zero, and `startOffset` is already the
 *   offset at that position.
 * - On the pre-materialized path `startMs` is `programBeginMs` and the elapsed
 *   term does the seeking, so the caller passes an item whose `startOffset` was
 *   computed for that instant.
 *
 * @throws UnresolvedRedirectError for a redirect item.
 * @throws MissingStreamSourceError when a content item arrives without a stream.
 * @throws StreamTerminationRequestedError when an error item is configured to
 *   kill the stream.
 */
export function toPlayoutItem({
  id,
  startMs,
  lineupItem,
  stream,
  resolution,
  offlinePicture,
  offlineSoundtrack,
  offlineMode = 'pic',
  errorScreen = 'blank',
  errorScreenAudio = 'silent',
  errorPicture,
}: ToPlayoutItemArgs): PlayoutItemMapping {
  if (lineupItem.type === 'redirect') {
    throw new UnresolvedRedirectError(lineupItem.channel);
  }

  const ignored: string[] = [];
  const inPointMs = lineupItem.startOffset ?? 0;
  const outPointMs = inPointMs + lineupItem.streamDuration;

  const base = {
    id,
    start: dayjs(startMs).toISOString(),
    finish: dayjs(startMs + lineupItem.streamDuration).toISOString(),
  };

  // Sourcing audio separately sidesteps the backend erroring out on a
  // synthetic or still-image source that carries no audio stream.
  const asTracks = (
    video: PlayoutItemSource,
    audio: PlayoutItemSource,
  ): PlayoutItemTracks => ({
    video: { source: video },
    audio: { source: audio },
  });

  if (lineupItem.type === 'error') {
    const message = errorMessage(lineupItem.error);
    const item = PlayoutItemSchema.parse({
      ...base,
      // A lavfi source ignores in/out points upstream, so these items rely on
      // start/finish alone for their duration.
      tracks: asTracks(
        errorVideo(errorScreen, resolution, message, errorPicture, ignored),
        errorAudio(errorScreenAudio),
      ),
    });

    return { item, ignored };
  }

  if (lineupItem.type === 'offline') {
    const soundtrack = isNonEmptyString(offlineSoundtrack)
      ? fileOrHttpSource(offlineSoundtrack)
      : undefined;

    // A clip reaches the mapper as a `fallback` program and takes the content
    // path below, so an offline item under clip mode means the scheduler found
    // no filler to play.
    if (offlineMode === 'clip') {
      ignored.push(
        'the channel fills flex with a clip, but none was resolved, so the item plays as a still or black',
      );
    }

    const item = PlayoutItemSchema.parse({
      ...base,
      tracks: asTracks(
        isNonEmptyString(offlinePicture)
          ? fileOrHttpSource(offlinePicture)
          : blackVideo(resolution),
        soundtrack ?? silentAudio,
      ),
    });

    return { item, ignored };
  }

  if (!stream) {
    throw new MissingStreamSourceError(lineupItem.type);
  }

  const range = { inPointMs, outPointMs };
  const tracks = contentTracks(stream.details, stream.selection, range);

  const item = PlayoutItemSchema.parse({
    ...base,
    source: toSource(stream.source, range),
    ...(tracks ? { tracks } : {}),
    ...(stream.watermark
      ? { watermark: toWatermarkLayer(stream.watermark) }
      : {}),
  });

  return { item, ignored };
}
