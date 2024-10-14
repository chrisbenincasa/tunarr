import { forJellyfinItem, typedProperty } from '@/helpers/util.ts';
import { useInfiniteJellyfinLibraryItems } from '@/hooks/jellyfin/useJellyfinApi';
import {
  useCurrentMediaSource,
  useCurrentSourceLibrary,
} from '@/store/programmingSelector/selectors';
import { Box, Stack, Tab, Tabs } from '@mui/material';
import { tag } from '@tunarr/types';
import { JellyfinItem, JellyfinItemKind } from '@tunarr/types/jellyfin';
import { MediaSourceId } from '@tunarr/types/schemas';
import { first } from 'lodash-es';
import React, { useCallback, useMemo, useState } from 'react';
import { InlineModal } from '../InlineModal.tsx';
import { ProgramViewToggleButton } from '../base/ProgramViewToggleButton.tsx';
import { JellyfinGridItem } from './JellyfinGridItem.tsx';
import { JellyfinListItem } from './JellyfinListItem.tsx';
import {
  GridInlineModalProps,
  GridItemProps,
  MediaItemGrid,
} from './MediaItemGrid.tsx';

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
  const [alphanumericFilter, setAlphanumericFilter] = useState<string | null>(
    null,
  );

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
    64,
    {
      nameLessThan: alphanumericFilter === '#' ? 'A' : undefined,
      nameStartsWith:
        alphanumericFilter !== null && alphanumericFilter !== '#'
          ? alphanumericFilter.toUpperCase()
          : undefined,
    },
  );

  const totalItems = useMemo(() => {
    return first(jellyfinItemsQuery.data?.pages)?.TotalRecordCount ?? 0;
  }, [jellyfinItemsQuery.data]);

  const renderGridItem = (
    gridItemProps: GridItemProps<JellyfinItem>,
    modalProps: GridInlineModalProps<JellyfinItem>,
  ) => {
    const isLast = gridItemProps.index === totalItems - 1;

    const renderModal =
      isParentItem(gridItemProps.item) &&
      ((gridItemProps.index + 1) % modalProps.rowSize === 0 || isLast);

    return (
      <React.Fragment key={gridItemProps.item.Id}>
        <JellyfinGridItem {...gridItemProps} />
        {renderModal && (
          <InlineModal
            {...modalProps}
            extractItemId={typedProperty('Id')}
            sourceType="jellyfin"
            getItemType={typedProperty('Type')}
            getChildItemType={childJellyfinType}
          />
        )}
      </React.Fragment>
    );
  };

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{
            display: 'flex',
            pt: 1,
            columnGap: 1,
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            flexGrow: 1,
          }}
        >
          <ProgramViewToggleButton />
        </Stack>
        <Tabs
          value={tabValue}
          onChange={(_, value: number) => setTabValue(value)}
          aria-label="Jellyfin media selector tabs"
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
        getItemKey={useCallback((item: JellyfinItem) => item.Id, [])}
        renderGridItem={renderGridItem}
        renderListItem={(item, index) => (
          <JellyfinListItem key={item.Id} item={item} index={index} />
        )}
        infiniteQuery={jellyfinItemsQuery}
        handleAlphaNumFilter={setAlphanumericFilter}
      />
    </>
  );
}
