import { Plural, Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  Button,
  Checkbox,
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isEmpty } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import {
  bulkAssignFillersMutation,
  getChannelsByNumberV2Options,
} from '../../generated/@tanstack/react-query.gen.ts';
import { useChannelsSuspense } from '../../hooks/useChannels.ts';

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
  const { data: channels } = useChannelsSuspense();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(
    new Set(),
  );
  const [weight, setWeight] = useState(1);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

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
        message: t`Error assigning filler: ${e.message}`,
        variant: 'error',
      });
    },
  });

  const handleClose = useCallback(() => {
    setSelectedChannelIds(new Set());
    setWeight(1);
    setCooldownSeconds(0);
    onClose();
  }, [onClose]);

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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Trans>Assign "{fillerName}" to Channels</Trans>
      </DialogTitle>
      <DialogContent>
        {isEmpty(channels) ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            <Trans>No channels found. Create a channel first.</Trans>
          </Typography>
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                <Trans>Weight</Trans>
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
                label={t`Cooldown (seconds)`}
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
        <Button onClick={handleClose}>
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
