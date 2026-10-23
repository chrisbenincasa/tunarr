import { Plural, Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { isEmpty } from 'lodash-es';
import { useState } from 'react';
import { getChannelsOptions } from '../../generated/@tanstack/react-query.gen.ts';
import {
  DefaultBulkFillerCooldownSeconds,
  DefaultBulkFillerWeight,
  useBulkAssignFillers,
} from '../../hooks/useBulkAssignFillers.tsx';

type Props = {
  open: boolean;
  onClose: () => void;
  fillerId: string;
  fillerName: string;
};

export function AssignFillerToChannelsDialog({
  open,
  onClose,
  fillerId,
  fillerName,
}: Props) {
  const { t } = useLingui();
  const { data, isPending } = useQuery(getChannelsOptions());
  const channels = data ?? [];
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(
    new Set(),
  );
  const [weight, setWeight] = useState(DefaultBulkFillerWeight);
  const [cooldownSeconds, setCooldownSeconds] = useState(
    DefaultBulkFillerCooldownSeconds,
  );
  const mutation = useBulkAssignFillers(onClose);

  const toggleChannel = (channelId: string) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedChannelIds.size === channels.length) {
      setSelectedChannelIds(new Set());
    } else {
      setSelectedChannelIds(new Set(channels.map((c) => c.id)));
    }
  };

  const handleApply = () => {
    mutation.mutate({
      body: {
        channelIds: [...selectedChannelIds],
        fillers: [{ fillerShowId: fillerId, weight, cooldownSeconds }],
        mode: 'add',
      },
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Trans>Assign "{fillerName}" to Channels</Trans>
      </DialogTitle>
      <DialogContent>
        {isPending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : isEmpty(channels) ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            <Trans>No channels found. Create a channel first.</Trans>
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <Trans>
                Weight is relative to the channel's other filler lists. Channels
                that already have this list get the new weight and cooldown.
              </Trans>
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                <Trans>Relative weight</Trans>
              </Typography>
              <Slider
                value={weight}
                onChange={(_, val) => setWeight(val)}
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
                value={cooldownSeconds}
                onChange={(e) =>
                  setCooldownSeconds(
                    Math.max(0, parseInt(e.target.value, 10) || 0),
                  )
                }
                slotProps={{
                  htmlInput: { min: 0 },
                }}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1,
              }}
            >
              <Typography variant="subtitle2">
                <Trans>Channels</Trans>
              </Typography>
              <Button size="small" onClick={toggleAll}>
                {selectedChannelIds.size === channels.length ? (
                  <Trans>Deselect All</Trans>
                ) : (
                  <Trans>Select All</Trans>
                )}
              </Button>
            </Box>
            <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
              {channels.map((channel) => (
                <ListItem key={channel.id} disablePadding>
                  <ListItemButton onClick={() => toggleChannel(channel.id)}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox
                        edge="start"
                        checked={selectedChannelIds.has(channel.id)}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${channel.number}. ${channel.name}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={selectedChannelIds.size === 0 || mutation.isPending}
        >
          <Trans>
            Apply to{' '}
            <Plural
              value={selectedChannelIds.size}
              one="# channel"
              other="# channels"
            />
          </Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
}
