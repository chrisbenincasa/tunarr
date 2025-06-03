import type { PlexMedia } from '@tunarr/types/plex';
import { last } from 'lodash-es';
import { match, P } from 'ts-pattern';
import { Plex } from '../../../helpers/constants.ts';
import { getPlexPageDataSize } from '../../../helpers/plexUtil.ts';
import type { ProgramHierarchyHookReturn } from '../../../hooks/channel_config/useProgramHierarchy.ts';
import { usePlexCollectionsInfinite } from '../../../hooks/plex/usePlexCollections.ts';
import { usePlexPlaylistsInfinite } from '../../../hooks/plex/usePlexPlaylists.ts';
import { usePlexItemsInfinite } from '../../../hooks/plex/usePlexSearch.ts';
import useStore from '../../../store/index.ts';
import {
  useCurrentMediaSource,
  useCurrentMediaSourceView,
} from '../../../store/programmingSelector/selectors.ts';
import { MediaItemList } from '../MediaItemList.tsx';
import { PlexListItem } from './PlexListItem.tsx';
import { PlexListViewBreadcrumbs } from './PlexListViewBreadcrumbs.tsx';

const RowsToLoad = 20;

export const PlexProgrammingListView = (
  props: ProgramHierarchyHookReturn<PlexMedia>,
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
          parentId: currentParentContext.ratingKey,
          type: currentParentContext.type,
        }
      : undefined,
  );

  const plexCollectionsQuery = usePlexCollectionsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    RowsToLoad + bufferSize,
    subview === 'collections',
  );

  const plexPlaylistsQuery = usePlexPlaylistsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    RowsToLoad + bufferSize,
    // selectedLibrary?.view.type === 'library',
    // subview === 'playlists',
  );

  const query = currentParentContext
    ? plexSearchQuery
    : match(subview)
        .with('collections', () => plexCollectionsQuery)
        .with('playlists', () => plexPlaylistsQuery)
        .with(P.nullish, () => plexSearchQuery)
        .exhaustive();

  return (
    <>
      <PlexListViewBreadcrumbs
        clearParentContext={clearParentContext}
        parentContext={parentContext}
        popParentContextToIndex={popParentContextToIndex}
      />
      <MediaItemList
        infiniteQuery={query}
        getPageDataSize={getPlexPageDataSize}
        extractItems={(page) => page.Metadata ?? []}
        renderListItem={({ item, style }) => (
          <PlexListItem
            key={item.guid}
            item={item}
            onPushParent={pushParentContext}
            style={style}
          />
        )}
      />
    </>
  );
};
