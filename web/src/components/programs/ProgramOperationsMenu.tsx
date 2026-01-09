import { Refresh } from '@mui/icons-material';
import type { PopoverProps } from '@mui/material';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProgramLike } from '@tunarr/types';
import { isEqual } from 'lodash-es';
import { useCallback } from 'react';
import {
  getApiProgramGroupingsByIdQueryKey,
  getApiProgramsByIdOptions,
  postApiMoviesByIdScanMutation,
  postApiShowsByIdScanMutation,
} from '../../generated/@tanstack/react-query.gen.ts';

type Props = {
  programId: string;
  programType: ProgramLike['type'];
  anchorEl: PopoverProps['anchorEl'];
  open: boolean;
  onClose: () => void;
};

export const ProgramOperationsMenu = ({
  programId,
  programType,
  anchorEl,
  open,
  onClose,
}: Props) => {
  const queryClient = useQueryClient();
  const clearQueryCache = useCallback(() => {
    return queryClient.invalidateQueries({
      predicate: (key) => {
        return (
          isEqual(
            key,
            getApiProgramGroupingsByIdQueryKey({ path: { id: programId } }),
          ) ||
          isEqual(key, getApiProgramsByIdOptions({ path: { id: programId } }))
        );
      },
    });
  }, [programId, queryClient]);

  const showScanMut = useMutation({
    ...postApiShowsByIdScanMutation(),
    onSuccess: () => {
      return clearQueryCache();
    },
  });

  const movieScanMut = useMutation({
    ...postApiMoviesByIdScanMutation(),
    onSuccess: () => {
      return clearQueryCache();
    },
  });

  const scanItem = useCallback(() => {
    switch (programType) {
      case 'movie': {
        movieScanMut.mutate({ path: { id: programId } }, {});
        break;
      }
      case 'show': {
        showScanMut.mutate({
          path: { id: programId },
        });
        break;
      }
      case 'season':
      case 'episode':
      case 'album':
      case 'artist':
      case 'track':
      case 'music_video':
      case 'other_video':
        break;
    }

    onClose();
  }, [movieScanMut, onClose, programId, programType, showScanMut]);

  return (
    <Menu anchorEl={anchorEl} open={open} onClose={() => onClose()}>
      <MenuItem onClick={() => scanItem()}>
        <ListItemIcon>
          <Refresh fontSize="small" />
        </ListItemIcon>
        <ListItemText>Scan</ListItemText>
      </MenuItem>
    </Menu>
  );
};
