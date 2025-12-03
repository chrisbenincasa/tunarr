import PaddedPaper from '@/components/base/PaddedPaper.tsx';
import Breadcrumbs from '@/components/Breadcrumbs.tsx';
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
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProgramType } from '@tunarr/types';
import type { SearchFilter, SearchRequest } from '@tunarr/types/api';
import { useSnackbar } from 'notistack';
import { useMemo, useState } from 'react';
import { LibraryProgramGrid } from '../../components/library/LibraryProgramGrid.tsx';
import { deleteApiTrashMutation } from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateQueryPrefix } from '../../helpers/queryUtil.ts';

export const TrashPage = () => {
  const [itemTypes, setItemTypes] = useState<ProgramType[]>([]);
  const snackbar = useSnackbar();
  const queryClient = useQueryClient();

  const emptyTrashMut = useMutation({
    ...deleteApiTrashMutation(),
    onSuccess: async () => {
      snackbar.enqueueSnackbar({
        message: 'Successfully emptied trash.',
        variant: 'success',
      });
      await queryClient.invalidateQueries({
        predicate: invalidateQueryPrefix(['programs', 'search']),
      });
    },
    onError: (err) => {
      console.error(err);
      snackbar.enqueueSnackbar({
        variant: 'error',
        message:
          'Encountered an error when emptying trash. Check console logs for details.',
      });
    },
  });

  const request = useMemo<SearchRequest>(() => {
    const trashedFilter = {
      type: 'value',
      fieldSpec: {
        key: 'state',
        name: '',
        op: '=',
        type: 'facted_string',
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
              type: 'facted_string',
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
        <Typography variant="h4">Trash</Typography>
        <Box display={'flex'} alignContent={'center'} sx={{ mt: 1 }}>
          Trashed items are items that were previously scanned, but not found in
          a recent scan. This could be due to missing files or a media server no
          longer returning the item from its API. These items will be unplayable
          in channels in their current state. When the trash is emptied, their
          spots in channels will be replaced with flex.
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
              <Movie sx={{ mr: 1 }} /> Movies
            </ToggleButton>
            <ToggleButton value="episode">
              {' '}
              <Tv sx={{ mr: 1 }} /> Episodes
            </ToggleButton>
            <ToggleButton value="track">
              <MusicNote sx={{ mr: 1 }} /> Tracks
            </ToggleButton>
            <ToggleButton value="other_video">
              <Videocam sx={{ mr: 1 }} /> Other Videos
            </ToggleButton>
            <ToggleButton value="music_video">
              <MusicVideo sx={{ mr: 1 }} /> Music Videos
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            disabled={emptyTrashMut.isPending}
            onClick={() => emptyTrashMut.mutate({})}
            startIcon={<Delete />}
            variant="contained"
            color="error"
          >
            Empty Trash
          </Button>
        </Stack>
        <LibraryProgramGrid searchRequest={request} />;
      </PaddedPaper>
    </Stack>
  );
};
