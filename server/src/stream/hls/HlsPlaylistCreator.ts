import { StreamLineupItem } from '@/db/derived_types/StreamLineup.ts';
import { StreamProgramCalculator } from '@/stream/StreamProgramCalculator.ts';
import dayjs from '@/util/dayjs.ts';
import { isNonEmptyString } from '@/util/index.ts';
import { ChannelStreamMode } from '@tunarr/types';
import { round } from 'lodash-es';
import NodeCache from 'node-cache';
import util from 'node:util';

const playlistFmtString = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:%d
#EXT-X-DISCONTINUITY
#EXTINF:%d
%s://%s/stream?channel=%s&index=%d%s
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
    const endTime = lineupItem.programBeginMs + lineupItem.duration;
    const remainingDuration = endTime - +now;

    const streamMode = isNonEmptyString(request.streamMode)
      ? `&mode=${request.streamMode}`
      : '';
    return util.format(
      playlistFmtString,
      currentIndex,
      round(remainingDuration / 1000.0, 2),
      request.protocol,
      request.host,
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
