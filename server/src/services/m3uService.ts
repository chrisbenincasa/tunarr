import { sortBy } from 'lodash-es';
import { ChannelDB } from '../dao/channelDb.js';
import { FileCacheService } from './fileCacheService.js';

/**
 * Manager and Generate M3U content
 *
 * @class M3uService
 */
export class M3uService {
  #channelDB: ChannelDB;
  #fileCacheService: FileCacheService;
  #cacheReady: boolean;

  // TODO figure out a better way to manage interdependencies of 'services'
  constructor(
    fileCacheService: FileCacheService = new FileCacheService(),
    channelDB: ChannelDB = new ChannelDB(),
  ) {
    this.#channelDB = channelDB;
    this.#fileCacheService = fileCacheService;
    this.#cacheReady = false;
  }

  /**
   * Get the channel list in HLS or M3U
   */
  async getChannelsM3U(host: string): Promise<string> {
    if (this.#cacheReady) {
      const cachedM3U = await this.#fileCacheService.getCache('channels.m3u');
      if (cachedM3U) {
        return this.replaceHostOnM3u(host, cachedM3U);
      }
    }
    const channels = sortBy(await this.#channelDB.getAllChannels(), 'number');

    const tvg = `{{host}}/api/xmltv.xml`;

    let data = `#EXTM3U url-tvg="${tvg}" x-tvg-url="${tvg}"\n`;

    for (let i = 0; i < channels.length; i++) {
      if (channels[i].stealth !== true) {
        data += `#EXTINF:0 tvg-id="${channels[i].number}.tunarr" channel-id="${
          channels[i].uuid
        }" CUID="${channels[i].uuid}" tvg-chno="${
          channels[i].number
        }" tvg-name="${channels[i].name}" tvg-logo="${
          channels[i].icon?.path ?? ''
        }" group-title="${channels[i].groupTitle}",${channels[i].name}\n`;

        data += `{{host}}/stream/channels/${channels[i].uuid}.ts\n`;
      }
    }
    if (channels.length === 0) {
      data += `#EXTINF:0 tvg-id="1" tvg-chno="1" tvg-name="tunarr" tvg-logo="{{host}}/images/tunarr.png" group-title="tunarr",tunarr\n`;
      data += `{{host}}/setup\n`;
    }

    try {
      await this.#fileCacheService.setCache('channels.m3u', data);
      this.#cacheReady = true;
    } catch (err) {
      console.error(err);
    }

    return this.replaceHostOnM3u(host, data);
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
  clearCache() {
    this.#cacheReady = false;
  }
}
