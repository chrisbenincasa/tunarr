import { Plural, Trans, useLingui } from '@lingui/react/macro';
import {
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
  const { data: fillerLists, isPending } = useQuery(fillerListsQuery());
  const [selectedFillers, setSelectedFillers] = useState<
    Record<string, FillerSelection>
  >({});
  const [replaceMode, setReplaceMode] = useState(false);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const mutation = useBulkAssignFillers(onClose);

  const toggleFiller = (filler: FillerList) => {
    setSelectedFillers((prev) => {
      if (prev[filler.id] !== undefined) {
        const next = { ...prev };
        delete next[filler.id];
        return next;
      }
      return {
        ...prev,
        [filler.id]: {
          weight: DefaultBulkFillerWeight,
          cooldownSeconds: DefaultBulkFillerCooldownSeconds,
        },
      };
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

  const submit = () => {
    setConfirmingReplace(false);
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

  const handleApply = () => {
    if (replaceMode) {
      setConfirmingReplace(true);
    } else {
      submit();
    }
  };

  const selectedIds = Object.keys(selectedFillers);

  const renderContent = () => {
    if (isPending) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
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
            const selection = selectedFillers[filler.id];
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
                      onChange={(_, val) => updateFillerWeight(filler.id, val)}
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
