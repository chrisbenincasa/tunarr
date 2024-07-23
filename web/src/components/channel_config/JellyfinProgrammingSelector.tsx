import { useJellyfinLibraryItems } from '@/hooks/jellyfin/useJellyfinApi';
import { useMediaSources } from '@/hooks/settingsHooks';
import {
  useCurrentMediaSource,
  useCurrentSourceLibrary,
} from '@/store/programmingSelector/selectors';
import { filter } from 'lodash-es';
import { useState } from 'react';
import { MediaSourceProgrammingSelector } from './MediaSourceProgrammingSelector';

enum TabValues {
  Library = 0,
}

export function JellyfinProgrammingSelector() {
  const { data: mediaSources } = useMediaSources();
  const jellyfinServers = filter(mediaSources, { type: 'jellyfin' });
  const selectedServer = useCurrentMediaSource('jellyfin');
  const selectedLibrary = useCurrentSourceLibrary('jellyfin');

  const [tabValue, setTabValue] = useState(TabValues.Library);

  console.log(selectedServer, selectedLibrary);

  const {
    data: libraryItems,
    isLoading: libraryItemsLoading,
    queryKey,
  } = useJellyfinLibraryItems(
    selectedServer?.id ?? '',
    selectedLibrary?.library.Id ?? '',
    { offset: 0, limit: 10 },
  );

  const fetchNextPageForTab = (tab: number) => {
    console.log('tab');
  };

  return (
    <>
      <MediaSourceProgrammingSelector
        mediaSourceType="jellyfin"
        tabs={[0]}
        queryKeyForTab={{ 0: queryKey }}
        defaultTab={0}
        fetchNextPageOnTab={fetchNextPageForTab}
      />
    </>
  );
}
