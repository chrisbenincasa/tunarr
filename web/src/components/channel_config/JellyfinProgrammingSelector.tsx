import { jellyfinChildType } from '@/helpers/jellyfinUtil.ts';
import { forJellyfinItem, typedProperty } from '@/helpers/util.ts';
import { useInfiniteJellyfinLibraryItems } from '@/hooks/jellyfin/useJellyfinApi';
import useStore from '@/store/index.ts';
import {
  useCurrentMediaSource,
  useCurrentSourceLibrary,
} from '@/store/programmingSelector/selectors';
import { Album, Folder, Home, Mic, Tv } from '@mui/icons-material';
import { Box, Breadcrumbs, Link, Stack, Tab, Tabs } from '@mui/material';
import { tag } from '@tunarr/types';
import {
  JellyfinItem,
  JellyfinItemKind,
  JellyfinItemSortBy,
} from '@tunarr/types/jellyfin';
import { MediaSourceId } from '@tunarr/types/schemas';
import { usePrevious } from '@uidotdev/usehooks';
import { first, isEmpty, last, map, slice } from 'lodash-es';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { match } from 'ts-pattern';
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
  const prevSelectedLibrary = usePrevious(selectedLibrary?.library?.Id);
  const [alphanumericFilter, setAlphanumericFilter] = useState<string | null>(
    null,
  );
  const [parentContext, setParentContext] = useState<JellyfinItem[]>([]);
  const [tabValue, setTabValue] = useState(TabValues.Library);
  const isListView = useStore(
    (s) => s.theme.programmingSelectorView === 'list',
  );

  const itemTypes: JellyfinItemKind[] = useMemo(() => {
    if (!isEmpty(parentContext)) {
      return jellyfinChildType(last(parentContext)!) ?? [];
    } else if (selectedLibrary?.library.CollectionType) {
      switch (selectedLibrary.library.CollectionType) {
        case 'movies':
          return ['Movie'];
        case 'tvshows':
          return ['Series'];
        case 'music':
          return ['MusicArtist'];
        default:
          return [];
      }
    }

    return [];
  }, [parentContext, selectedLibrary?.library.CollectionType]);

  const sortBy: [JellyfinItemSortBy, ...JellyfinItemSortBy[]] | null =
    useMemo(() => {
      return match(selectedLibrary?.library.CollectionType)
        .returnType<[JellyfinItemSortBy, ...JellyfinItemSortBy[]] | null>()
        .with('homevideos', () => ['IsFolder', 'SortName'])
        .otherwise(() => null);
    }, [selectedLibrary?.library.CollectionType]);

  const jellyfinItemsQuery = useInfiniteJellyfinLibraryItems(
    selectedServer?.id ?? tag<MediaSourceId>(''),
    isEmpty(parentContext)
      ? selectedLibrary?.library.Id ?? ''
      : last(parentContext)!.Id,
    itemTypes,
    true,
    64,
    {
      nameLessThan: alphanumericFilter === '#' ? 'A' : undefined,
      nameStartsWith:
        alphanumericFilter !== null && alphanumericFilter !== '#'
          ? alphanumericFilter.toUpperCase()
          : undefined,
      sortBy,
    },
  );

  useEffect(() => {
    if (selectedLibrary?.library.Id !== prevSelectedLibrary) {
      clearParentContext();
    }
  }, [prevSelectedLibrary, selectedLibrary]);

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

  const pushParentContext = useCallback((item: JellyfinItem) => {
    setParentContext((prev) => [...prev, item]);
  }, []);

  const clearParentContext = () => {
    setParentContext([]);
  };

  const popParentContextToIndex = (idx: number) => {
    setParentContext((prev) => slice(prev, 0, idx + 1));
  };

  const renderContextBreadcrumbs = () => {
    const contextLinks = map(parentContext, (item, idx) => {
      const isLast = idx === parentContext.length - 1;
      const icon = match(item.Type)
        .with('Series', () => <Tv sx={{ mr: 0.5 }} fontSize="inherit" />)
        .with('MusicArtist', () => <Mic sx={{ mr: 0.5 }} fontSize="inherit" />)
        .with('MusicAlbum', () => <Album sx={{ mr: 0.5 }} fontSize="inherit" />)
        .with('Folder', () => <Folder sx={{ mr: 0.5 }} fontSize="inherit" />)
        .otherwise(() => null);
      return (
        <Link
          underline={isLast ? 'none' : 'hover'}
          color={isLast ? 'text.primary' : 'inherit'}
          sx={{
            cursor: isLast ? undefined : 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          key={item.Id}
          onClick={() => (isLast ? () => {} : popParentContextToIndex(idx))}
        >
          {icon}
          {item.Name}
        </Link>
      );
    });
    return (
      <Breadcrumbs maxItems={4}>
        <Link
          underline="hover"
          sx={{
            cursor: isEmpty(parentContext) ? undefined : 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          color={isEmpty(parentContext) ? 'text.primary' : 'inherit'}
          onClick={clearParentContext}
        >
          <Home sx={{ mr: 0.5 }} fontSize="inherit" />
          Root
        </Link>
        {contextLinks}
      </Breadcrumbs>
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
        {isListView && renderContextBreadcrumbs()}
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
        renderListItem={({ item, index, style }) => (
          <JellyfinListItem
            key={item.Id}
            item={item}
            index={index}
            style={style}
            onPushParent={pushParentContext}
          />
        )}
        infiniteQuery={jellyfinItemsQuery}
        handleAlphaNumFilter={setAlphanumericFilter}
      />
    </>
  );
}
