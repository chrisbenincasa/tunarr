import { useInfiniteJellyfinLibraryItems } from '@/hooks/jellyfin/useJellyfinApi';
import {
  useCurrentMediaSource,
  useCurrentSourceLibrary,
} from '@/store/programmingSelector/selectors';
import React, { useCallback, useMemo, useState } from 'react';
import {
  GridInlineModalProps,
  GridItemProps,
  MediaItemGrid,
} from './MediaItemGrid.tsx';
import { Box, Tab, Tabs } from '@mui/material';
import { JellyfinGridItem } from './JellyfinGridItem.tsx';
import { tag } from '@tunarr/types';
import { MediaSourceId } from '@tunarr/types/schemas';
import { JellyfinItem, JellyfinItemKind } from '@tunarr/types/jellyfin';
import { InlineModal } from '../InlineModal.tsx';
import { extractLastIndexes } from '@/helpers/inlineModalUtil.ts';
import { first, flatMap } from 'lodash-es';
import { forJellyfinItem } from '@/helpers/util.ts';

enum TabValues {
  Library = 0,
}

// TODO move this somewhere common
function isParentItem(item: JellyfinItem) {
  switch (item.Type) {
    // These are the currently supported item types
    case 'AggregateFolder':
    case 'Season':
    case 'Series':
    case 'CollectionFolder':
    case 'MusicAlbum':
    case 'MusicArtist':
    case 'MusicGenre':
    case 'Genre':
    case 'Playlist':
    case 'PlaylistsFolder':
      return true;
    default:
      return false;
  }
}

const childJellyfinType = forJellyfinItem<JellyfinItemKind>({
  Season: 'Episode',
  Series: 'Season',
  default: 'Video',
});

export function JellyfinProgrammingSelector() {
  const selectedServer = useCurrentMediaSource('jellyfin');
  const selectedLibrary = useCurrentSourceLibrary('jellyfin');

  const [tabValue, setTabValue] = useState(TabValues.Library);

  const itemTypes: JellyfinItemKind[] = [];
  if (selectedLibrary?.library.CollectionType) {
    switch (selectedLibrary.library.CollectionType) {
      case 'movies':
        itemTypes.push('Movie');
        break;
      case 'tvshows':
        itemTypes.push('Series');
        break;
      case 'music':
        itemTypes.push('MusicArtist');
        break;
      default:
        break;
    }
  }

  const jellyfinItemsQuery = useInfiniteJellyfinLibraryItems(
    selectedServer?.id ?? tag<MediaSourceId>(''),
    selectedLibrary?.library.Id ?? '',
    itemTypes,
    true,
    20,
  );

  const totalItems = useMemo(() => {
    return first(jellyfinItemsQuery.data?.pages)?.TotalRecordCount ?? 0;
  }, [jellyfinItemsQuery.data]);

  const renderGridItem = (
    gridItemProps: GridItemProps<JellyfinItem>,
    modalProps: GridInlineModalProps<JellyfinItem>,
  ) => {
    // const numRows = Math.floor(totalItems / modalProps.rowSize);
    // console.log('num rows', numRows, gridItemProps.index / modalProps.rowSize);
    // const isLastRow = gridItemProps.index / modalProps.rowSize > numRows;
    const isLast = gridItemProps.index === totalItems - 1;

    // let extraInlineModal: JSX.Element | null = null;
    // if (isLast) {
    //   extraInlineModal = renderFinalRowInlineModal(modalProps);
    // }

    if (modalProps.open) {
      console.log(
        '%O',
        modalProps,
        gridItemProps.index,
        (gridItemProps.index + 1) % modalProps.rowSize === 0,
        isLast,
      );
    }
    const renderModal =
      isParentItem(gridItemProps.item) &&
      ((gridItemProps.index + 1) % modalProps.rowSize === 0 || isLast);
    /*gridItemProps.index % modalProps.rowSize === 0 &&*/
    if (isLast) {
      console.log('last', gridItemProps.index);
    }
    return (
      <React.Fragment key={gridItemProps.item.Id}>
        <JellyfinGridItem {...gridItemProps} />
        {renderModal && (
          <InlineModal
            {...modalProps}
            extractItemId={(item) => item.Id}
            sourceType="jellyfin"
            getItemType={(item) => item.Type}
            getChildItemType={childJellyfinType}
          />
        )}
        {/* {extraInlineModal} */}
      </React.Fragment>
    );
  };

  const renderFinalRowInlineModal = useCallback(
    (modalProps: GridInlineModalProps<JellyfinItem>) => {
      const { rowSize, modalIndex } = modalProps;
      const allItems = flatMap(
        jellyfinItemsQuery.data?.pages,
        (page) => page.Items,
      );
      // This Modal is for last row items because they can't be inserted using the above inline modal
      // Check how many items are in the last row
      const remainingItems =
        allItems.length % rowSize === 0 ? rowSize : allItems.length % rowSize;

      const open = extractLastIndexes(allItems, remainingItems).includes(
        modalIndex,
      );

      console.log(
        open,
        extractLastIndexes(allItems, remainingItems),
        modalIndex,
      );

      return (
        <InlineModal
          {...modalProps}
          extractItemId={(item) => item.Id}
          sourceType="jellyfin"
          open={open}
          getItemType={(item) => item.Type}
          getChildItemType={childJellyfinType}
        />
      );
    },
    [jellyfinItemsQuery.data],
  );

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={(_, value: number) => setTabValue(value)}
          aria-label="Plex media selector tabs"
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab
            value={TabValues.Library}
            label="Library"
            // {...a11yProps(0)}
          />
          {/* {!isUndefined(collectionsData) &&
                sumBy(collectionsData.pages, (page) => page.size) > 0 && (
                  <Tab
                    value={TabValues.Collections}
                    label="Collections"
                    {...a11yProps(1)}
                  />
                )}
              {!isUndefined(playlistData) &&
                sumBy(playlistData.pages, 'size') > 0 && (
                  <Tab
                    value={TabValues.Playlists}
                    label="Playlists"
                    {...a11yProps(1)}
                  />
                )} */}
        </Tabs>
      </Box>
      <MediaItemGrid
        getPageDataSize={(page) => ({
          total: page.TotalRecordCount,
          size: page.Items.length,
        })}
        extractItems={(page) => page.Items}
        getItemKey={(item) => item.Id}
        renderGridItem={renderGridItem}
        renderListItem={(item) => <div key={item.Id} />}
        // renderFinalRow={renderFinalRowInlineModal}
        infiniteQuery={jellyfinItemsQuery}
      />
    </>
  );
}
