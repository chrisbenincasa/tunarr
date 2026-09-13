import type {
  ProgramOption,
  ProgramOptionType,
} from '@/helpers/slotSchedulerUtil';
import {
  isSelectableForNewSlot,
  ProgramOptionTypes,
} from '@/helpers/slotSchedulerUtil.ts';
import { useLingui } from '@lingui/react/macro';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { isNonEmptyString } from '@tunarr/shared/util';
import { filter, map } from 'lodash-es';
import { useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useSlotProgramOptionsContext } from '../../hooks/programming_controls/useSlotProgramOptions.ts';
import type {
  CommonSlotViewModel,
  LinkMode,
} from '../../model/CommonSlotModels.ts';
import { CustomShowSlotProgrammingForm } from './CustomShowSlotProgrammingForm.tsx';
import { FillerListSlotProgrammingForm } from './FillerListSlotProgrammingForm.tsx';
import { RedirectProgrammingForm } from './RedirectProgrammingForm.tsx';
import { ShowSearchSlotProgrammingForm } from './ShowSearchSlotProgrammingForm.tsx';
import { SlotLinkingControl } from './SlotLinkingControl.tsx';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';
import { SmartCollectionSlotProgrammingForm } from './SmartCollectionSlotProgrammingForm.tsx';

type EditSlotProgramProps<SlotT extends { type: ProgramOptionType }> = {
  newSlotForType: (type: ProgramOptionType) => SlotT;
  allSlots: CommonSlotViewModel[];
  onLinkSourceSlot?: (
    sourceSlotId: string,
    groupId: string,
    linkMode: LinkMode,
  ) => void;
  onUnlinkFromGroup?: (groupId: string) => void;
};

export const EditSlotProgrammingForm = <
  SlotT extends { type: ProgramOptionType },
>({
  newSlotForType,
  allSlots,
  onLinkSourceSlot,
  onUnlinkFromGroup,
}: EditSlotProgramProps<SlotT>) => {
  const { t } = useLingui();
  const { reset, control } = useFormContext<CommonSlotViewModel>();
  const [type, iterationGroup] = useWatch({
    control,
    name: ['type', 'iterationGroup'],
  });
  const programOptions = useSlotProgramOptionsContext();
  const availableTypes = useMemo(() => {
    const types = new Set<ProgramOptionType>(
      programOptions.filter(isSelectableForNewSlot).map(({ type }) => type),
    );
    // A saved slot keeps its own type listed so it stays editable after its
    // content becomes unavailable.
    types.add(type);
    return types;
  }, [programOptions, type]);

  const onlyEmptyCustomShows =
    !availableTypes.has('custom-show') &&
    programOptions.some((opt) => opt.type === 'custom-show');

  const [typeSelectValue, setTypeSelectValue] =
    useState<ProgramOptionType>(type);

  const handleTypeChange = (value: ProgramOptionType) => {
    if (value === typeSelectValue) {
      return;
    }

    setTypeSelectValue(value);

    const slot = newSlotForType(value);
    reset((prev) => ({ ...prev, ...slot }));
  };

  return (
    <>
      <FormControl fullWidth>
        <InputLabel>{t`Type`}</InputLabel>
        <Select
          label={t`Type`}
          value={typeSelectValue}
          onChange={(e) =>
            handleTypeChange(e.target.value as ProgramOption['type'])
          }
          disabled={isNonEmptyString(iterationGroup)}
        >
          {map(
            filter(ProgramOptionTypes, ({ value }) =>
              availableTypes.has(value),
            ),
            ({ value, description }) => (
              <MenuItem key={value} value={value}>
                {description}
              </MenuItem>
            ),
          )}
          {onlyEmptyCustomShows && (
            <MenuItem value="custom-show" disabled>
              {t`Custom Show (add programs to a custom show first)`}
            </MenuItem>
          )}
        </Select>
      </FormControl>
      {typeSelectValue === 'custom-show' && <CustomShowSlotProgrammingForm />}
      {typeSelectValue === 'smart-collection' && (
        <SmartCollectionSlotProgrammingForm />
      )}
      {typeSelectValue === 'filler' && <FillerListSlotProgrammingForm />}
      {typeSelectValue === 'show' && <ShowSearchSlotProgrammingForm />}
      {typeSelectValue === 'redirect' && <RedirectProgrammingForm />}
      {typeSelectValue === 'movie' && <SlotOrderFormControl />}

      <SlotLinkingControl
        allSlots={allSlots}
        onLinkSourceSlot={onLinkSourceSlot}
        onUnlinkFromGroup={onUnlinkFromGroup}
      />
    </>
  );
};
