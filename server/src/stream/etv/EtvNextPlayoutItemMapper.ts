import type { Resolution } from '@tunarr/types';
import dayjs from 'dayjs';
import type { StreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type {
  ErrorScreenAudioType,
  ErrorScreenType,
} from '@/db/schema/TranscodeConfig.js';
import type { ChannelOfflineSettings } from '@/db/schema/base.js';
import type { StreamDetails, StreamSource } from '../types.ts';
import type {
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

/**
 * `next` parses these with `DateTime::parse_from_rfc3339`. Millisecond
 * precision is kept because item bounds must not overlap — item selection is an
 * `rfind`, so on overlap the last item silently wins.
 */
export const rfc3339 = (ms: number) =>
  dayjs(ms).format('YYYY-MM-DDTHH:mm:ss.SSSZ');

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
  /^https?:\/\//i.test(location)
    ? { source_type: 'http', uri: location }
    : { source_type: 'local', path: location };

const isSet = (value: string | undefined): value is string =>
  value !== undefined && value.length > 0;

/** Long enough to carry a real message, short enough to stay on screen. */
const MAX_ERROR_TEXT_LENGTH = 120;

/**
 * Error text is interpolated into a `drawtext` value that sits inside single
 * quotes, and inside those quotes only `'` can end the quoting and let a
 * crafted message append its own filters. Quotes and backslashes are therefore
 * dropped outright, `%` goes with them so text expansion has nothing to chew
 * on, and control characters become spaces. Everything else — `:` `,` `[` `]`
 * `;` and friends — stays literal because the quoting holds.
 */
function sanitizeDrawText(raw: string): string {
  return raw
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/['\\%]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ERROR_TEXT_LENGTH);
}

function errorMessage(error: Error | string | boolean): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : '';
}

/**
 * Mirrors `TitleTextFilter`, down to the derived font sizes and placement, so
 * the worker draws the screen Tunarr's own pipeline draws.
 *
 * `expansion=none` is the one addition. Tunarr leaves drawtext's default
 * expansion on, which would let `%{...}` in a message reach the expression
 * evaluator.
 */
function errorTextVideo(
  resolution: Resolution,
  title: string,
  subtitle: string,
): PlayoutItemSource {
  const subtitleSize = Math.ceil(resolution.heightPx / 33);
  const titleSize = Math.ceil((subtitleSize * 3) / 2);
  const gap = 2 * subtitleSize;
  const draw = (size: number, y: string, text: string) =>
    `drawtext=expansion=none:fontsize=${size}:fontcolor=white:x=(w-text_w)/2:y=${y}:text='${text}'`;

  return lavfi(
    [
      `color=c=black:s=${resolution.widthPx}x${resolution.heightPx}`,
      draw(titleSize, '(h-text_h)/2', sanitizeDrawText(title)),
      draw(subtitleSize, `(h+text_h+${gap})/2`, sanitizeDrawText(subtitle)),
    ].join(','),
  );
}

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
  errorPicture: string | undefined,
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
      if (isSet(errorPicture)) {
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
  range: { inPointMs: number; outPointMs: number },
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
}: {
  id: string;
  startMs: number;
  lineupItem: StreamLineupItem;
  stream?: { source: StreamSource; details?: StreamDetails };
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
}): PlayoutItemMapping {
  if (lineupItem.type === 'redirect') {
    throw new UnresolvedRedirectError(lineupItem.channel);
  }

  const ignored: string[] = [];
  const inPointMs = lineupItem.startOffset ?? 0;
  const outPointMs = inPointMs + lineupItem.streamDuration;

  const base = {
    id,
    start: rfc3339(startMs),
    finish: rfc3339(startMs + lineupItem.streamDuration),
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
    const soundtrack = isSet(offlineSoundtrack)
      ? fileOrHttpSource(offlineSoundtrack)
      : undefined;

    // Clip mode fills flex with a fallback program, which the caller resolves
    // like any other content. Its own audio plays unless a soundtrack overrides
    // it.
    if (offlineMode === 'clip') {
      if (stream !== undefined) {
        const item = PlayoutItemSchema.parse({
          ...base,
          source: toSource(stream.source, { inPointMs, outPointMs }),
          ...(soundtrack !== undefined
            ? { tracks: { audio: { source: soundtrack } } }
            : {}),
        });

        return { item, ignored };
      }

      ignored.push(
        'the channel fills flex with a clip, but none was resolved, so the item plays as a still or black',
      );
    }

    const item = PlayoutItemSchema.parse({
      ...base,
      tracks: asTracks(
        isSet(offlinePicture)
          ? fileOrHttpSource(offlinePicture)
          : blackVideo(resolution),
        soundtrack ?? silentAudio,
      ),
    });

    return { item, ignored };
  }

  if (stream === undefined) {
    throw new MissingStreamSourceError(lineupItem.type);
  }

  const item = PlayoutItemSchema.parse({
    ...base,
    source: toSource(stream.source, { inPointMs, outPointMs }),
  });

  return { item, ignored };
}
