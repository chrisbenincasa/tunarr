import { sortBy } from 'lodash-es';
import { ChannelDB } from '../dao/channelDb.js';
import { FileCacheService } from './fileCacheService.js';
import { M3uChannel, M3uHeaders, writeM3U } from '@tunarr/playlist';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

/**
 * Manager and Generate M3U content
 *
 * @class M3uService
 */
export class M3uService {
  #logger = LoggerFactory.child({ className: M3uService.name });
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
  getChannelList(host: string): Promise<string> {
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
    if (this.#cacheReady) {
      const cachedM3U = await this.#fileCacheService.getCache('channels.m3u');
      if (cachedM3U) {
        return this.replaceHostOnM3u(host, cachedM3U);
      }
    }

    const channels = sortBy(await this.#channelDB.getAllChannels(), 'number');

    const tvg = `{{host}}/api/xmltv.xml`;

    // let data = `#EXTM3U url-tvg="${tvg}" x-tvg-url="${tvg}"\n`;
    const channelsOut: M3uChannel[] = [];

    for (const channel of channels) {
      if (channel.stealth) {
        continue;
      }

      channelsOut.push({
        tvgId: channel.number.toString(),
        tvgChno: channel.number.toString(),
        tvgName: channel.name,
        tvgLogo: channel.icon?.path ?? '',
        groupTitle: channel.groupTitle,
        name: channel.name,
        // Do not use query params here, because Plex doesn't handle them well (as they might append
        // query params themselves...)
        url: `{{host}}/channels/${channel.number}/video`,
      });
    }

    if (channelsOut.length === 0) {
      channelsOut.push({
        tvgId: '1',
        tvgChno: '1',
        tvgName: 'tunarr',
        tvgLogo: '{{host}}/images/tunarr.png',
        groupTitle: 'tunarr',
        name: 'tunarr',
        url: '{{host}}/setup',
      });
    }

    const headers: M3uHeaders = {
      // Workaround bug with named keys
      'url-tvg': tvg,
      'x-tvg-url': tvg,
    };

    const data = writeM3U({ channels: channelsOut, headers });

    try {
      await this.#fileCacheService.setCache('channels.m3u', data);
      this.#cacheReady = true;
    } catch (err) {
      this.#logger.error(err, 'Error generating m3u');
    }

    return this.replaceHostOnM3u(host, data);
  }

  buildChannelM3U(
    protocol: string,
    host: string,
    channel: string | number,
    sessionId: number,
  ) {
    // Maximum number of streams to concatinate beyond channel starting
    // If someone passes this number then they probably watch too much television
    const maxStreamsToPlayInARow = 100;

    const lines: string[] = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-ALLOW-CACHE:YES',
      '#EXT-X-TARGETDURATION:60',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      // `#EXT-X-STREAM-INF:BANDWIDTH=1123000`,
    ];

    lines.push(
      `${protocol}://${host}/stream?channel=${channel}&first=0&m3u8=1&session=${sessionId}`,
    );

    lines.push(
      `${protocol}://${host}/stream?channel=${channel}&first=1&m3u8=1&session=${sessionId}`,
    );

    for (let i = 0; i < maxStreamsToPlayInARow - 1; i++) {
      lines.push(
        `${protocol}://${host}/stream?channel=${channel}&m3u8=1&session=${sessionId}`,
      );
    }

    return lines.join('\n');
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
