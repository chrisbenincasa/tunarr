import { createExternalId } from '@tunarr/shared';
import {
  PlexChildMediaViewType,
  PlexLibrarySection,
  PlexMedia,
  PlexTerminalMedia,
  isPlexDirectory,
  isTerminalItem,
} from '@tunarr/types/plex';
import { isNil, uniqBy } from 'lodash-es';
import map from 'lodash-es/map';
import { ProgramDB } from '../dao/programDB';
import { Plex } from '../external/plex';
import { typedProperty } from '../types/path';
import { flatMapAsyncSeq } from '../util/index.js';

type EnrichedPlexTerminalMedia = PlexTerminalMedia & {
  id?: string;
};

export class PlexItemEnumerator {
  #plex: Plex;
  #programDB: ProgramDB;

  constructor(plex: Plex, programDB: ProgramDB) {
    this.#plex = plex;
    this.#programDB = programDB;
  }

  async enumerateItems(initialItems: (PlexMedia | PlexLibrarySection)[]) {
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

        const results: EnrichedPlexTerminalMedia[] = [];
        for (const listing of plexResult.Metadata) {
          results.push(...(await loopInner(listing)));
        }

        return results;
      }
    };

    const res = await loopInner(initialItem);
    const externalIds: [string, string, string][] = res.map(
      (m) => ['plex', this.#plex.serverName, m.key] as const,
    );

    // This is best effort - if the user saves these IDs later, the upsert
    // logic should figure out what is new/existing
    try {
      const existingIdsByExternalId = await this.#programDB.lookupByExternalIds(
        new Set(externalIds),
      );
      return map(res, (media) => ({
        ...media,
        id: existingIdsByExternalId[
          createExternalId('plex', this.#plex.serverName, media.key)
        ]?.id,
      }));
    } catch (e) {
      console.error('Unable to retrieve IDs in batch', e);
    }

    return res;
  }
}
