import { useInfiniteJellyfinLibraryItems } from '@/hooks/jellyfin/useJellyfinApi';
import { useMediaSources } from '@/hooks/settingsHooks';
import {
  useCurrentMediaSource,
  useCurrentSourceLibrary,
} from '@/store/programmingSelector/selectors';
import { filter } from 'lodash-es';
import { useRef, useState } from 'react';
import { MediaItemGrid } from './MediaItemGrid.tsx';
import { Box, Tab, Tabs } from '@mui/material';
import { JellyfinGridItem } from './JellyfinGridItem.tsx';
import { tag } from '@tunarr/types';
import { MediaSourceId } from '@tunarr/types/schemas';
import { JellyfinItemKind } from '@tunarr/types/jellyfin';

enum TabValues {
  Library = 0,
}

type RefMap = {
  [k: string]: HTMLDivElement | null;
};

export function JellyfinProgrammingSelector() {
  const { data: mediaSources } = useMediaSources();
  const jellyfinServers = filter(mediaSources, { type: 'jellyfin' });
  const selectedServer = useCurrentMediaSource('jellyfin');
  const selectedLibrary = useCurrentSourceLibrary('jellyfin');
  const gridImageRefs = useRef<RefMap>({});

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
    { offset: 0, limit: 10 },
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
        renderGridItem={(props) => <JellyfinGridItem {...props} />}
        renderListItem={(item) => <div key={item.Id} />}
        infiniteQuery={jellyfinItemsQuery}
      />
    </>
  );
}
