import type { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { flatMapAsyncSeq } from '@/util/index.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import {
  isTerminalItemType,
  type Library,
  type ProgramOrFolder,
  type TerminalProgram,
} from '@tunarr/types';
import type { PlexTerminalMedia } from '@tunarr/types/plex';
import { flatten, flattenDeep, map, uniqBy } from 'lodash-es';
import { match, P } from 'ts-pattern';
import type { MediaSourceOrm } from '../db/schema/MediaSource.ts';
import { asyncPool, unfurlPool } from '../util/asyncPool.ts';

export type EnrichedPlexTerminalMedia = PlexTerminalMedia & {
  id?: string;
};

export class PlexItemEnumerator {
  #logger: Logger = LoggerFactory.child({ className: PlexItemEnumerator.name });

  constructor(private plex: PlexApiClient) {}

  async enumerateItems(
    mediaSource: MediaSourceOrm,
    initialItems: (ProgramOrFolder | Library)[],
  ) {
    this.#logger.debug(
      'enumerating items: %O',
      map(initialItems, (item) => item.externalId),
    );
    const allItems = await flatMapAsyncSeq(initialItems, (item) =>
      this.enumerateItem(mediaSource, item),
    );
    return uniqBy(allItems, (item) => item.externalId);
  }

  async enumerateItem(
    mediaSource: MediaSourceOrm,
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
            (nextItem) => this.enumerateItem(mediaSource, nextItem, item, acc),
            { concurrency: 3 },
          );
          return flatten(await unfurlPool(pool));
        })
        .then((allResults) => flattenDeep(allResults));
    }
  }
}
