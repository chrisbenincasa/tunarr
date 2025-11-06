import type { StreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { StreamProgramCalculator } from '@/stream/StreamProgramCalculator.js';
import dayjs from '@/util/dayjs.js';
import { isNonEmptyString } from '@/util/index.js';
import type { ChannelStreamMode } from '@tunarr/types';
import NodeCache from 'node-cache';
import util from 'node:util';
import { match, P } from 'ts-pattern';

const playlistFmtString = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:%d
#EXT-X-DISCONTINUITY
#EXTINF:%d
%s://%s/stream.%s?channel=%s&index=%d%s
`;

type CachedCurrentIndex = {
  startTime: number;
  index: number;
};

type RequestDetails = {
  protocol: string;
  host: string;
  channelIdOrNumber: string;
  streamMode: ChannelStreamMode;
  outputFormat: 'mkv' | 'mpegts' | 'mp4';
};

export class HlsPlaylistCreator {
  private static cache = new NodeCache({
    stdTTL: +dayjs.duration({ days: 1 }),
  });

  constructor(private streamProgramCalculator: StreamProgramCalculator) {}

  async createPlaylist(
    channelId: string,
    now: dayjs.Dayjs,
    request: RequestDetails,
  ) {
    const lineupItemResult =
      await this.streamProgramCalculator.getCurrentLineupItem({
        channelId,
        startTime: +now,
        allowSkip: false,
      });

    if (lineupItemResult.isFailure()) {
      throw lineupItemResult.error;
    }

    const { lineupItem } = lineupItemResult.get();

    const currentIndex = this.getLineupItemIndex(channelId, lineupItem);

    const streamMode = isNonEmptyString(request.streamMode)
      ? `&mode=${request.streamMode}`
      : '';
    return util.format(
      playlistFmtString,
      currentIndex,
      dayjs
        .duration(lineupItem.streamDuration ?? lineupItem.duration)
        .asSeconds(),
      request.protocol,
      request.host,
      match(request.outputFormat)
        .with(P.union('mkv', 'mp4'), (fmt) => fmt)
        .with('mpegts', () => 'ts')
        .exhaustive(),
      request.channelIdOrNumber,
      currentIndex,
      streamMode,
    );
  }

  private getLineupItemIndex(channelId: string, lineupItem: StreamLineupItem) {
    const cachedValue =
      HlsPlaylistCreator.cache.get<CachedCurrentIndex>(channelId);
    if (cachedValue && cachedValue.startTime === lineupItem.programBeginMs) {
      return cachedValue.index;
    } else if (cachedValue) {
      HlsPlaylistCreator.cache.set<CachedCurrentIndex>(channelId, {
        startTime: lineupItem.programBeginMs,
        index: cachedValue.index + 1,
      });
      return cachedValue.index + 1;
    } else {
      HlsPlaylistCreator.cache.set<CachedCurrentIndex>(channelId, {
        startTime: lineupItem.programBeginMs,
        index: 1,
      });
      return 1;
    }
  }
}
