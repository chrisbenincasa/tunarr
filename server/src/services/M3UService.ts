import { ChannelDB } from '@/db/ChannelDB.ts';
import { getChannelId } from '@/util/channels.js';
import { devAssert } from '@/util/debug.js';
import { attempt, isDefined, isNonEmptyString } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { Mutex } from 'async-mutex';
import { isError, sortBy } from 'lodash-es';
import { FileCacheService } from './FileCacheService.ts';

/**
 * Manager and Generate M3U content
 *
 * @class M3uService
 */
export class M3uService {
  private static cacheKey = 'channels.m3u';
  private static lock = new Mutex();

  #logger = LoggerFactory.child({ className: this.constructor.name });
  #channelDB: ChannelDB;
  #fileCacheService: FileCacheService;

  // TODO figure out a better way to manage interdependencies of 'services'
  constructor(
    fileCacheService: FileCacheService = new FileCacheService(),
    channelDB: ChannelDB = new ChannelDB(),
  ) {
    this.#channelDB = channelDB;
    this.#fileCacheService = fileCacheService;
  }

  async getChannelsM3U(host: string): Promise<string> {
    return await M3uService.lock.runExclusive(async () =>
      this.replaceHostOnM3u(host, await this.getChannelsM3UInternal()),
    );
  }

  /**
   * Get the channel list in HLS or M3U
   */
  private async getChannelsM3UInternal(): Promise<string> {
    devAssert(M3uService.lock.isLocked());

    const cachedM3U = await attempt(() =>
      this.#fileCacheService.getCache(M3uService.cacheKey),
    );

    if (!isError(cachedM3U) && isDefined(cachedM3U)) {
      return cachedM3U;
    }

    const channels = sortBy(await this.#channelDB.getAllChannels(), 'number');

    const tvg = `{{host}}/api/xmltv.xml`;

    let data = `#EXTM3U url-tvg="${tvg}" x-tvg-url="${tvg}"\n`;

    for (const channel of channels) {
      if (channel.stealth) {
        continue;
      }
      const channelId = getChannelId(channel.number);
      data += `#EXTINF:-1 tvg-id="${channelId}" channel-id="${channelId}" CUID="${channelId}" tvg-chno="${
        channel.number
      }" tvg-name="${channel.name}" tvg-logo="${
        isNonEmptyString(channel.icon?.path)
          ? channel.icon.path
          : '{{host}}/images/tunarr.png'
      }" group-title="${channel.groupTitle}",${channel.name}\n`;

      data += `{{host}}/stream/channels/${channel.uuid}?streamMode=${channel.streamMode}\n`;
    }

    if (channels.length === 0) {
      data += `#EXTINF:0 tvg-id="1" tvg-chno="1" tvg-name="tunarr" tvg-logo="{{host}}/images/tunarr.png" group-title="tunarr",tunarr\n`;
      data += `{{host}}/setup\n`;
    }

    try {
      await this.#fileCacheService.setCache(M3uService.cacheKey, data);
    } catch (err) {
      this.#logger.error(err, 'Unable to set file cache for channels.m3u');
    }

    return data;
  }

  /**
   * Replace {{host}} string with a URL on file contents.
   */
  private replaceHostOnM3u(host: string, data: string) {
    return data.replace(/\{\{host\}\}/g, host);
  }

  /**
   * Clear channels.m3u file from cache folder.
   */
  async clearCache() {
    await M3uService.lock.runExclusive(() => {
      return this.#fileCacheService.deleteCache(M3uService.cacheKey);
    });
  }

  /**
   * Clears the cache and regenerated the cached template
   */
  async regenerateCache() {
    await M3uService.lock.runExclusive(async () => {
      await this.#fileCacheService.deleteCache(M3uService.cacheKey);
      await this.getChannelsM3UInternal();
    });
  }
}
