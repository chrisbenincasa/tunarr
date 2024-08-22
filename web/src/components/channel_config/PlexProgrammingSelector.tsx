import { usePlexCollectionsInfinite } from '@/hooks/plex/usePlexCollections.ts';
import { usePlexPlaylistsInfinite } from '@/hooks/plex/usePlexPlaylists.ts';
import { usePlexSearchInfinite } from '@/hooks/plex/usePlexSearch.ts';
import {
  useCurrentMediaSource,
  useCurrentSourceLibrary,
} from '@/store/programmingSelector/selectors.ts';
import FilterAlt from '@mui/icons-material/FilterAlt';
import GridView from '@mui/icons-material/GridView';
import ViewList from '@mui/icons-material/ViewList';
import {
  Box,
  Collapse,
  Grow,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { PlexMedia, isPlexParentItem } from '@tunarr/types/plex';
import { chain, filter, first, isNil, isUndefined, sumBy } from 'lodash-es';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isNonEmptyString, toggle } from '../../helpers/util.ts';
import { usePlexLibraries } from '../../hooks/plex/usePlex.ts';
import { useMediaSources } from '../../hooks/settingsHooks.ts';
import useStore from '../../store/index.ts';
import { addKnownMediaForPlexServer } from '../../store/programmingSelector/actions.ts';
import { setProgrammingSelectorViewState } from '../../store/themeEditor/actions.ts';
import { ProgramSelectorViewType } from '../../types/index.ts';
import { InlineModal } from '../InlineModal.tsx';
import { TabPanel } from '../TabPanel.tsx';
import StandaloneToggleButton from '../base/StandaloneToggleButton.tsx';
import ConnectMediaSources from '../settings/ConnectMediaSources.tsx';
import {
  GridInlineModalProps,
  GridItemProps,
  MediaItemGrid,
} from './MediaItemGrid.tsx';
import { PlexFilterBuilder } from './PlexFilterBuilder.tsx';
import { PlexGridItem } from './PlexGridItem.tsx';
import { PlexSortField } from './PlexSortField.tsx';
import { PlexListItem } from './PlexListItem.tsx';
import { tag } from '@tunarr/types';
import { MediaSourceId } from '@tunarr/types/schemas';

function a11yProps(index: number) {
  return {
    id: `plex-programming-tab-${index}`,
    'aria-controls': `plex-programming-tabpanel-${index}`,
  };
}

enum TabValues {
  Library = 0,
  Collections = 1,
  Playlists = 2,
}

