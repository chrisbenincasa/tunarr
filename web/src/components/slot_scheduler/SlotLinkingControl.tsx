import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link as LinkIcon, LinkOff } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { uniqBy } from 'lodash-es';
import { useMemo, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { v4 } from 'uuid';
import { useSlotName } from '../../hooks/slot_scheduler/useSlotName.ts';
import type {
  CommonSlotViewModel,
  LinkMode,
  LinkableSlotViewModel,
} from '../../model/CommonSlotModels.ts';
import {
  copySlotForLinking,
  slotIsLinkable,
} from '../../model/CommonSlotModels.ts';

type SlotLinkingControlProps = {
  allSlots: CommonSlotViewModel[];
  onLinkSourceSlot?: (
    sourceSlotId: string,
    groupId: string,
    linkMode: LinkMode,
  ) => void;
};

const contentSlotTypes = new Set([
  'movie',
  'show',
  'custom-show',
  'smart-collection',
]);

export function SlotLinkingControl({
  allSlots,
  onLinkSourceSlot,
}: SlotLinkingControlProps) {
  const { t } = useLingui();
  const getSlotName = useSlotName();
  const [showPicker, setShowPicker] = useState(false);
  const { control, setValue, reset, getValues } =
    useFormContext<CommonSlotViewModel>();
  const [currentGroup, currentMode, currentSlotId] = useWatch({
    control: control,
    name: ['iterationGroup', 'linkMode', 'id'],
  });

  const linkableSlots = useMemo(
    () =>
      uniqBy(
        allSlots
          .filter(slotIsLinkable)
          .filter(
            (s) => contentSlotTypes.has(s.type) && s.id !== currentSlotId,
          ),
        (slot) => slot.iterationGroup,
      ),
    [allSlots, currentSlotId],
  );

  const groupPeers = useMemo(
    () =>
      currentGroup
        ? allSlots
            .filter(slotIsLinkable)
            .filter(
              (s) =>
                s.iterationGroup === currentGroup && s.id !== currentSlotId,
            )
        : [],
    [allSlots, currentGroup, currentSlotId],
  );

  const handleLink = (sourceSlot: LinkableSlotViewModel) => {
    const currentSlot = getValues();
    const isNewGroup = !sourceSlot.iterationGroup;
    const groupId = sourceSlot.iterationGroup ?? v4();
    const linkMode: LinkMode = sourceSlot.linkMode ?? 'continue';

    reset({
      ...currentSlot,
      ...copySlotForLinking(sourceSlot),
      iterationGroup: groupId,
      linkMode,
    } as CommonSlotViewModel);

    if (isNewGroup) {
      onLinkSourceSlot?.(sourceSlot.id, groupId, linkMode);
    }

    setShowPicker(false);
  };

  const handleUnlink = () => {
    setValue('iterationGroup', undefined, { shouldDirty: true });
    setValue('linkMode', undefined, { shouldDirty: true });
  };

  if (currentGroup) {
    return (
      <Stack spacing={2}>
        <Alert
          severity="info"
          sx={{ my: 1 }}
          action={
            <Button
              startIcon={<LinkOff />}
              onClick={handleUnlink}
              color="warning"
              size="small"
              variant="outlined"
            >
              <Trans>Unlink</Trans>
            </Button>
          }
        >
          <Trans>
            This slot is linked with {groupPeers.length} other{' '}
            <Plural value={groupPeers.length} one="slot" other="slots" />.
            Content fields are shared across the group.
          </Trans>
        </Alert>
        <FormControl fullWidth margin="normal">
          <InputLabel>{t`Link Mode`}</InputLabel>
          <Controller
            control={control}
            name="linkMode"
            render={({ field }) => (
              <Select
                label={t`Link Mode`}
                {...field}
                value={(field.value as string | undefined) ?? 'continue'}
              >
                <MenuItem value="continue">
                  <Trans>Continue</Trans>
                </MenuItem>
                <MenuItem value="rerun">
                  <Trans>Rerun</Trans>
                </MenuItem>
              </Select>
            )}
          />
          <FormHelperText>
            {currentMode === 'rerun' ? (
              <Trans>
                All linked slots show the same episode, advancing only after all
                have played.
              </Trans>
            ) : (
              <Trans>
                Linked slots advance episode progression together sequentially.
              </Trans>
            )}
          </FormHelperText>
        </FormControl>
      </Stack>
    );
  }

  if (showPicker) {
    return (
      <Stack spacing={1} sx={{ mt: 1 }}>
        <Autocomplete
          options={linkableSlots}
          getOptionLabel={(slot) => getSlotName(slot) ?? slot.type}
          onChange={(_, slot) => {
            if (slot) handleLink(slot);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t`Select a slot to link to`}
              autoFocus
            />
          )}
        />
        <Button size="small" onClick={() => setShowPicker(false)}>
          <Trans>Cancel</Trans>
        </Button>
      </Stack>
    );
  }

  return (
    <Box sx={{ mt: 1 }}>
      <Button
        startIcon={<LinkIcon />}
        onClick={() => setShowPicker(true)}
        size="small"
        variant="outlined"
        disabled={linkableSlots.length === 0}
      >
        <Trans>Link to existing slot</Trans>
      </Button>
    </Box>
  );
}
