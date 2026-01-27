import { isNonEmptyString } from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  filter,
  first,
  indexOf,
  isEmpty,
  last,
  merge,
  nth,
  reject,
  take,
  takeRight,
  trimEnd,
} from 'lodash-es';
import { basename } from 'node:path';
import type { DeepRequired } from 'ts-essentials';
import { match } from 'ts-pattern';
import { defaultHlsOptions } from '../../ffmpeg/builder/constants.ts';
import { SegmentNameRegex } from './BaseHlsSession.ts';

type MutateOptions = {
  maxSegmentsToKeep?: number;
  endWithDiscontinuity?: boolean;
  targetDuration?: number;
};

type FilterBeforeDate = {
  type: 'before_date';
  before: Dayjs;
};

type FilterBeforeSegmentNumber = {
  type: 'before_segment_number';
  segmentNumber: number;
  segmentsToKeepBefore: number;
};

export type HlsPlaylistFilterOptions =
  | FilterBeforeDate
  | FilterBeforeSegmentNumber;

const defaultMutateOptions: DeepRequired<MutateOptions> = {
  maxSegmentsToKeep: 10,
  endWithDiscontinuity: false,
  targetDuration: defaultHlsOptions.hlsTime,
};

export class HlsPlaylistMutator {
  trimPlaylist(
    start: Dayjs,
    filter: HlsPlaylistFilterOptions,
    playlistLines: string[],
    opts: MutateOptions = defaultMutateOptions,
    // maxSegments: number = 10,
    // endWithDiscontinuity: boolean = false,
  ): TrimPlaylistResult {
    const mergedOpts = merge({}, defaultMutateOptions, opts);
    const { items, discontinuitySeq } = this.parsePlaylist(
      start,
      playlistLines,
      mergedOpts.endWithDiscontinuity,
    );

    const generateResult = this.generatePlaylist(
      items,
      filter,
      discontinuitySeq,
      mergedOpts.maxSegmentsToKeep,
      mergedOpts.targetDuration,
    );

    return {
      playlistStart: generateResult.nextPlaylistStart,
      sequence: generateResult.startSequence,
      playlist: generateResult.playlist,
      segmentCount: generateResult.count,
    };
  }

  parsePlaylist(
    start: Dayjs,
    playlistLines: string[],
    endWithDiscontinuity: boolean,
  ) {
    const items: PlaylistLine[] = [];

    // Find discontinuity items leading up the first segments
    let discontinuitySeq = 0;
    let i = 0;
    let currentTime = start;

    while (
      i < playlistLines.length &&
      !playlistLines[i]!.startsWith('#EXTINF:')
    ) {
      const line = playlistLines[i]!;
      if (line.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE')) {
        const parsed = parseInt(line.split(':')[1]!);
        if (!isNaN(parsed)) {
          discontinuitySeq = parsed;
        }
      } else if (line.startsWith('#EXT-X-DISCONTINUITY')) {
        items.push(PlaylistDiscontinuity());
      }

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
      items.push(new PlaylistSegment(currentTime, line, playlistLines[i + 2]!));

      currentTime = currentTime.add(duration, 'seconds');
      i += 3;
    }

    if (endWithDiscontinuity && last(items)?.type !== 'discontinuity') {
      items.push(PlaylistDiscontinuity());
    }

    return {
      items,
      discontinuitySeq,
    };
  }

  private generatePlaylist(
    items: PlaylistLine[],
    filterOptions: HlsPlaylistFilterOptions,
    discontinuitySequence: number,
    maxSegmentsToKeep: number,
    targetDuration: number,
  ) {
    // Count and remove leading discontinuities
    let leadingDiscontinuities = 0;
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
      const filtered = match(filterOptions)
        .with({ type: 'before_date' }, ({ before }) =>
          reject(allSegments, (segment) => segment.startTime.isBefore(before)),
        )
        .with(
          {
            type: 'before_segment_number',
          },
          (beforeSeg) => {
            const minSeg = Math.max(
              beforeSeg.segmentNumber - beforeSeg.segmentsToKeepBefore,
              0,
            );
            return seq.collect(allSegments, (segment) => {
              const fileName = basename(segment.line);
              const matches = fileName.match(SegmentNameRegex);
              if (!matches || matches.length < 2) {
                return;
              }
              const int = parseInt(matches[1]!);
              if (isNaN(int)) {
                return;
              }
              if (int < minSeg) {
                return;
              }
              return segment;
            });
          },
        )
        .exhaustive();

      allSegments =
        filtered.length >= maxSegmentsToKeep
          ? take(filtered, maxSegmentsToKeep)
          : takeRight(allSegments, maxSegmentsToKeep);
    }

    const startSequence = first(allSegments)?.startSequence ?? 0;

    if (!isEmpty(allSegments)) {
      const index = indexOf(items, first(allSegments));
      discontinuitySequence += filter(take(items, index + 1), {
        type: 'discontinuity',
      }).length;
    }

    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      `#EXT-X-TARGETDURATION:${targetDuration}`,
      `#EXT-X-MEDIA-SEQUENCE:${startSequence}`,
      `#EXT-X-DISCONTINUITY-SEQUENCE:${discontinuitySequence}`,
      '#EXT-X-INDEPENDENT-SEGMENTS',
    ];

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      switch (item.type) {
        case 'discontinuity':
          if (
            i === items.length - 1 ||
            (allSegments as PlaylistLine[]).includes(items[i + 1]!)
          ) {
            lines.push('#EXT-X-DISCONTINUITY');
          }
          break;
        case 'segment':
          if (allSegments.includes(item)) {
            lines.push(item.extInf);
            lines.push(
              `#EXT-X-PROGRAM-DATE-TIME:${item.startTime.format(
                'YYYY-MM-DDTHH:mm:ss.SSSZZ',
              )}`,
            );
            lines.push(item.line);
          }
          break;
      }
    }

    const playlist = lines.join('\n');
    const nextPlaylistStart = first(allSegments)?.startTime ?? dayjs();
    return {
      playlist,
      nextPlaylistStart,
      startSequence,
      count: allSegments.length,
    };
  }
}

class PlaylistSegment {
  public readonly type = 'segment' as const;

  constructor(
    public startTime: Dayjs,
    public extInf: string,
    public line: string,
  ) {}

  get startSequence() {
    const matches = this.line.match(/[A-z/]+(\d+)\.(ts|mp4)/);
    const match = nth(matches, 1);
    return match ? parseInt(match) : null;
  }
}

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
};
