import { sortBy } from 'lodash-es';
import { ChannelCache } from '../channelCache.js';
import { FileCacheService } from './fileCacheService.js';

/**
 * Manager and Generate M3U content
 *
 * @class M3uService
 */
export class M3uService {
  fileCacheService: FileCacheService;
  channelCache: ChannelCache;
  cacheReady: boolean;

  constructor(fileCacheService: FileCacheService, channelCache: ChannelCache) {
    this.fileCacheService = fileCacheService;
    this.channelCache = channelCache;
    this.cacheReady = false;
  }

  /**
   * Get the channel list in HLS or M3U
   *
   * @param {string} [type='m3u'] List type
   * @returns {promise} Return a Promise with HLS or M3U file content
   * @memberof M3uService
   */
  getChannelList(host: string) {
    return this.buildM3uList(host);
  }

  /**
   *  Build M3U with cache
   *
   * @param {string} host
   * @returns {promise} M3U file content
   * @memberof M3uService
   */

  async buildM3uList(host: string): Promise<string> {
    if (this.cacheReady) {
      const cachedM3U = await this.fileCacheService.getCache('channels.m3u');
      if (cachedM3U) {
        return this.replaceHostOnM3u(host, cachedM3U);
      }
    }
    const channels = sortBy(await this.channelCache.getAllChannels(), 'number');

    const tvg = `{{host}}/api/xmltv.xml`;

    let data = `#EXTM3U url-tvg="${tvg}" x-tvg-url="${tvg}"\n`;

    for (let i = 0; i < channels.length; i++) {
      if (channels[i].stealth !== true) {
        data += `#EXTINF:0 tvg-id="${channels[i].number}" CUID="${
          channels[i].number
        }" tvg-chno="${channels[i].number}" tvg-name="${
          channels[i].name
        }" tvg-logo="${channels[i].icon?.path ?? ''}" group-title="${
          channels[i].groupTitle
        }",${channels[i].name}\n`;
        data += `{{host}}/video?channel=${channels[i].number}\n`;
      }
    }
    if (channels.length === 0) {
      data += `#EXTINF:0 tvg-id="1" tvg-chno="1" tvg-name="dizqueTV" tvg-logo="{{host}}/resources/dizquetv.png" group-title="dizqueTV",dizqueTV\n`;
      data += `{{host}}/setup\n`;
    }
    const saveCacheThread = async () => {
      try {
        await this.fileCacheService.setCache('channels.m3u', data);
        this.cacheReady = true;
      } catch (err) {
        console.error(err);
      }
    };
    await saveCacheThread();
    return this.replaceHostOnM3u(host, data);
  }

  /**
   * Replace {{host}} string with a URL on file contents.
   *
   * @param {*} host
   * @param {*} data
   * @returns
   * @memberof M3uService
   */
  replaceHostOnM3u(host: string, data: string) {
    return data.replace(/\{\{host\}\}/g, host);
  }

  /**
   * Clear channels.m3u file from cache folder.
   *
   * @memberof M3uService
   */
  clearCache() {
    this.cacheReady = false;
  }
}
