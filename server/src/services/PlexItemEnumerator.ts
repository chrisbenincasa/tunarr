import type { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { ProgramLike, TerminalProgram } from '@tunarr/types';
import { asyncPool, unfurlPool } from '../util/asyncPool.ts';

export class PlexHierarchyTraversal {
  #logger: Logger = LoggerFactory.child({
    className: PlexHierarchyTraversal.name,
  });

  constructor(private plex: PlexApiClient) {}

  async expandAncestors(items: TerminalProgram[]): Promise<TerminalProgram[]> {
    const seenItems = new Map<string, ProgramLike>();
    const pool = asyncPool(
      items,
      (item) => this.expandItemAncestorsImpl(item, seenItems),
      { concurrency: 3 },
    );
    return await unfurlPool(pool);
  }

  async expandItemAncestors(item: TerminalProgram): Promise<TerminalProgram> {
    return this.expandItemAncestorsImpl(item, new Map());
  }

  private async expandItemAncestorsImpl(
    item: TerminalProgram,
    seenItems: Map<string, ProgramLike>,
  ): Promise<TerminalProgram> {
    switch (item.type) {
      case 'movie':
      case 'music_video':
      case 'other_video':
        return item;
      case 'episode': {
        const seasonId = item.season?.externalId;
        if (isNonEmptyString(seasonId)) {
          const existing = seenItems.get(seasonId);
          if (existing?.type === 'season') {
            item.season = existing;
          } else {
            const seasonResult = await this.plex.getSeason(seasonId);
            seasonResult.either(
              (season) => {
                seenItems.set(season.externalId, season);
                item.season = season;
              },
              (err) => {
                this.#logger.error(
                  err,
                  'Error querying Plex season %s for episode %s',
                  seasonId,
                  item.externalId,
                );
              },
            );
          }
        }

        const showId = item.show?.externalId ?? item.season?.show?.externalId;
        if (isNonEmptyString(showId)) {
          const existing = seenItems.get(showId);
          if (existing?.type === 'show') {
            item.show = existing;
            if (item.season) {
              item.season.show = existing;
            }
          } else {
            const showResult = await this.plex.getShow(showId);
            showResult.either(
              (show) => {
                item.show = show;
                if (item.season) {
                  item.season.show = show;
                }
                seenItems.set(show.externalId, show);
              },
              (err) => {
                this.#logger.error(
                  err,
                  'Error querying Plex show %s for episode %s',
                  showId,
                  item.externalId,
                );
              },
            );
          }
        }

        return item;
      }
      case 'track': {
        const albumId = item.album?.externalId;
        const artistId =
          item.artist?.externalId ?? item.album?.artist?.externalId;
        if (isNonEmptyString(albumId)) {
          const existing = seenItems.get(albumId);
          if (existing?.type === 'album') {
            item.album = existing;
          } else {
            const albumResult = await this.plex.getMusicAlbum(albumId);
            albumResult.either(
              (album) => {
                item.album = album;
                seenItems.set(album.externalId, album);
              },
              (err) => {
                this.#logger.error(
                  err,
                  'Error querying Plex album %s for track %s',
                  albumId,
                  item.externalId,
                );
              },
            );
          }
        }

        if (isNonEmptyString(artistId)) {
          const existing = seenItems.get(artistId);
          if (existing?.type === 'artist') {
            item.artist = existing;
            if (item.album) {
              item.album.artist = existing;
            }
          } else {
            const artistResult = await this.plex.getMusicArtist(artistId);
            artistResult.either(
              (artist) => {
                item.artist = artist;
                if (item.album) {
                  item.album.artist = artist;
                }
                seenItems.set(artist.externalId, artist);
              },
              (err) => {
                this.#logger.error(
                  err,
                  'Error querying Plex artist %s for track %s',
                  artistId,
                  item.externalId,
                );
              },
            );
          }
        }

        return item;
      }
    }
  }
}
