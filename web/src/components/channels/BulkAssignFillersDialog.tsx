import { Plural, Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Slider,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FillerList } from '@tunarr/types';
import { isEmpty } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import {
  bulkAssignFillersMutation,
  getChannelsByNumberV2Options,
} from '../../generated/@tanstack/react-query.gen.ts';
import { useFillerLists } from '../../hooks/useFillerLists.ts';

type FillerSelection = {
  weight: number;
  cooldownSeconds: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  selectedChannelIds: string[];
};

export function BulkAssignFillersDialog({
  open,
  onClose,
  selectedChannelIds,
}: Props) {
  const { t } = useLingui();
  const { data: fillerLists } = useFillerLists();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const [selectedFillers, setSelectedFillers] = useState<
    Record<string, FillerSelection>
  >({});
  const [replaceMode, setReplaceMode] = useState(false);

  const mutation = useMutation({
    ...bulkAssignFillersMutation(),
    onSuccess: (data) => {
      snackbar.enqueueSnackbar({
        message: (
          <Trans>
            Added {data.added}{' '}
            <Plural value={data.added} one="assignment" other="assignments" />,{' '}
            {data.alreadyExisted} already existed.
          </Trans>
        ),
        variant: 'success',
      });
      for (const channelId of selectedChannelIds) {
        queryClient
          .invalidateQueries({
            queryKey: getChannelsByNumberV2Options({ path: { id: channelId } })
              .queryKey,
          })
          .catch(console.error);
      }
      handleClose();
    },
    onError: (e) => {
      snackbar.enqueueSnackbar({
        message: t`Error assigning fillers: ${e.message}`,
        variant: 'error',
      });
    },
  });

  const handleClose = useCallback(() => {
    setSelectedFillers({});
    setReplaceMode(false);
    onClose();
  }, [onClose]);

  const toggleFiller = (filler: FillerList) => {
    setSelectedFillers((prev) => {
      if (prev[filler.id] !== undefined) {
        const next = { ...prev };
        delete next[filler.id];
        return next;
      }
      return { ...prev, [filler.id]: { weight: 1, cooldownSeconds: 0 } };
    });
  };

  const updateFillerWeight = (fillerId: string, weight: number) => {
    setSelectedFillers((prev) => ({
      ...prev,
      [fillerId]: { ...prev[fillerId], weight },
    }));
  };

  const updateFillerCooldown = (fillerId: string, cooldownSeconds: number) => {
    setSelectedFillers((prev) => ({
      ...prev,
      [fillerId]: { ...prev[fillerId], cooldownSeconds },
    }));
  };

  const handleApply = () => {
    const fillers = Object.entries(selectedFillers).map(
      ([fillerShowId, config]) => ({
        fillerShowId,
        weight: config.weight,
        cooldownSeconds: config.cooldownSeconds,
      }),
    );

    mutation.mutate({
      body: {
        channelIds: selectedChannelIds,
        fillers,
        mode: replaceMode ? 'replace' : 'add',
      },
    });
  };

  const selectedIds = Object.keys(selectedFillers);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Trans>
          Assign Fillers to{' '}
          <Plural
            value={selectedChannelIds.length}
            one="# Channel"
            other="# Channels"
          />
        </Trans>
      </DialogTitle>
      <DialogContent>
        {isEmpty(fillerLists) ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            <Trans>No filler lists found. Create a filler list first.</Trans>
          </Typography>
        ) : (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={replaceMode}
                  onChange={(_, checked) => setReplaceMode(checked)}
                />
              }
              label={t`Replace all existing fillers`}
              sx={{ mb: 1 }}
            />
            <List dense>
              {fillerLists.map((filler) => {
                const isSelected = selectedFillers[filler.id] !== undefined;
                return (
                  <ListItem
                    key={filler.id}
                    disablePadding
                    sx={{ flexDirection: 'column', alignItems: 'stretch' }}
                  >
                    <ListItemButton onClick={() => toggleFiller(filler)}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          edge="start"
                          checked={isSelected}
                          tabIndex={-1}
                          disableRipple
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={filler.name}
                        secondary={
                          <Plural
                            value={filler.contentCount}
                            one="# program"
                            other="# programs"
                          />
                        }
                      />
                    </ListItemButton>
                    {isSelected && (
                      <Box sx={{ pl: 7, pr: 2, pb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          <Trans>Weight</Trans>
                        </Typography>
                        <Slider
                          value={selectedFillers[filler.id].weight}
                          onChange={(_, val) =>
                            updateFillerWeight(filler.id, val)
                          }
                          min={1}
                          max={100}
                          valueLabelDisplay="auto"
                          size="small"
                        />
                        <TextField
                          label={t`Cooldown (seconds)`}
                          type="number"
                          size="small"
                          fullWidth
                          value={selectedFillers[filler.id].cooldownSeconds}
                          onChange={(e) =>
                            updateFillerCooldown(
                              filler.id,
                              Math.max(0, parseInt(e.target.value, 10) || 0),
                            )
                          }
                          slotProps={{
                            htmlInput: { min: 0 },
                          }}
                          sx={{ mt: 1 }}
                        />
                      </Box>
                    )}
                  </ListItem>
                );
              })}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={isEmpty(selectedIds) || mutation.isPending}
        >
          <Trans>
            Apply to{' '}
            <Plural
              value={selectedChannelIds.length}
              one="# channel"
              other="# channels"
            />
          </Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
}
