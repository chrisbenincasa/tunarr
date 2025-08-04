import {
  useCurrentMediaSource,
  useCurrentMediaSourceView,
} from '@/store/programmingSelector/selectors';
import { Box, Tab, Tabs } from '@mui/material';
import { useState } from 'react';
import { Jellyfin } from '../../../helpers/constants.ts';
import { JellyfinProgramGrid } from './JellyfinProgramGrid.tsx';

import SelectedProgrammingActions from '../SelectedProgrammingActions.tsx';

enum TabValues {
  Library = 0,
}

type Props = {
  toggleOrSetSelectedProgramsDrawer: (open: boolean) => void;
};

export function JellyfinProgrammingSelector({
  toggleOrSetSelectedProgramsDrawer,
}: Props) {
  const selectedServer = useCurrentMediaSource(Jellyfin)!;
  const selectedLibrary = useCurrentMediaSourceView(Jellyfin)!;
  const [tabValue, setTabValue] = useState(TabValues.Library);

  return (
    <>
      <SelectedProgrammingActions
        toggleOrSetSelectedProgramsDrawer={toggleOrSetSelectedProgramsDrawer}
      />
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={tabValue}
          onChange={(_, value: number) => setTabValue(value)}
          aria-label="Jellyfin media selector tabs"
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab value={TabValues.Library} label="Library" />
        </Tabs>
        <JellyfinProgramGrid
          selectedLibrary={selectedLibrary}
          selectedServer={selectedServer}
        />
      </Box>
    </>
  );
}
