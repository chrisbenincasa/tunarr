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
import { isNonEmptyString, prettifySnakeCaseString } from '@tunarr/shared/util';
import {
  compact,
  groupBy,
  mapValues,
  minBy,
  partition,
  values,
} from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { match } from 'ts-pattern';
import { v4 } from 'uuid';
import { usePolymorphicSlotFormContext } from '../../hooks/slot_scheduler/usePolymorphicSlotFormContext.ts';
import { useSlotName } from '../../hooks/slot_scheduler/useSlotName.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import type {
  CommonSlotViewModel,
  LinkMode,
  LinkableSlotViewModel,
} from '../../model/CommonSlotModels.ts';
import {
  copySlotForLinking,
  slotIsLinkable,
} from '../../model/CommonSlotModels.ts';
import type { SlotViewModel } from '../../model/SlotModels.ts';
import type { TimeSlotViewModel } from '../../model/TimeSlotModels.ts';

type SlotLinkingControlProps = {
  allSlots: CommonSlotViewModel[];
  onLinkSourceSlot?: (
    sourceSlotId: string,
    groupId: string,
    linkMode: LinkMode,
  ) => void;
  onUnlinkFromGroup?: (groupId: string) => void;
};

const useSlotIdentifier = () => {
  const dayjs = useDayjs();
  const { type, context } = usePolymorphicSlotFormContext();

  return useCallback(
    (slot: CommonSlotViewModel & LinkableSlotViewModel) => {
      if (type === 'time') {
        const values = context.getValues();
        const timeslot = slot as TimeSlotViewModel;
        const fmt = values.period === 'week' ? 'ddd LT' : 'LT';
        return dayjs()
          .startOf(values.period)
          .add(timeslot.startTime)
          .format(fmt);
      }
      return '';
    },
    [dayjs, type, context],
  );
};

function getSlotOrderingValue(slot: CommonSlotViewModel) {
  if ('startTime' in slot) {
    return (slot as TimeSlotViewModel).startTime;
  } else if ('index' in slot) {
    return (slot as SlotViewModel).index as number;
  }
  return 0;
}

function linkableSlotsAreEqual(
  left: LinkableSlotViewModel,
  right: LinkableSlotViewModel,
) {
  return match([left, right])
    .with(
      [{ type: 'custom-show' }, { type: 'custom-show' }],
      ([l, r]) => l.customShow?.name === r.customShow?.name,
    )
    .with(
      [{ type: 'show' }, { type: 'show' }],
      ([l, r]) => l.show?.title === r.show?.title,
    )
    .with(
      [{ type: 'filler' }, { type: 'filler' }],
      ([l, r]) => l.fillerList?.name === r.fillerList?.name,
    )
    .with(
      [{ type: 'smart-collection' }, { type: 'smart-collection' }],
      ([l, r]) => l.smartCollection?.name === r.smartCollection?.name,
    )
    .with([{ type: 'movie' }, { type: 'movie' }], () => true)
    .otherwise(() => false);
}

function slotHasId(slot: LinkableSlotViewModel) {
  return match(slot)
    .with({ type: 'show' }, (show) =>
      isNonEmptyString(show.show?.uuid ?? show.showId),
    )
    .with({ type: 'smart-collection' }, (sm) =>
      isNonEmptyString(sm.smartCollectionId ?? sm.smartCollection?.uuid),
    )
    .with({ type: 'custom-show' }, (cs) =>
      isNonEmptyString(cs.customShowId ?? cs.customShow?.id),
    )
    .with({ type: 'filler' }, (f) =>
      isNonEmptyString(f.fillerListId ?? f.fillerList?.id),
    )
    .with({ type: 'movie' }, () => true);
}

export function SlotLinkingControl({
  allSlots,
  onLinkSourceSlot,
  onUnlinkFromGroup,
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

  const linkableSlots = useMemo(() => {
    const allLinkable = allSlots
      .filter(slotIsLinkable)
      .filter((s) => s.id !== currentSlotId)
      .filter(slotHasId);
    // Show all unlinked slots, but only one representative per linked group (earliest)
    const [linked, unlinked] = partition(allLinkable, (slot) =>
      isNonEmptyString(slot.iterationGroup),
    );
    const groupedSlots = mapValues(
      groupBy(linked, (slot) => slot.iterationGroup),
      (slots) => minBy(slots, (slot) => getSlotOrderingValue(slot)),
    );
    return unlinked.concat(compact(values(groupedSlots)));
  }, [allSlots, currentSlotId]);

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
    if (currentGroup) {
      onUnlinkFromGroup?.(currentGroup);
    }
    setValue('iterationGroup', undefined, { shouldDirty: true });
    setValue('linkMode', undefined, { shouldDirty: true });
    setValue('rerunOverflow', undefined, { shouldDirty: true });
  };

  const getSlotIdentifier = useSlotIdentifier();

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
                This slot replays content aired by continue slots earlier in the
                period.
              </Trans>
            ) : (
              <Trans>
                Linked slots advance episode progression together sequentially.
              </Trans>
            )}
          </FormHelperText>
        </FormControl>
        {currentMode === 'rerun' && (
          <FormControl fullWidth margin="normal">
            <InputLabel>{t`Overflow Behavior`}</InputLabel>
            <Controller
              control={control}
              name="rerunOverflow"
              render={({ field }) => (
                <Select
                  label={t`Overflow Behavior`}
                  {...field}
                  value={(field.value as string | undefined) ?? 'flex'}
                >
                  <MenuItem value="flex">
                    <Trans>Fill with Flex</Trans>
                  </MenuItem>
                  <MenuItem value="continue">
                    <Trans>Continue with New Content</Trans>
                  </MenuItem>
                </Select>
              )}
            />
            <FormHelperText>
              <Trans>
                Controls what happens when this slot runs out of replayed
                content from earlier continue slots.
              </Trans>
            </FormHelperText>
          </FormControl>
        )}
      </Stack>
    );
  }

  if (showPicker) {
    return (
      <Stack spacing={1} sx={{ mt: 1 }}>
        <Autocomplete
          options={linkableSlots}
          getOptionLabel={(slot) =>
            `${getSlotName(slot) ?? prettifySnakeCaseString(slot.type)} (${getSlotIdentifier(slot)})`
          }
          getOptionKey={(slot) => slot.id}
          isOptionEqualToValue={linkableSlotsAreEqual}
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
