import { basename } from 'node:path';
import { SegmentNameRegex } from './BaseHlsSession.ts';

export type CompactedHlsPlaylist = {
  lines: string[];
  removedDurations: number[];

  // Discontinuity tags removed from the body. HlsPlaylistMutator counts body
  // tags to build the discontinuity sequence, so callers must carry this.
  removedDiscontinuities: number;
};

/**
 * Drops every segment numbered below `keepFromSegment` from an ffmpeg
 * append_list playlist. The result stays readable by ffmpeg and by
 * HlsPlaylistMutator.
 *
 * The header never gets a DISCONTINUITY tag or a DISCONTINUITY-SEQUENCE
 * line. ffmpeg's playlist parser treats both as a discontinuity on the first
 * segment, which would add a tag that was never in the stream.
 */
export function compactHlsPlaylist(
  lines: string[],
  keepFromSegment: number,
): CompactedHlsPlaylist | undefined {
  const bodyStart = lines.findIndex((line) => line.startsWith('#EXTINF:'));
  if (bodyStart === -1) {
    return;
  }

  const removedDurations: number[] = [];
  let removedDiscontinuities = 0;
  let keepFrom: { index: number; segmentNumber: number } | undefined;

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.startsWith('#EXT-X-DISCONTINUITY')) {
      removedDiscontinuities++;
      continue;
    }

    if (!line.startsWith('#EXTINF:')) {
      continue;
    }

    const uri = findSegmentUri(lines, i + 1);
    if (!uri) {
      return;
    }

    const segmentNumber = parseSegmentNumber(uri.line);
    if (segmentNumber === undefined) {
      return;
    }

    if (segmentNumber >= keepFromSegment) {
      keepFrom = { index: i, segmentNumber };
      break;
    }

    removedDurations.push(parseFloat(line.slice('#EXTINF:'.length)));
    i = uri.index;
  }

  if (!keepFrom || removedDurations.length === 0) {
    return;
  }

  const { index: keepFromIndex, segmentNumber: firstKept } = keepFrom;

  const header = lines
    .slice(0, bodyStart)
    .filter((line) => !line.startsWith('#EXT-X-DISCONTINUITY'))
    .map((line) =>
      line.startsWith('#EXT-X-MEDIA-SEQUENCE:')
        ? `#EXT-X-MEDIA-SEQUENCE:${firstKept}`
        : line,
    );

  return {
    lines: [...header, ...lines.slice(keepFromIndex)],
    removedDurations,
    removedDiscontinuities,
  };
}

function findSegmentUri(lines: string[], from: number) {
  for (let i = from; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.startsWith('#EXTINF:')) {
      return;
    }
    if (line.length > 0 && !line.startsWith('#')) {
      return { index: i, line };
    }
  }
  return;
}

function parseSegmentNumber(uri: string) {
  const match = basename(uri).match(SegmentNameRegex)?.[1];
  if (match === undefined) {
    return;
  }
  const n = parseInt(match);
  return isNaN(n) ? undefined : n;
}
