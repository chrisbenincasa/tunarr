import { isNonEmptyString } from '@/util/index.js';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  filter,
  first,
  isEmpty,
  last,
  max,
  nth,
  reject,
  takeRight,
  trimEnd,
} from 'lodash-es';
import { basename } from 'node:path';
import { match } from 'ts-pattern';
import { SegmentNameRegex } from './BaseHlsSession.ts';

type MutateOptions = {
  maxSegmentsToKeep: number;
  endWithDiscontinuity: boolean;
  targetDuration: number;
  previousDiscontinuitySequence?: number;
};

type FilterBeforeDate = {
  type: 'before_date';
  before: Dayjs;
};

export type FilterBeforeSegmentNumber = {
  type: 'before_segment_number';
  segmentNumber: number;
  segmentsToKeepBefore: number;
  // Hard floor: never include segments below this number. Prevents the
  // playlist from referencing segments that have been deleted from disk.
  segmentFloor?: number;
};

export type HlsPlaylistFilterOptions =
  | FilterBeforeDate
  | FilterBeforeSegmentNumber;

export class HlsPlaylistMutator {
  trimPlaylist(
    start: Dayjs,
    filter: HlsPlaylistFilterOptions | undefined,
    playlistLines: string[],
    opts: MutateOptions,
  ): TrimPlaylistResult {
    const items = this.parsePlaylist(
      start,
      playlistLines,
      opts.endWithDiscontinuity,
    );

    const generateResult = this.generatePlaylist(
      items,
      filter,
      opts.maxSegmentsToKeep,
      opts.targetDuration,
      opts.previousDiscontinuitySequence,
    );

    return {
      playlistStart: generateResult.nextPlaylistStart,
      sequence: generateResult.startSequence,
      playlist: generateResult.playlist,
      segmentCount: generateResult.count,
      discontinuitySequence: generateResult.discontinuitySequence,
    };
  }

  parsePlaylist(
    start: Dayjs,
    playlistLines: string[],
    endWithDiscontinuity: boolean,
  ): PlaylistLine[] {
    const items: PlaylistLine[] = [];

    let i = 0;
    // Segment start times are tracked as integer milliseconds and only turned
    // into Dayjs objects when something reads them. The on-disk playlist holds
    // every segment since the session began, so allocating a Dayjs per segment
    // on every request made playlist latency grow with stream age.
    const startMs = start.valueOf();
    let currentMs = startMs;

    while (
      i < playlistLines.length &&
      !playlistLines[i]!.startsWith('#EXTINF:')
    ) {
      // Skip header lines — DISCs in the header are FFmpeg artifacts from
      // process restarts (discont_start), not actual program boundaries.
      // The DISC-SEQ header is also ignored because with hls_list_size=0
      // all DISCs are in the body; counting both would double-count.
      // This is beacuse Tunarr has discrete ffmpeg processes continuouly write
      // to the same underlying playlist file.
      // TODO: We could consider writing out the trimmed playlist periodically
      // in the session manager to keep things cleaner
      i++;
    }

    while (i < playlistLines.length) {
      const line = playlistLines[i];
      if (!isNonEmptyString(line)) {
        i++;
        continue;
      }

      if (line.startsWith('#EXT-X-DISCONTINUITY')) {
        items.push(PlaylistDiscontinuity());
        i++;
        continue;
      }

      // EXTINF
      const duration = parseFloat(trimEnd(line.trim(), ',').split(':')[1]!);
      items.push(
        new PlaylistSegment(
          start,
          currentMs - startMs,
          line,
          playlistLines[i + 2]!,
        ),
      );

      // Truncate each step like Dayjs#add does via Date, so times match exactly.
      currentMs = Math.trunc(currentMs + duration * 1000);
      i += 3;
    }

    if (endWithDiscontinuity && last(items)?.type !== 'discontinuity') {
      items.push(PlaylistDiscontinuity());
    }

    return items;
  }

