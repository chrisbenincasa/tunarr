import {
  Alert,
  Autocomplete,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  infiniteSlotIsLinkable,
  type MaterializedScheduleSlot,
  type Schedule,
  type ScheduleSlot,
} from '@tunarr/types/api';
import { useCallback, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { v4 } from 'uuid';
import {
  getScheduleByIdQueryKey,
  updateScheduleSlotMutation,
} from '../../generated/@tanstack/react-query.gen.ts';

type Props = {
  schedule: Schedule;
};

function slotLabel(slot: ScheduleSlot, index: number): string {
  const prefix = `Slot ${index + 1}`;
  switch (slot.type) {
    case 'show':
      return `${prefix}: Show (${slot.showId.slice(0, 8)})`;
    case 'custom-show':
      return `${prefix}: Custom Show (${slot.customShowId.slice(0, 8)})`;
    case 'smart-collection':
      return `${prefix}: Collection (${slot.smartCollectionId.slice(0, 8)})`;
    default:
      return `${prefix}: ${slot.type}`;
  }
}

function iterationGroupColor(groupId: string): string {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = (hash * 31 + groupId.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export { iterationGroupColor };

export const InfiniteSlotLinkingControl = ({ schedule }: Props) => {
  const { watch, setValue } = useFormContext<MaterializedScheduleSlot>();
  const [iterationGroup, linkMode, uuid] = watch([
    'iterationGroup',
    'linkMode',
    'uuid',
  ]);

  const queryClient = useQueryClient();
  const updateSlotMut = useMutation({
    ...updateScheduleSlotMutation(),
    onSuccess: async () => {
      await queryClient.resetQueries({
        queryKey: getScheduleByIdQueryKey({ path: { id: schedule.uuid } }),
      });
    },
  });

  const linkableSlots = useMemo((): { slot: ScheduleSlot; index: number }[] => {
    return schedule.slots
      .map((s, i) => ({ slot: s, index: i }))
      .filter(
        ({ slot }) =>
          infiniteSlotIsLinkable(slot) && slot.uuid && slot.uuid !== uuid,
      );
  }, [schedule.slots, uuid]);

  const groupMemberCount = useMemo(() => {
    if (!iterationGroup) return 0;
    return schedule.slots.filter(
      (s) => infiniteSlotIsLinkable(s) && s.iterationGroup === iterationGroup,
    ).length;
  }, [schedule.slots, iterationGroup]);

  const handleLinkTo = useCallback(
    (sourceSlot: ScheduleSlot) => {
      if (!infiniteSlotIsLinkable(sourceSlot)) return;

      const groupId = sourceSlot.iterationGroup ?? v4();
      const mode = sourceSlot.linkMode ?? 'continue';

      // If source was unlinked, update it server-side to set its group
      if (!sourceSlot.iterationGroup && sourceSlot.uuid) {
        const base = {
          uuid: sourceSlot.uuid,
          slotIndex: sourceSlot.slotIndex,
          weight: sourceSlot.weight,
          cooldownMs: sourceSlot.cooldownMs,
          anchorMode: sourceSlot.anchorMode,
          anchorTime: sourceSlot.anchorTime,
          anchorDays: sourceSlot.anchorDays,
          padMs: sourceSlot.padMs,
          padToMultiple: sourceSlot.padToMultiple,
          fillerConfig: sourceSlot.fillerConfig,
          fillMode: sourceSlot.fillMode,
          fillValue: sourceSlot.fillValue,
          iterationGroup: groupId,
          linkMode: mode,
        };

        const body =
          sourceSlot.type === 'show'
            ? {
                ...base,
                type: 'show' as const,
                showId: sourceSlot.showId,
                slotConfig: sourceSlot.slotConfig,
              }
            : sourceSlot.type === 'custom-show'
              ? {
                  ...base,
                  type: 'custom-show' as const,
                  customShowId: sourceSlot.customShowId,
                  slotConfig: sourceSlot.slotConfig,
                }
              : {
                  ...base,
                  type: 'smart-collection' as const,
                  smartCollectionId: sourceSlot.smartCollectionId,
                  slotConfig: sourceSlot.slotConfig,
                };

        updateSlotMut.mutate({
          path: { id: schedule.uuid, slotId: sourceSlot.uuid },
          body,
        });
      }

      setValue('iterationGroup', groupId, { shouldDirty: true });
      setValue('linkMode', mode, { shouldDirty: true });

      // Copy content fields from source
      if (sourceSlot.type === 'show') {
        setValue('showId', sourceSlot.showId, { shouldDirty: true });
        if (sourceSlot.slotConfig) {
          setValue('slotConfig', sourceSlot.slotConfig, { shouldDirty: true });
        }
      } else if (sourceSlot.type === 'custom-show') {
        setValue('customShowId', sourceSlot.customShowId, {
          shouldDirty: true,
        });
        if (sourceSlot.slotConfig) {
          setValue('slotConfig', sourceSlot.slotConfig, { shouldDirty: true });
        }
      } else if (sourceSlot.type === 'smart-collection') {
        setValue('smartCollectionId', sourceSlot.smartCollectionId, {
          shouldDirty: true,
        });
        if (sourceSlot.slotConfig) {
          setValue('slotConfig', sourceSlot.slotConfig, { shouldDirty: true });
        }
      }
    },
    [schedule.uuid, setValue, updateSlotMut],
  );

  const handleUnlink = useCallback(() => {
    setValue('iterationGroup', undefined, { shouldDirty: true });
    setValue('linkMode', undefined, { shouldDirty: true });
  }, [setValue]);

  if (iterationGroup) {
    return (
      <Stack spacing={2}>
        <Alert
          severity="info"
          sx={{
            borderLeft: `4px solid ${iterationGroupColor(iterationGroup)}`,
          }}
        >
          <Typography variant="body2">
            Linked to iteration group ({groupMemberCount} slot
            {groupMemberCount !== 1 ? 's' : ''} in group). Content and iteration
            settings are shared.
          </Typography>
        </Alert>
        <FormControl fullWidth>
          <InputLabel>Link Mode</InputLabel>
          <Select
            label="Link Mode"
            value={linkMode ?? 'continue'}
            onChange={(e) =>
              setValue('linkMode', e.target.value as 'continue' | 'rerun', {
                shouldDirty: true,
              })
            }
          >
            <MenuItem value="continue">
              Continue — shared sequential iteration
            </MenuItem>
            <MenuItem value="rerun">
              Rerun — all group members see the same program
            </MenuItem>
          </Select>
        </FormControl>
        <Button variant="outlined" color="warning" onClick={handleUnlink}>
          Unlink from group
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Link this slot to another slot to share iteration state. Linked slots
        will play through the same content together.
      </Typography>
      <Autocomplete<{ slot: ScheduleSlot; index: number }>
        options={linkableSlots}
        getOptionLabel={({ slot, index }) => slotLabel(slot, index)}
        renderInput={(params) => (
          <TextField {...params} label="Link to existing slot" />
        )}
        onChange={(_, value) => {
          if (value) {
            handleLinkTo(value.slot);
          }
        }}
      />
    </Stack>
  );
};
