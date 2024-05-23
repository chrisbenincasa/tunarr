import { Delete, MenuOpen } from '@mui/icons-material';
import {
  Box,
  Button,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { reduce } from 'lodash-es';
import pluralize from 'pluralize';
import { useCallback } from 'react';
import useStore from '../../store/index.ts';
import { clearSelectedMedia } from '../../store/programmingSelector/actions.ts';
import { AddedMedia } from '../../types/index.ts';
import AddSelectedMediaButton from './AddSelectedMediaButton.tsx';

type Props = {
  onAddSelectedMedia: (media: AddedMedia[]) => void;
  onAddMediaSuccess: () => void;
  onSelectionModalClose: () => void;
};

export default function SelectedProgrammingActions({
  onAddSelectedMedia,
  onAddMediaSuccess,
  onSelectionModalClose,
}: Props) {
  const selectedMedia = useStore((s) => s.selectedMedia);
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));

  const totalCount = reduce(
    selectedMedia,
    (acc, media) => acc + (media.childCount ?? 1),
    0,
  );

  const removeAllItems = useCallback(() => {
    clearSelectedMedia();
  }, []);

  return (
    selectedMedia.length > 0 && (
      <Box
        sx={{
          borderRadius: '10px',
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          position: 'fixed',
          bottom: smallViewport ? '3em' : '1em',
          width: '100%',
          maxWidth: '425px',
          margin: '1em auto',
          left: 0,
          right: 0,
          display: 'flex',
          padding: '5px 0',
          justifyContent: 'space-evenly',
        }}
      >
        {smallViewport ? (
          <Button
            onClick={() => onSelectionModalClose()}
            size="large"
            startIcon={<MenuOpen />}
            sx={{
              color: theme.palette.primary.contrastText,
              border: `1px solid ${theme.palette.primary.contrastText}`,
              borderRadius: '10px',
            }}
          >
            Review {totalCount} {!smallViewport && 'Selected'}{' '}
            {pluralize('Item', totalCount)}
          </Button>
        ) : (
          <Typography sx={{ display: 'flex', alignItems: 'center' }}>
            {totalCount} Selected {pluralize('Item', totalCount)}
          </Typography>
        )}

        <Tooltip
          title={smallViewport ? 'Unselect All' : 'Unselect all programs'}
        >
          <Button
            startIcon={smallViewport ? null : <Delete />}
            sx={{
              color: theme.palette.primary.contrastText,
              border: `1px solid ${theme.palette.primary.contrastText}`,
              borderRadius: '10px',
              marginRight: '8px',
            }}
            onClick={() => removeAllItems()}
          >
            Unselect All
          </Button>
        </Tooltip>

        <AddSelectedMediaButton
          onAdd={onAddSelectedMedia}
          onSuccess={onAddMediaSuccess}
          sx={{
            color: theme.palette.primary.contrastText,
            border: `1px solid ${theme.palette.primary.contrastText}`,
            borderRadius: '10px',
          }}
        />
      </Box>
    )
  );
}