  private generatePlaylist(
    items: PlaylistLine[],
    filterOptions: HlsPlaylistFilterOptions | undefined,
    maxSegmentsToKeep: number,
    targetDuration: number,
    previousDiscontinuitySequence?: number,
  ) {
    // Count and remove leading discontinuities
    let leadingDiscontinuities = 0;
    let discontinuitySequence = 0;
    while (items[leadingDiscontinuities]?.type === 'discontinuity') {
      leadingDiscontinuities++;
    }
    discontinuitySequence += leadingDiscontinuities;
    items = items.slice(leadingDiscontinuities);

    let allSegments = filter(
      items,
      (item): item is PlaylistSegment => item.type === 'segment',
    );

    if (allSegments.length > maxSegmentsToKeep) {
      const filtered = filterOptions
        ? match(filterOptions)
            .with({ type: 'before_date' }, ({ before }) =>
              reject(allSegments, (segment) =>
                segment.startTime.isBefore(before),
              ),
            )
            .with(
              {
                type: 'before_segment_number',
              },
              (beforeSeg) => {
                const minSeg = Math.max(
                  beforeSeg.segmentNumber - beforeSeg.segmentsToKeepBefore,
                  beforeSeg.segmentFloor ?? 0,
                );
                // Walk back from the live edge and stop once the window is
                // full; the result is the last maxSegmentsToKeep segments at or
                // above minSeg, without touching the rest of the history.
                const kept: PlaylistSegment[] = [];
                for (
                  let j = allSegments.length - 1;
                  j >= 0 && kept.length < maxSegmentsToKeep;
                  j--
                ) {
                  const segment = allSegments[j]!;
                  const int = segment.startSequence;
                  if (int === null || isNaN(int) || int < minSeg) {
                    continue;
                  }
                  kept.push(segment);
                }
                return kept.reverse();
              },
            )
            .exhaustive()
        : allSegments;

      // The window always ends at the live edge. The filter only sets a floor,
      // so a lagging client cannot hold the window back for other viewers.
      allSegments =
        filtered.length >= maxSegmentsToKeep
          ? takeRight(filtered, maxSegmentsToKeep)
          : takeRight(allSegments, maxSegmentsToKeep);
    }

    const startSequence = first(allSegments)?.startSequence ?? 0;

    // Selected segments are always elements of `items`, so identity is enough.
    const selected = new Set<PlaylistLine>(allSegments);
    let firstSegIndex = -1;

    if (!isEmpty(allSegments)) {
      const firstSeg = first(allSegments)!;
      firstSegIndex = items.indexOf(firstSeg);
      // ALL discontinuities before the first selected segment are folded into
      // the discontinuity sequence number. They must never be emitted as tags
      // because there are no selected segments before them — emitting a tag
      // would create an empty leading period which confuses clients like Kodi
      // (inputstream.adaptive maps each discontinuity to a "period" and
      // errors with "No segments in the manifest" when a period is empty).
      for (let i = 0; i < firstSegIndex; i++) {
        if (items[i]!.type === 'discontinuity') {
          discontinuitySequence++;
        }
      }
    }

    // Cap disc-seq so it never jumps by more than 1 between consecutive polls.
    // When a short program is entirely filtered out of the sliding window between
    // client polls, all its boundary DISCs are folded at once, jumping by >1.
    // The client never saw the intermediate period, so it errors. Cap at +1 and
    // emit a trailing DISC to pre-create the next period for the following poll.
    let emitTrailingDisc = false;
    if (
      previousDiscontinuitySequence !== undefined &&
      discontinuitySequence > previousDiscontinuitySequence + 1
    ) {
      discontinuitySequence = previousDiscontinuitySequence + 1;
      emitTrailingDisc = true;
    }

    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      `#EXT-X-TARGETDURATION:${targetDuration}`,
      `#EXT-X-MEDIA-SEQUENCE:${startSequence}`,
      `#EXT-X-DISCONTINUITY-SEQUENCE:${discontinuitySequence}`,
      '#EXT-X-INDEPENDENT-SEGMENTS',
    ];

    // Track whether we've emitted at least one selected segment.
    // A DISC tag is only emitted when it separates two groups of selected
    // segments — never before the first selected segment (that case is
    // handled above by incrementing discontinuitySequence).
    let hasEmittedSegment = false;

    // Nothing before the first selected segment is ever emitted (see above), so
    // start there instead of walking the whole history.
    for (let i = Math.max(firstSegIndex, 0); i < items.length; i++) {
      const item = items[i]!;
      switch (item.type) {
        case 'discontinuity': {
          if (!hasEmittedSegment) {
            // Before the first selected segment — already counted in
            // discontinuitySequence above, do not emit a tag.
            break;
          }
          const next = items[i + 1];
          const nextIsSelected =
            next?.type === 'segment' && selected.has(next);
          if (i === items.length - 1 || nextIsSelected) {
            lines.push('#EXT-X-DISCONTINUITY');
          }
          break;
        }
        case 'segment':
          if (selected.has(item)) {
            lines.push(item.extInf);
            lines.push(
              `#EXT-X-PROGRAM-DATE-TIME:${item.startTime.format(
                'YYYY-MM-DDTHH:mm:ss.SSSZZ',
              )}`,
            );
            lines.push(item.line);
            hasEmittedSegment = true;
          }
          break;
      }
    }

    if (emitTrailingDisc && hasEmittedSegment) {
      lines.push('#EXT-X-DISCONTINUITY');
    }

