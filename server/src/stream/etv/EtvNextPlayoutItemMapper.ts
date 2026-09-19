import type { Resolution } from '@tunarr/types';
import dayjs from 'dayjs';
import type { StreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { StreamDetails, StreamSource } from '../types.ts';
import type { PlayoutItem, PlayoutItemSource } from './generated/playout.ts';
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

export type PlayoutItemMapping = {
  item: PlayoutItem;
  ignored: string[];
};

/**
 * `next` parses these with `DateTime::parse_from_rfc3339`. Millisecond
 * precision is kept because item bounds must not overlap — item selection is an
 * `rfind`, so on overlap the last item silently wins.
 */
const rfc3339 = (ms: number) => dayjs(ms).format('YYYY-MM-DDTHH:mm:ss.SSSZ');

const blackVideo = (resolution: Resolution): PlayoutItemSource => ({
  source_type: 'lavfi',
  params: `color=c=black:s=${resolution.widthPx}x${resolution.heightPx}`,
});

const silentAudio: PlayoutItemSource = {
  source_type: 'lavfi',
  params: 'anullsrc',
};

/**
 * The offline picture is a channel setting, and Tunarr stores either a local
 * path or the URL of its own generic screen.
 */
const pictureSource = (picture: string): PlayoutItemSource =>
  /^https?:\/\//i.test(picture)
    ? { source_type: 'http', uri: picture }
    : { source_type: 'local', path: picture };

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
 */
export function toPlayoutItem({
  id,
  startMs,
  lineupItem,
  stream,
  resolution,
  offlinePicture,
}: {
  id: string;
  startMs: number;
  lineupItem: StreamLineupItem;
  stream?: { source: StreamSource; details?: StreamDetails };
  resolution: Resolution;
  /** `channel.offline.picture`, shown instead of black when the channel sets one. */
  offlinePicture?: string;
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

  if (lineupItem.type === 'offline' || lineupItem.type === 'error') {
    const usePicture =
      lineupItem.type === 'offline' &&
      offlinePicture !== undefined &&
      offlinePicture.length > 0;

    // A lavfi source ignores in/out points upstream, so these items rely on
    // start/finish alone for their duration.
    const video: PlayoutItemSource = usePicture
      ? pictureSource(offlinePicture)
      : blackVideo(resolution);

    // Sourcing audio separately sidesteps the backend erroring out on a source
    // that carries no audio stream.
    const item = PlayoutItemSchema.parse({
      ...base,
      tracks: {
        video: { source: video },
        audio: { source: silentAudio },
      },
    });

    if (lineupItem.type === 'error') {
      ignored.push(
        'error screen type and audio are not expressible; the item plays as a still or black with silence',
      );
    }

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
