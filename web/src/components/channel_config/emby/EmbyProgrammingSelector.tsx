import {
  useCurrentMediaSource,
  useCurrentMediaSourceView,
} from '@/store/programmingSelector/selectors';
import { Box, Tab, Tabs } from '@mui/material';

import { useState } from 'react';
import { Emby } from '../../../helpers/constants.ts';

import SelectedProgrammingActions from '../SelectedProgrammingActions.tsx';
import { EmbyProgramGrid } from './EmbyProgramGrid.tsx';

enum TabValues {
  Library = 0,
}

type Props = {
  toggleOrSetSelectedProgramsDrawer: (open: boolean) => void;
};

export function EmbyProgrammingSelector({
  toggleOrSetSelectedProgramsDrawer,
}: Props) {
  const selectedServer = useCurrentMediaSource(Emby);
  const selectedLibrary = useCurrentMediaSourceView(Emby);
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
          aria-label="Emby media selector tabs"
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab value={TabValues.Library} label="Library" />
        </Tabs>
        <EmbyProgramGrid
          alphanumericFilter={null}
          parentContext={[]}
          selectedLibrary={selectedLibrary!}
          selectedServer={selectedServer!}
        />
      </Box>
    </>
  );
}
