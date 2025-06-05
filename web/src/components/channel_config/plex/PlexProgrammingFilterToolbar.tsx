import { FilterAlt } from '@mui/icons-material';
import {
  Box,
  Collapse,
  Grow,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useState } from 'react';
import { useToggle } from 'usehooks-ts';
import { toggle } from '../../../helpers/util.ts';
import { setPlexFilter } from '../../../store/programmingSelector/actions.ts';
import { useCurrentMediaSourceView } from '../../../store/programmingSelector/selectors.ts';
import { PlexMediaSourceLibraryViewType } from '../../../store/programmingSelector/store.ts';
import StandaloneToggleButton from '../../base/StandaloneToggleButton.tsx';
import { PlexFilterBuilder } from './PlexFilterBuilder.tsx';
import { PlexSortField } from './PlexSortField.tsx';

export const PlexProgrammingFilterToolbar = () => {
  const selectedLibrary = useCurrentMediaSourceView('plex')!;
  const [searchVisible, toggleSearchVisible] = useToggle();
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);

  return (
    <Box
      sx={{
        py: 1,
      }}
    >
      {selectedLibrary.view.type !==
        PlexMediaSourceLibraryViewType.Playlists && (
        <>
          <Stack direction="row" gap={1} sx={{ mt: 2 }}>
            <StandaloneToggleButton
              selected={searchVisible}
              onToggle={() => {
                toggleSearchVisible();
                setPlexFilter(undefined);
              }}
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
        </>
      )}
    </Box>
  );
};
