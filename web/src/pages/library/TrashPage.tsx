import PaddedPaper from '@/components/base/PaddedPaper.tsx';
import Breadcrumbs from '@/components/Breadcrumbs.tsx';
import { Trans } from '@lingui/react/macro';
import {
  Delete,
  Movie,
  MusicNote,
  MusicVideo,
  Tv,
  Videocam,
} from '@mui/icons-material';
import {
  Box,
  Button,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { ProgramType } from '@tunarr/types';
import type { SearchFilter, SearchRequest } from '@tunarr/types/schemas';
import { useMemo, useState } from 'react';
import { LibraryProgramGrid } from '../../components/library/LibraryProgramGrid.tsx';
import { useEmptyTrash } from '../../hooks/useEmptyTrash.ts';

export const TrashPage = () => {
  const [itemTypes, setItemTypes] = useState<ProgramType[]>([]);
  const { status, isDraining, emptyTrash, isStarting, cancel, isCancelling } =
    useEmptyTrash();

  const request = useMemo<SearchRequest>(() => {
    const trashedFilter = {
      type: 'value',
      fieldSpec: {
        key: 'state',
        name: '',
        op: '=',
        type: 'faceted_string',
        value: ['missing'],
      },
    } satisfies SearchFilter;

    let filter: SearchFilter;
    if (itemTypes.length === 0) {
      filter = trashedFilter;
    } else {
      filter = {
        op: 'and',
        type: 'op',
        children: [
          trashedFilter,
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: '',
              op: 'in',
              value: itemTypes,
              type: 'faceted_string',
            },
          },
        ],
      };
    }

    return {
      filter,
    };
  }, [itemTypes]);

  return (
    <Stack spacing={2}>
      <Box>
        <Breadcrumbs />
        <Typography variant="h4">
          <Trans>Trash</Trans>
        </Typography>
        <Box display={'flex'} alignContent={'center'} sx={{ mt: 1 }}>
          <Trans>
            Trashed items are items that were previously scanned, but not found
            in a recent scan. This could be due to missing files or a media
            server no longer returning the item from its API. These items will
            be unplayable in channels in their current state. When the trash is
            emptied, their spots in channels will be replaced with flex.
          </Trans>
        </Box>
      </Box>
      <PaddedPaper>
        <Stack direction={'row'}>
          <ToggleButtonGroup
            color="primary"
            value={itemTypes}
            onChange={(_, newTypes) => setItemTypes(newTypes as ProgramType[])}
            aria-label="Platform"
            sx={{ flexGrow: 1 }}
          >
            <ToggleButton value="movie">
              <Movie sx={{ mr: 1 }} /> <Trans>Movies</Trans>
            </ToggleButton>
            <ToggleButton value="episode">
              {' '}
              <Tv sx={{ mr: 1 }} /> <Trans>Episodes</Trans>
            </ToggleButton>
            <ToggleButton value="track">
              <MusicNote sx={{ mr: 1 }} /> <Trans>Tracks</Trans>
            </ToggleButton>
            <ToggleButton value="other_video">
              <Videocam sx={{ mr: 1 }} /> <Trans>Other Videos</Trans>
            </ToggleButton>
            <ToggleButton value="music_video">
              <MusicVideo sx={{ mr: 1 }} /> <Trans>Music Videos</Trans>
            </ToggleButton>
          </ToggleButtonGroup>
          {isDraining && (
            <Button
              disabled={isCancelling}
              onClick={cancel}
              variant="outlined"
              sx={{ mr: 1 }}
            >
              <Trans>Cancel</Trans>
            </Button>
          )}
          <Button
            disabled={isStarting || isDraining}
            onClick={emptyTrash}
            startIcon={<Delete />}
            variant="contained"
            color="error"
          >
            <Trans>Empty Trash</Trans>
          </Button>
        </Stack>
        {isDraining && status && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={
                status.total > 0
                  ? Math.min(100, (status.deleted / status.total) * 100)
                  : 0
              }
            />
            <Typography variant="body2" sx={{ mt: 1 }}>
              <Trans>
                Emptying trash: {status.deleted} / {status.total}
              </Trans>
            </Typography>
          </Box>
        )}
        <LibraryProgramGrid searchRequest={request} />
      </PaddedPaper>
    </Stack>
  );
};
