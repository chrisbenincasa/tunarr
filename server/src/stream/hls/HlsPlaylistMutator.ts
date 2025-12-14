import { isNonEmptyString } from '@/util/index.js';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  dropWhile,
  filter,
  first,
  indexOf,
  isEmpty,
  last,
  nth,
  reject,
  take,
  takeRight,
  trimEnd,
} from 'lodash-es';

export class HlsPlaylistMutator {
  trimPlaylistWithDiscontinuity(
    start: Dayjs,
    filterBefore: Dayjs,
    playlistLines: string[],
    maxSegments: number = 10,
  ) {
    return this.trimPlaylist(
      start,
      filterBefore,
      playlistLines,
      maxSegments,
      true,
    );
  }

  trimPlaylist(
    start: Dayjs,
    filterBefore: Dayjs,
    playlistLines: string[],
    maxSegments: number = 10,
    endWithDiscontinuity: boolean = false,
  ): TrimPlaylistResult {
    const { items, discontinuitySeq } = this.parsePlaylist(
      start,
      playlistLines,
      endWithDiscontinuity,
    );

    const generateResult = this.generatePlaylist(
      items,
      filterBefore,
      discontinuitySeq,
      maxSegments,
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
    filterBefore: Dayjs,
    discontinuitySequence: number,
    maxSegments: number,
  ) {
    if (first(items)?.type === 'discontinuity') {
      discontinuitySequence++;
    }

    items = dropWhile(items, (item) => item.type === 'discontinuity');
    // while (first(items)?.type === 'discontinuity') {
    //   items.shift();
    // }

    let allSegments = filter(
      items,
      (item): item is PlaylistSegment => item.type === 'segment',
    );

    if (allSegments.length > maxSegments) {
      const afterTimeFilter = reject(allSegments, (segment) =>
        segment.startTime.isBefore(filterBefore),
      );
      allSegments =
        afterTimeFilter.length >= maxSegments
          ? take(afterTimeFilter, maxSegments)
          : takeRight(allSegments, maxSegments);
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
      '#EXT-X-TARGETDURATION:4',
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
    const matches = this.line.match(/[A-z/]+(\d+)\.[ts|mp4]/);
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