export default function PlexProgrammingSelector() {
  const { data: mediaSources } = useMediaSources();
  const plexServers = filter(mediaSources, { type: 'plex' });
  const selectedServer = useCurrentMediaSource('plex');
  const selectedLibrary = useCurrentSourceLibrary('plex');
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const [tabValue, setTabValue] = useState(TabValues.Library);
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });
  const [searchVisible, setSearchVisible] = useState(false);
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);

  const handleChange = (_: React.SyntheticEvent, newValue: TabValues) => {
    setTabValue(newValue);
  };

  const { data: directoryChildren } = usePlexLibraries(
    selectedServer?.id ?? tag<MediaSourceId>(''),
    selectedServer?.type === 'plex',
  );

  const setViewType = (view: ProgramSelectorViewType) => {
    setProgrammingSelectorViewState(view);
  };

  const handleFormat = (
    _event: React.MouseEvent<HTMLElement>,
    newFormats: ProgramSelectorViewType,
  ) => {
    setViewType(newFormats);
  };

  const plexCollectionsQuery = usePlexCollectionsInfinite(
    selectedServer,
    selectedLibrary,
    24,
  );

  const { isLoading: isCollectionLoading, data: collectionsData } =
    plexCollectionsQuery;

  const plexPlaylistsQuery = usePlexPlaylistsInfinite(
    selectedServer,
    selectedLibrary,
    24,
  );

  const { isLoading: isPlaylistLoading, data: playlistData } =
    plexPlaylistsQuery;

  useEffect(() => {
    // When switching between Libraries, if a collection doesn't exist switch back to 'Library' tab
    if (
      tabValue === TabValues.Playlists &&
      isUndefined(playlistData) &&
      !isPlaylistLoading
    ) {
      setTabValue(TabValues.Library);
    } else if (
      tabValue === TabValues.Collections &&
      isUndefined(collectionsData) &&
      !isCollectionLoading
    ) {
      setTabValue(TabValues.Library);
    }
  }, [
    collectionsData,
    isCollectionLoading,
    isPlaylistLoading,
    playlistData,
    selectedLibrary?.library.type,
    tabValue,
  ]);

  const { urlFilter: searchKey } = useStore(
    ({ plexSearch: plexQuery }) => plexQuery,
  );

  const plexSearchQuery = usePlexSearchInfinite(
    selectedServer,
    selectedLibrary,
    searchKey,
    24,
  );

  const { isLoading: searchLoading, data: searchData } = plexSearchQuery;

  useEffect(() => {
    if (searchData?.pages.length === 1) {
      const size = searchData.pages[0].totalSize ?? searchData.pages[0].size;
      if (scrollParams.max !== size) {
        setScrollParams(({ limit }) => ({
          limit,
          max: size,
        }));
      }
    }
  }, [searchData?.pages, scrollParams.max]);

  useEffect(() => {
    if (!isUndefined(searchData)) {
      // We probably wouldn't have made it this far if we didnt have a server, but
      // putting this here to prevent crashes
      if (selectedServer) {
        const allMedia = chain(searchData.pages)
          .reject((page) => page.size === 0)
          .map((page) => page.Metadata)
          .flatten()
          .value();
        addKnownMediaForPlexServer(selectedServer.id, allMedia);
      }
    }
  }, [scrollParams, selectedServer, searchData]);

  useEffect(() => {
    if (isNonEmptyString(selectedServer?.id) && !isUndefined(collectionsData)) {
      const allCollections = chain(collectionsData.pages)
        .reject((page) => page.size === 0)
        .map((page) => page.Metadata)
        .compact()
        .flatten()
        .value();
      addKnownMediaForPlexServer(selectedServer.id, allCollections);
    }
  }, [selectedServer?.id, collectionsData]);

  const totalItems = useMemo(() => {
    switch (tabValue) {
      case TabValues.Library:
        return first(plexSearchQuery.data?.pages)?.totalSize ?? 0;
      case TabValues.Collections:
        return first(collectionsData?.pages)?.totalSize ?? 0;
      case TabValues.Playlists:
        return first(playlistData?.pages)?.totalSize ?? 0;
    }
  }, [
    collectionsData?.pages,
    playlistData?.pages,
    plexSearchQuery.data?.pages,
    tabValue,
  ]);

  const getPlexItemKey = useCallback((item: PlexMedia) => item.guid, []);

  const renderGridItem = (
    gridItemProps: GridItemProps<PlexMedia>,
    modalProps: GridInlineModalProps<PlexMedia>,
  ) => {
    const isLast = gridItemProps.index === totalItems - 1;

    const renderModal =
      isPlexParentItem(gridItemProps.item) &&
      ((gridItemProps.index + 1) % modalProps.rowSize === 0 || isLast);

    return (
      <React.Fragment key={gridItemProps.item.guid}>
        <PlexGridItem {...gridItemProps} />
        {renderModal && (
          <InlineModal
            {...modalProps}
            extractItemId={(item) => item.guid}
            sourceType="plex"
            getItemType={(item) => item.type}
            getChildItemType={() => 'season'}
          />
        )}
      </React.Fragment>
    );
  };

  const renderPanels = () => {
    const elements: JSX.Element[] = [];
    if ((first(searchData?.pages)?.size ?? 0) > 0) {
      elements.push(
        <TabPanel index={TabValues.Library} value={tabValue} key="Library">
          <MediaItemGrid
            getPageDataSize={(page) => ({
              total: page.totalSize,
              size: page.size,
            })}
            extractItems={(page) => page.Metadata}
            getItemKey={getPlexItemKey}
            renderGridItem={renderGridItem}
            renderListItem={(item) => (
              <PlexListItem key={item.guid} item={item} />
            )}
            infiniteQuery={plexSearchQuery}
          />
        </TabPanel>,
      );
    }

    if (
      // tabValue === TabValues.Collections &&
      (first(collectionsData?.pages)?.size ?? 0) > 0
    ) {
      elements.push(
        <TabPanel
          index={TabValues.Collections}
          value={tabValue}
          key="Collections"
        >
          <MediaItemGrid
            getPageDataSize={(page) => ({
              total: page.totalSize,
              size: page.size,
            })}
            extractItems={(page) => page.Metadata ?? []}
            getItemKey={getPlexItemKey}
            renderGridItem={renderGridItem}
            renderListItem={(item) => (
              <PlexListItem key={item.guid} item={item} />
            )}
            infiniteQuery={plexCollectionsQuery}
          />
        </TabPanel>,
      );

      if (
        // tabValue === TabValues.Collections &&
        (first(playlistData?.pages)?.size ?? 0) > 0
      ) {
        elements.push(
          <TabPanel
            index={TabValues.Playlists}
            value={tabValue}
            key="Playlists"
          >
            <MediaItemGrid
              getPageDataSize={(page) => ({
                total: page.totalSize,
                size: page.size,
              })}
              extractItems={(page) => page.Metadata ?? []}
              getItemKey={getPlexItemKey}
              renderGridItem={renderGridItem}
              renderListItem={(item) => (
                <PlexListItem key={item.guid} item={item} />
              )}
              infiniteQuery={plexPlaylistsQuery}
            />
          </TabPanel>,
        );
      }
    }

    return elements;
  };

  return (
    <>
      {!isNil(directoryChildren) &&
        directoryChildren.size > 0 &&
        selectedLibrary && (
          <Box sx={{ mt: 1 }}>
            <Stack direction="row" gap={1} sx={{ mt: 2 }}>
              <StandaloneToggleButton
                selected={searchVisible}
                onToggle={() => setSearchVisible(toggle)}
                toggleButtonProps={{
                  size: 'small',
                  sx: { mr: 1 },
                  color: 'primary',
                }}
              >
                <FilterAlt />
              </StandaloneToggleButton>
              {searchVisible && (
                <Grow in={searchVisible}>
                  <ToggleButtonGroup
                    size="small"
                    color="primary"
                    exclusive
                    value={useAdvancedSearch ? 'advanced' : 'basic'}
                    onChange={() => setUseAdvancedSearch(toggle)}
                  >
                    <ToggleButton value="basic">Basic</ToggleButton>
                    <ToggleButton value="advanced">Advanced</ToggleButton>
                  </ToggleButtonGroup>
                </Grow>
              )}

              <PlexSortField />
            </Stack>
            <Collapse in={searchVisible} mountOnEnter>
              <Box sx={{ py: 1 }}>
                <PlexFilterBuilder advanced={useAdvancedSearch} />
              </Box>
            </Collapse>

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
              <ToggleButtonGroup
                value={viewType}
                onChange={handleFormat}
                exclusive
              >
                <ToggleButton value="list">
                  <ViewList />
                </ToggleButton>
                <ToggleButton value="grid">
                  <GridView />
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Box>
        )}
      {plexServers?.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            m: 4,
          }}
        >
          <ConnectMediaSources />
        </Box>
      ) : (
        <>
          <LinearProgress
            sx={{
              visibility: searchLoading ? 'visible' : 'hidden',
              height: 10,
              marginTop: 1,
            }}
          />
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={tabValue}
              onChange={handleChange}
              aria-label="Plex media selector tabs"
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab
                value={TabValues.Library}
                label="Library"
                {...a11yProps(TabValues.Library)}
              />
              {sumBy(collectionsData?.pages, (page) => page.size) > 0 && (
                <Tab
                  value={TabValues.Collections}
                  label="Collections"
                  {...a11yProps(TabValues.Collections)}
                />
              )}
              {sumBy(playlistData?.pages, 'size') > 0 && (
                <Tab
                  value={TabValues.Playlists}
                  label="Playlists"
                  {...a11yProps(TabValues.Playlists)}
                />
              )}
            </Tabs>
          </Box>
          {renderPanels()}
        </>
      )}
    </>
  );
}
