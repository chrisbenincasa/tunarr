import { Stack } from '@mui/material';
import type { MediaSourceLibrary, MediaSourceSettings } from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/api';
import { useCallback } from 'react';
import { setSearchRequest } from '../../store/programmingSelector/actions.ts';
import SelectedProgrammingActions from '../channel_config/SelectedProgrammingActions.tsx';
import { SearchBuilder } from '../search/SearchBuilder.tsx';
import { LibraryProgramGrid } from './LibraryProgramGrid.tsx';

type Props = {
  mediaSource?: MediaSourceSettings;
  library?: MediaSourceLibrary;
  disableProgramSelection?: boolean;
  toggleOrSetSelectedProgramsDrawer?: (open: boolean) => void;
  initialSearchQuery?: string;
};

export const LibrarySearch = (props: Props) => {
  const {
    disableProgramSelection,
    toggleOrSetSelectedProgramsDrawer,
    initialSearchQuery,
  } = props;

  const handleSearchChange = useCallback((searchRequest: SearchRequest) => {
    setSearchRequest(searchRequest);
  }, []);

  return (
    <Stack gap={2}>
      <SearchBuilder
        onSearch={handleSearchChange}
        initialQuery={initialSearchQuery}
        mediaTypeFilter={
          props.mediaSource?.type === 'local'
            ? props.mediaSource.mediaType
            : props.library?.mediaType
        }
      />
      {!disableProgramSelection && toggleOrSetSelectedProgramsDrawer && (
        <SelectedProgrammingActions
          toggleOrSetSelectedProgramsDrawer={toggleOrSetSelectedProgramsDrawer}
        />
      )}
      <LibraryProgramGrid {...props} />
    </Stack>
  );
};
