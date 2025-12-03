import type {
  InfiniteData,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';
import type { ProgramOrFolder } from '@tunarr/types';
import type { PagedResult } from '@tunarr/types/api';
import { last } from 'lodash-es';
import { useCallback } from 'react';
import { match, P } from 'ts-pattern';
import { Plex } from '../../../helpers/constants.ts';
import type { ProgramHierarchyHookReturn } from '../../../hooks/channel_config/useProgramHierarchy.ts';
import { usePlexCollectionsInfinite } from '../../../hooks/plex/usePlexCollections.ts';
import { usePlexPlaylistsInfinite } from '../../../hooks/plex/usePlexPlaylists.ts';
import { usePlexItemsInfinite } from '../../../hooks/plex/usePlexSearch.ts';
import useStore from '../../../store/index.ts';
import {
  useCurrentMediaSource,
  useCurrentMediaSourceView,
} from '../../../store/programmingSelector/selectors.ts';
import { LibraryListViewBreadcrumbs } from '../../library/LibraryListViewBreadcrumbs.tsx';
import { ProgramListItem } from '../../library/ProgramListItem.tsx';
import { MediaItemList } from '../MediaItemList.tsx';

const RowsToLoad = 20;

export const PlexProgrammingListView = (
  props: ProgramHierarchyHookReturn<ProgramOrFolder>,
) => {
  const selectedServer = useCurrentMediaSource(Plex);
  const selectedLibrary = useCurrentMediaSourceView(Plex);
  const { urlFilter: searchKey } = useStore(({ plexSearch }) => plexSearch);
  const {
    parentContext,
    pushParentContext,
    clearParentContext,
    popParentContextToIndex,
  } = props;
  const currentParentContext = last(parentContext);
  const bufferSize = 0;

  const subview =
    selectedLibrary?.view.type === 'library'
      ? selectedLibrary.view.subview
      : undefined;

  const plexSearchQuery = usePlexItemsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    searchKey,
    RowsToLoad + bufferSize,
    currentParentContext
      ? {
          parentId: currentParentContext.externalId,
          type: currentParentContext.type,
        }
      : undefined,
  );

  const plexCollectionsQuery = usePlexCollectionsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    RowsToLoad + bufferSize,
    subview === 'collections' && !currentParentContext,
  );

  const plexPlaylistsQuery = usePlexPlaylistsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    RowsToLoad + bufferSize,
    // selectedLibrary?.view.type === 'library',
    subview === 'playlists' && !currentParentContext,
  );

  const query: UseInfiniteQueryResult<
    InfiniteData<PagedResult<ProgramOrFolder[]>>
  > = currentParentContext
    ? plexSearchQuery
    : match(subview)
        .returnType<
          UseInfiniteQueryResult<InfiniteData<PagedResult<ProgramOrFolder[]>>>
        >()
        .with('collections', () => plexCollectionsQuery)
        .with('playlists', () => plexPlaylistsQuery)
        .with(P.nullish, () => plexSearchQuery)
        .exhaustive();

  return (
    <>
      <LibraryListViewBreadcrumbs
        clearParentContext={clearParentContext}
        parentContext={parentContext}
        popParentContextToIndex={popParentContextToIndex}
        pushParentContext={pushParentContext}
      />
      <MediaItemList
        infiniteQuery={query}
        getPageDataSize={useCallback(
          (res: PagedResult<ProgramOrFolder[]>) => ({
            size: res.size,
            total: res.total,
          }),
          [],
        )}
        extractItems={(page) => page.result ?? []}
        renderListItem={({ item, style }) => (
          <ProgramListItem
            key={item.uuid}
            item={item}
            onPushParent={pushParentContext}
            style={style}
          />
        )}
      />
    </>
  );
};
