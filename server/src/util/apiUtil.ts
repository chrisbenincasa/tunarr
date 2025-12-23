import type { Library, ProgramOrFolder } from '@tunarr/types';
import { isEmpty } from 'lodash-es';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.ts';
import { ServerRequestContext } from '../ServerContext.ts';
import { groupByUniq } from './index.ts';

export function addTunarrLibraryIdsToItems(
  items: ProgramOrFolder[],
  libraryId: string,
): ProgramOrFolder[] {
  for (const item of items) {
    if (isEmpty(item.libraryId)) {
      item.libraryId = libraryId;
      if (item.type === 'episode') {
        if (item.season) {
          item.season.libraryId = libraryId;
          if (item.show) {
            item.show.libraryId = libraryId;
          }
          if (item.season.show) {
            item.season.show.libraryId = libraryId;
          }
        }
      } else if (item.type === 'track') {
        if (item.album) {
          item.album.libraryId = libraryId;
          if (item.artist) {
            item.artist.libraryId = libraryId;
          }
          if (item.album.artist) {
            item.album.artist.libraryId = libraryId;
          }
        }
      }
    }
  }

  return items;
}
export async function addTunarrLibraryIdsToResponse(
  response: Library[],
  mediaSource: MediaSourceWithRelations,
  attempts: number = 1,
) {
  if (attempts > 2) {
    return;
  }

  const librariesByExternalId = groupByUniq(
    mediaSource.libraries,
    (lib) => lib.externalKey,
  );
  let needsRefresh = false;
  for (const library of response) {
    const tunarrLibrary = librariesByExternalId[library.externalId];
    if (!tunarrLibrary) {
      needsRefresh = true;
      continue;
    }

    library.uuid = tunarrLibrary.uuid;
  }

  if (needsRefresh) {
    const ctx = ServerRequestContext.currentServerContext()!;
    await ctx.mediaSourceLibraryRefresher.refreshMediaSource(mediaSource);
    // This definitely exists...
    const newMediaSource = await ctx.mediaSourceDB.getById(mediaSource.uuid);
    return addTunarrLibraryIdsToResponse(
      response,
      newMediaSource!,
      attempts + 1,
    );
  }

  return;
}