    const playlist = lines.join('\n');
    const nextPlaylistStart = first(allSegments)?.startTime ?? dayjs();
    return {
      playlist,
      nextPlaylistStart,
      startSequence,
      count: allSegments.length,
      discontinuitySequence,
    };
  }

  // Subtitle playlists have no program-date-time requirement, but may carry
  // the same discontinuity boundaries as their associated video playlist.
  parseSubtitlePlaylist(playlistLines: string[]): SubtitlePlaylistSegment[] {
    const items: SubtitlePlaylistSegment[] = [];
    let discontinuitySequence = 0;
    let extInf: string | undefined;
    for (const rawLine of playlistLines) {
      const line = rawLine.trimEnd();
      if (line.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE:')) {
        const value = line.slice(line.indexOf(':') + 1);
        const sequence = Number(value);
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(sequence)) {
          throw new Error('Invalid subtitle discontinuity sequence');
        }
        discontinuitySequence = sequence;
      } else if (line === '#EXT-X-DISCONTINUITY') {
        discontinuitySequence++;
      } else if (line.startsWith('#EXTINF:')) {
        extInf = line;
      } else if (
        extInf !== undefined &&
        line.length > 0 &&
        !line.startsWith('#')
      ) {
        items.push(
          new SubtitlePlaylistSegment(extInf, line, discontinuitySequence),
        );
        extInf = undefined;
      }
    }

    return items;
  }

  trimSubtitlePlaylist(
    playlistLines: string[],
    filterOptions: FilterBeforeSegmentNumber | undefined,
    opts: SubtitleTrimOptions,
  ): SubtitleTrimResult {
    let allSegments = this.parseSubtitlePlaylist(playlistLines);

    if (allSegments.length > opts.maxSegmentsToKeep) {
      const minSeg = filterOptions
        ? Math.max(
            filterOptions.segmentNumber - filterOptions.segmentsToKeepBefore,
            filterOptions.segmentFloor ?? 0,
          )
        : 0;
      const filtered = filter(allSegments, (segment) => {
        const n = segment.segmentNumber;
        return n !== null && n >= minSeg;
      });

      // Same live-edge rule as the video playlist. The filter is only a floor.
      allSegments =
        filtered.length >= opts.maxSegmentsToKeep
          ? takeRight(filtered, opts.maxSegmentsToKeep)
          : takeRight(allSegments, opts.maxSegmentsToKeep);
    }

    const startSequence = first(allSegments)?.segmentNumber ?? 0;

    // Segment durations here are genuinely variable (unlike the fixed-cadence
    // video segments above), so the target duration must be derived from the
    // actual retained segments rather than the nominal segment_time -- an
    // under-reported #EXT-X-TARGETDURATION is a spec violation.
    const targetDuration = Math.max(
      1,
      Math.ceil(max(allSegments.map((s) => s.duration)) ?? 0),
    );

    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${targetDuration}`,
      `#EXT-X-MEDIA-SEQUENCE:${startSequence}`,
    ];

    let discontinuitySequence = first(allSegments)?.discontinuitySequence ?? 0;
    if (
      playlistLines.some(
        (line) =>
          line.trimEnd() === '#EXT-X-DISCONTINUITY' ||
          line.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE:'),
      )
    ) {
      lines.push(`#EXT-X-DISCONTINUITY-SEQUENCE:${discontinuitySequence}`);
    }
    for (const segment of allSegments) {
      while (discontinuitySequence < segment.discontinuitySequence) {
        lines.push('#EXT-X-DISCONTINUITY');
        discontinuitySequence++;
      }
      lines.push(segment.extInf, segment.line);
    }

    return {
      playlist: lines.join('\n'),
      sequence: startSequence,
      segmentCount: allSegments.length,
    };
  }
}

class PlaylistSegment {
  public readonly type = 'segment' as const;

  #startTime?: Dayjs;

  constructor(
    private base: Dayjs,
    private offsetMs: number,
    public extInf: string,
    public line: string,
  ) {}

  get startTime(): Dayjs {
    this.#startTime ??=
      this.offsetMs === 0
        ? this.base
        : this.base.add(this.offsetMs, 'millisecond');
    return this.#startTime;
  }

  get startSequence() {
    const matches = basename(this.line).match(SegmentNameRegex);
    const match = nth(matches, 1);
    return match ? parseInt(match) : null;
  }

  equals(other: PlaylistSegment) {
    return (
      this === other ||
      (this.startTime.isSame(other.startTime) &&
        this.extInf === other.extInf &&
        this.line === other.line)
    );
  }
}

export class SubtitlePlaylistSegment {
  public readonly duration: number;

  constructor(
    public extInf: string,
    public line: string,
    public discontinuitySequence = 0,
  ) {
    this.duration = parseFloat(trimEnd(extInf.trim(), ',').split(':')[1]!);
  }

  get segmentNumber(): number | null {
    const matches = basename(this.line).match(SegmentNameRegex);
    const match = nth(matches, 1);
    return match ? parseInt(match) : null;
  }
}

export type SubtitleTrimOptions = {
  maxSegmentsToKeep: number;
};

export type SubtitleTrimResult = {
  playlist: string;
  sequence: number;
  segmentCount: number;
};

type PlaylistDiscontinuity = {
  type: 'discontinuity';
};

function PlaylistDiscontinuity(): PlaylistDiscontinuity {
  return {
    type: 'discontinuity',
  };
}

type PlaylistLine = PlaylistSegment | PlaylistDiscontinuity;

type TrimPlaylistResult = {
  playlistStart: Dayjs;
  sequence: number;
  playlist: string;
  segmentCount: number;
  discontinuitySequence: number;
};
