import {
  useCurrentMediaSource,
  useCurrentMediaSourceView,
} from '@/store/programmingSelector/selectors.ts';
import { PlexMediaSourceLibraryViewType } from '@/store/programmingSelector/store.ts';
import { Box, Tab, Tabs, Tooltip } from '@mui/material';
import type { ProgramOrFolder } from '@tunarr/types';
import { filter, isNil } from 'lodash-es';
import React, { useCallback, useRef } from 'react';
import { P, match } from 'ts-pattern';
import { useProgramHierarchy } from '../../../hooks/channel_config/useProgramHierarchy.ts';
import { usePlexLibraries } from '../../../hooks/plex/usePlex.ts';
import { useMediaSources } from '../../../hooks/settingsHooks.ts';
import useStore from '../../../store/index.ts';
import {
  clearPlexProgrammingListLibrarySubview,
  setPlexProgrammingListLibrarySubview,
} from '../../../store/programmingSelector/actions.ts';
import ConnectMediaSources from '../../settings/ConnectMediaSources.tsx';
import SelectedProgrammingActions from '../SelectedProgrammingActions.tsx';
import { PlexProgrammingFilterToolbar } from './PlexProgrammingFilterToolbar.tsx';
import { PlexProgrammingGridView } from './PlexProgrammingGridView.tsx';
import { PlexProgrammingListView } from './PlexProgrammingListView.tsx';

type Props = {
  toggleOrSetSelectedProgramsDrawer: (open: boolean) => void;
};

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

export default function PlexProgrammingSelector({
  toggleOrSetSelectedProgramsDrawer,
}: Props) {
  const { data: mediaSources } = useMediaSources();
  const plexServers = filter(mediaSources, { type: 'plex' });
  const selectedServer = useCurrentMediaSource('plex');
  const selectedLibrary = useCurrentMediaSourceView('plex');
  const subview =
    selectedLibrary?.view.type === 'library'
      ? selectedLibrary.view.subview
      : undefined;

  const tabValue = match(subview)
    .with('collections', () => TabValues.Collections)
    .with('playlists', () => TabValues.Playlists)
    .with(P.nullish, () => TabValues.Library)
    .exhaustive();

  const programHierarchyRet = useProgramHierarchy<ProgramOrFolder>(
    useCallback((pof) => pof.uuid, []),
  );

  const isListView = useStore(
    (s) => s.theme.programmingSelectorView === 'list',
  );

  const handleChange = (_: React.SyntheticEvent, newValue: TabValues) => {
    switch (newValue) {
      case TabValues.Library:
        clearPlexProgrammingListLibrarySubview();
        break;
      case TabValues.Collections:
        setPlexProgrammingListLibrarySubview('collections');
        break;
      case TabValues.Playlists:
        setPlexProgrammingListLibrarySubview('playlists');
        break;
    }
    programHierarchyRet.clearParentContext();
  };

  const itemContainer = useRef<HTMLDivElement>(null);

  const { data: directoryChildren } = usePlexLibraries(
    selectedServer?.id ?? '',
    selectedServer?.type === 'plex',
  );

  return (
    <>
      {!isNil(directoryChildren) &&
        directoryChildren.length > 0 &&
        selectedLibrary && (
          <>
            <PlexProgrammingFilterToolbar />
            <SelectedProgrammingActions
              toggleOrSetSelectedProgramsDrawer={
                toggleOrSetSelectedProgramsDrawer
              }
            />
          </>
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
          <Box ref={itemContainer}>
            <Box
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
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
                {selectedLibrary?.view.type !==
                  PlexMediaSourceLibraryViewType.Playlists && (
                  <Tab
                    value={TabValues.Collections}
                    label="Collections"
                    // disabled={
                    //   sumBy(collectionsData?.pages, (page) => page.size) ===
                    //     0 || isCollectionLoading
                    // }
                    {...a11yProps(TabValues.Collections)}
                  />
                )}
                {selectedLibrary?.view.type !==
                  PlexMediaSourceLibraryViewType.Playlists && (
                  <Tab
                    value={TabValues.Playlists}
                    label={
                      <Tooltip
                        title={
                          // sumBy(playlistData?.pages, 'size') === 0 ||
                          // isPlaylistLoading
                          //   ? 'Selected library has no playlists'
                          //   : null
                          null
                        }
                        placement="top"
                        arrow
                      >
                        <span>Playlists</span>
                      </Tooltip>
                    }
                    sx={{
                      '&.Mui-disabled': {
                        pointerEvents: 'all',
                      },
                    }}
                    // disabled={
                    //   sumBy(playlistData?.pages, 'size') === 0 ||
                    //   isPlaylistLoading
                    // }
                    {...a11yProps(TabValues.Playlists)}
                  />
                )}
              </Tabs>
            </Box>
            {isListView ? (
              <PlexProgrammingListView {...programHierarchyRet} />
            ) : (
              <PlexProgrammingGridView parentContext={[]} />
            )}
          </Box>
        </>
      )}
    </>
  );
}
