import type { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { flatMapAsyncSeq } from '@/util/index.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { ProgramLike } from '@tunarr/types';
import {
  isTerminalItemType,
  type Library,
  type ProgramOrFolder,
  type TerminalProgram,
} from '@tunarr/types';
import { flatten, flattenDeep, map, uniqBy } from 'lodash-es';
import { match, P } from 'ts-pattern';
import { asyncPool, unfurlPool } from '../util/asyncPool.ts';

export class PlexHierarchyTraversal {
  #logger: Logger = LoggerFactory.child({
    className: PlexHierarchyTraversal.name,
  });

  constructor(private plex: PlexApiClient) {}

  async expandDescendants(initialItems: (ProgramOrFolder | Library)[]) {
    this.#logger.debug(
      'enumerating items: %O',
      map(initialItems, (item) => item.externalId),
    );
    const allItems = await flatMapAsyncSeq(initialItems, (item) =>
      this.expandItemDescendants(item),
    );
    return uniqBy(allItems, (item) => item.externalId);
  }

  async expandItemDescendants(
    item: ProgramOrFolder | Library,
    parent?: ProgramOrFolder | Library,
    acc: TerminalProgram[] = [],
  ): Promise<TerminalProgram[]> {
    if (isTerminalItemType(item)) {
      if ((item.duration ?? 0) <= 0) {
        return acc;
      }

      if (item.type === 'episode' && parent?.type === 'season') {
        item.season = parent;
      } else if (item.type === 'track' && parent?.type === 'album') {
        item.album = parent;
      }

      acc.push(item);
      return acc;
    } else {
      if (item.type === 'season' && parent?.type === 'show') {
        item.show = parent;
      }

      const parentType = match(item.type)
        .returnType<'item' | 'collection' | 'playlist'>()
        .with('collection', () => 'collection')
        .with('playlist', () => 'playlist')
        .with(P._, () => 'item')
        .exhaustive();
      return this.plex
        .getItemChildren(item.externalId, parentType)
        .then(async (result) => {
          const pool = asyncPool(
            result.getOrThrow(),
            (nextItem) => this.expandItemDescendants(nextItem, item, acc),
            { concurrency: 3 },
          );
          return flatten(await unfurlPool(pool));
        })
        .then((allResults) => flattenDeep(allResults));
    }
  }

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
    return match(item)
      .with({ type: P.union('movie', 'music_video', 'other_video') }, (m) =>
        Promise.resolve(m),
      )
      .with({ type: 'episode' }, async (ep) => {
        const seasonId = ep.season?.externalId;
        if (isNonEmptyString(seasonId)) {
          const existing = seenItems.get(seasonId);
          if (existing?.type === 'season') {
            ep.season = existing;
          } else {
            const seasonResult = await this.plex.getSeason(seasonId);
            seasonResult.either(
              (season) => {
                seenItems.set(season.externalId, season);
                ep.season = season;
              },
              (err) => {
                this.#logger.error(
                  err,
                  'Error querying Plex season %s for episode %s',
                  seasonId,
                  ep.externalId,
                );
              },
            );
          }
        }

        const showId = ep.show?.externalId ?? ep.season?.show?.externalId;
        if (isNonEmptyString(showId)) {
          const existing = seenItems.get(showId);
          if (existing?.type === 'show') {
            ep.show = existing;
            if (ep.season) {
              ep.season.show = existing;
            }
          } else {
            const showResult = await this.plex.getShow(showId);
            showResult.either(
              (show) => {
                ep.show = show;
                if (ep.season) {
                  ep.season.show = show;
                }
                seenItems.set(show.externalId, show);
              },
              (err) => {
                this.#logger.error(
                  err,
                  'Error querying Plex show %s for episode %s',
                  showId,
                  ep.externalId,
                );
              },
            );
          }
        }

        return ep;
      })
      .with({ type: 'track' }, async (track) => {
        const albumId = track.album?.externalId;
        const artistId =
          track.artist?.externalId ?? track.album?.artist?.externalId;
        if (isNonEmptyString(albumId)) {
          const existing = seenItems.get(albumId);
          if (existing?.type === 'album') {
            track.album = existing;
          } else {
            const albumResult = await this.plex.getMusicAlbum(albumId);
            albumResult.either(
              (album) => {
                track.album = album;
                seenItems.set(album.externalId, album);
              },
              (err) => {
                this.#logger.error(
                  err,
                  'Error querying Plex album %s for track %s',
                  albumId,
                  track.externalId,
                );
              },
            );
          }
        }

        if (isNonEmptyString(artistId)) {
          const existing = seenItems.get(artistId);
          if (existing?.type === 'artist') {
            track.artist = existing;
            if (track.album) {
              track.album.artist = existing;
            }
          } else {
            const artistResult = await this.plex.getMusicArtist(artistId);
            artistResult.either(
              (artist) => {
                track.artist = artist;
                if (track.album) {
                  track.album.artist = artist;
                }
                seenItems.set(artist.externalId, artist);
              },
              (err) => {
                this.#logger.error(
                  err,
                  'Error querying Plex artist %s for track %s',
                  artistId,
                  track.externalId,
                );
              },
            );
          }
        }

        return track;
      })
      .exhaustive();
  }
}
