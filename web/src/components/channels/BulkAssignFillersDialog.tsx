import { Plural, Trans, useLingui } from '@lingui/react/macro';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
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
import { useQuery } from '@tanstack/react-query';
import type { FillerList } from '@tunarr/types';
import { isEmpty } from 'lodash-es';
import { useState } from 'react';
import { useMap } from 'usehooks-ts';
import {
  DefaultBulkFillerCooldownSeconds,
  DefaultBulkFillerWeight,
  useBulkAssignFillers,
} from '../../hooks/useBulkAssignFillers.tsx';
import { fillerListsQuery } from '../../hooks/useFillerLists.ts';

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
  const {
    data: fillerLists,
    isPending,
    isError,
    refetch,
  } = useQuery(fillerListsQuery());
  const [selectedFillers, fillerActions] = useMap<string, FillerSelection>();
  const [replaceMode, setReplaceMode] = useState(false);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const mutation = useBulkAssignFillers(onClose);

  const toggleFiller = (filler: FillerList) => {
    if (selectedFillers.has(filler.id)) {
      fillerActions.remove(filler.id);
    } else {
      fillerActions.set(filler.id, {
        weight: DefaultBulkFillerWeight,
        cooldownSeconds: DefaultBulkFillerCooldownSeconds,
      });
    }
  };

  const updateFiller = (fillerId: string, change: Partial<FillerSelection>) => {
    const current = selectedFillers.get(fillerId);
    if (current) {
      fillerActions.set(fillerId, { ...current, ...change });
    }
  };

  const submit = () => {
    setConfirmingReplace(false);
    const fillers = [...selectedFillers.entries()].map(
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

  const handleApply = () => {
    if (replaceMode) {
      setConfirmingReplace(true);
    } else {
      submit();
    }
  };

  const renderContent = () => {
    if (isPending) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      );
    }

    if (isError) {
      return (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                refetch().catch(console.error);
              }}
            >
              <Trans>Retry</Trans>
            </Button>
          }
        >
          <Trans>Failed to load filler lists.</Trans>
        </Alert>
      );
    }

    if (isEmpty(fillerLists)) {
      return (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          <Trans>No filler lists found. Create a filler list first.</Trans>
        </Typography>
      );
    }

    return (
      <>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          <Trans>
            Weight is relative to the channel's other filler lists. Channels
            that already have a selected list get the new weight and cooldown.
          </Trans>
        </Typography>
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
          {(fillerLists ?? []).map((filler) => {
            const selection = selectedFillers.get(filler.id);
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
                      checked={selection !== undefined}
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
                {selection !== undefined && (
                  <Box sx={{ pl: 7, pr: 2, pb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      <Trans>Relative weight</Trans>
                    </Typography>
                    <Slider
                      value={selection.weight}
                      onChange={(_, weight) =>
                        updateFiller(filler.id, { weight })
                      }
                      min={1}
                      max={100}
                      valueLabelDisplay="auto"
                      size="small"
                    />
                    <TextField
                      label={t`Cooldown (s)`}
                      type="number"
                      size="small"
                      fullWidth
                      value={selection.cooldownSeconds}
                      onChange={(e) =>
                        updateFiller(filler.id, {
                          cooldownSeconds: Math.max(
                            0,
                            parseInt(e.target.value, 10) || 0,
                          ),
                        })
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
    );
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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
        <DialogContent>{renderContent()}</DialogContent>
        <DialogActions>
          <Button onClick={onClose}>
            <Trans>Cancel</Trans>
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={selectedFillers.size === 0 || mutation.isPending}
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
      <Dialog
        open={confirmingReplace}
        onClose={() => setConfirmingReplace(false)}
      >
        <DialogTitle>
          <Trans>Replace filler lists?</Trans>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            <Trans>
              This removes every filler list currently assigned to{' '}
              <Plural
                value={selectedChannelIds.length}
                one="# channel"
                other="# channels"
              />{' '}
              and assigns only the selected lists.
            </Trans>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingReplace(false)}>
            <Trans>Cancel</Trans>
          </Button>
          <Button variant="contained" color="error" onClick={submit}>
            <Trans>Replace</Trans>
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
