import { createExternalId } from '@tunarr/shared';
import {
  PlexChildMediaViewType,
  PlexLibrarySection,
  PlexMedia,
  PlexTerminalMedia,
  isPlexDirectory,
  isTerminalItem,
} from '@tunarr/types/plex';
import { flatten, isNil, uniqBy } from 'lodash-es';
import map from 'lodash-es/map';
import { ProgramDB } from '../dao/programDB';
import { Plex } from '../external/plex';
import { typedProperty } from '../types/path';
import { flatMapAsyncSeq, wait } from '../util/index.js';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory';
import { Timer } from '../util/perf';
import { asyncPool, unfurlPool } from '../util/asyncPool';

export type EnrichedPlexTerminalMedia = PlexTerminalMedia & {
  id?: string;
};

export class PlexItemEnumerator {
  #logger: Logger = LoggerFactory.child({ className: PlexItemEnumerator.name });
  #timer = new Timer(this.#logger);
  #plex: Plex;
  #programDB: ProgramDB;

  constructor(plex: Plex, programDB: ProgramDB) {
    this.#plex = plex;
    this.#programDB = programDB;
  }

  async enumerateItems(initialItems: (PlexMedia | PlexLibrarySection)[]) {
    this.#logger.debug(
      'enumerating items: %O',
      map(initialItems, (item) => item.key),
    );
    const allItems = await flatMapAsyncSeq(initialItems, (item) =>
      this.enumerateItem(item),
    );
    return uniqBy(allItems, typedProperty('key'));
  }

  async enumerateItem(
    initialItem: PlexMedia | PlexLibrarySection,
  ): Promise<EnrichedPlexTerminalMedia[]> {
    const loopInner = async (
      item: PlexMedia | PlexLibrarySection,
    ): Promise<PlexTerminalMedia[]> => {
      await wait(50);
      if (isTerminalItem(item)) {
        return [item];
      } else if (isPlexDirectory(item)) {
        return [];
      } else {
        const plexResult = await this.#plex.doGet<PlexChildMediaViewType>(
          item.key,
        );

        if (isNil(plexResult)) {
          // TODO Log
          return [];
        }

        // TODO: we could use a single pqueue here
        return flatten(
          await unfurlPool(
            asyncPool<
              PlexMedia | PlexLibrarySection,
              EnrichedPlexTerminalMedia[]
            >(plexResult.Metadata, (listing) => loopInner(listing), {
              concurrency: 3,
            }),
          ),
        );
      }
    };

    // q.add(async () => {
    //   return await
    // })

    const res = await this.#timer.timeAsync('loop ' + initialItem.key, () =>
      loopInner(initialItem),
    );

    const externalIds: [string, string, string][] = res.map(
      (m) => ['plex', this.#plex.serverName, m.key] as const,
    );

    // This is best effort - if the user saves these IDs later, the upsert
    // logic should figure out what is new/existing
    try {
      const existingIdsByExternalId = await this.#timer.timeAsync(
        'programIdsByExternalIds',
        () => this.#programDB.programIdsByExternalIds(new Set(externalIds)),
      );
      return map(res, (media) => ({
        ...media,
        id: existingIdsByExternalId[
          createExternalId('plex', this.#plex.serverName, media.key)
        ],
      }));
    } catch (e) {
      console.error('Unable to retrieve IDs in batch', e);
    }

    return res;
  }
}
