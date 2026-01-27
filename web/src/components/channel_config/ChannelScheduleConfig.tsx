import { Refresh } from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormHelperText,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import {
  getSchedulesOptions,
  regenerateInfiniteScheduleMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { useChannelFormContext } from '../../hooks/useChannelFormContext.ts';
import { useState } from 'react';

type ResetMode = 'full' | 'buffer';

export const ChannelScheduleConfig = () => {
  const schedulesQuery = useSuspenseQuery({
    ...getSchedulesOptions(),
  });
  const { control, watch } = useChannelFormContext();

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [pendingResetMode, setPendingResetMode] = useState<ResetMode | null>(
    null,
  );

  const regenerateMut = useMutation({
    ...regenerateInfiniteScheduleMutation(),
    onSettled: () => setResetDialogOpen(false),
  });

  const channelId = watch('id');
  const scheduleId = watch('scheduleId');

  const handleResetClick = (mode: ResetMode) => {
    setPendingResetMode(mode);
    setResetDialogOpen(true);
  };

  const handleConfirmReset = () => {
    if (!channelId || !pendingResetMode) return;
    regenerateMut.mutate({
      path: { id: channelId },
      body: { resetMode: pendingResetMode },
    });
  };

  const resetModeLabel =
    pendingResetMode === 'full'
      ? 'Full Reset'
      : pendingResetMode === 'buffer'
        ? 'Buffer Reset'
        : '';

  const resetModeDescription =
    pendingResetMode === 'full'
      ? 'This will delete all generated schedule items and reset all playback state. The schedule will restart from the beginning.'
      : 'This will delete all generated schedule items but preserve playback position. The schedule will refill the buffer from where it left off.';

  return (
    <Box>
      <FormControl fullWidth>
        <Controller
          control={control}
          name="scheduleId"
          render={({ field }) => (
            <Autocomplete
              fullWidth
              disabled={schedulesQuery.data.length === 0}
              options={schedulesQuery.data}
              getOptionKey={(schedule) => schedule.uuid}
              getOptionLabel={(list) => list.name}
              value={
                schedulesQuery.data.find(
                  (schedule) => schedule.uuid === field.value,
                ) ?? null
              }
              renderInput={(params) => (
                <TextField {...params} label="Schedule" />
              )}
              onChange={(_, schedule) => field.onChange(schedule?.uuid)}
              sx={{ flex: 1 }}
            />
          )}
        />

        <FormHelperText>Assign a schedule to</FormHelperText>
      </FormControl>

      {scheduleId && (
        <Stack direction="row" gap={1} sx={{ mt: 1 }}>
          <Tooltip title="Delete all generated items and reset playback state completely">
            <Button
              variant="outlined"
              color="warning"
              size="small"
              startIcon={<Refresh />}
              onClick={() => handleResetClick('full')}
              disabled={regenerateMut.isPending}
            >
              Full Reset
            </Button>
          </Tooltip>
          <Tooltip title="Delete generated items but keep playback position">
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={() => handleResetClick('buffer')}
              disabled={regenerateMut.isPending}
            >
              Buffer Reset
            </Button>
          </Tooltip>
        </Stack>
      )}

      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
        <DialogTitle>{resetModeLabel}</DialogTitle>
        <DialogContent>
          <DialogContentText>{resetModeDescription}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmReset}
            color="warning"
            variant="contained"
            disabled={regenerateMut.isPending}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
