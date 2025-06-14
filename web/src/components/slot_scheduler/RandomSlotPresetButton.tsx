import { StyledMenu } from '@/components/base/StyledMenu.tsx';
import { UnlockedWeightScale } from '@/components/slot_scheduler/RandomSlotsWeightAdjustDialog.tsx';
import { getRandomSlotId } from '@/helpers/slotSchedulerUtil.ts';
import { useSlotProgramOptions } from '@/hooks/programming_controls/useSlotProgramOptions.ts';
import { useCalculateProgramFrequency } from '@/hooks/slot_scheduler/useCalculatorProgramFrequency.ts';
import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext.ts';
import type { SvgIconComponent } from '@mui/icons-material';
import { Shuffle } from '@mui/icons-material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Button, ListItemIcon, MenuItem } from '@mui/material';
import type { RandomSlot, RandomSlotSchedule } from '@tunarr/types/api';
import { forEach, maxBy } from 'lodash-es';
import React from 'react';
import { match } from 'ts-pattern';
import { defaultRandomSlotSchedule } from '../../helpers/constants.ts';

type Preset = {
  key: 'cyclie_shuffle';
  description: string;
  Icon: SvgIconComponent;
};

const options = [
  {
    key: 'cyclie_shuffle',
    description: 'Cyclic Shuffle',
    Icon: Shuffle,
  } satisfies Preset,
] as const;

export const RandomSlotPresetButton = () => {
  const { reset } = useRandomSlotFormContext();
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const { dropdownOpts: programOptions } = useSlotProgramOptions();

  const calculateProgramFrequency = useCalculateProgramFrequency();

  const handleMenuItemClick = (
    _: React.MouseEvent<HTMLLIElement, MouseEvent>,
    preset: Preset,
  ) => {
    switch (preset.key) {
      case 'cyclie_shuffle': {
        const frequencies = calculateProgramFrequency();
        const slots: RandomSlot[] = [];
        for (const opt of programOptions) {
          if (opt.type === 'flex' || opt.type === 'redirect') {
            continue;
          }

          const baseSlot = {
            cooldownMs: 0,
            durationSpec: {
              type: 'dynamic',
              programCount: 1,
            },
            order: 'ordered_shuffle',
            weight: 0, // Will get set later
            direction: 'asc',
          } as const;

          const newSlot = match(opt)
            .returnType<RandomSlot | null>()
            .with({ type: 'movie' }, () => ({
              ...baseSlot,
              type: 'movie',
              weight: 0,
            }))
            .with({ type: 'show' }, (showOpt) => ({
              ...baseSlot,
              type: 'show',
              showId: showOpt.showId,
            }))
            .with({ type: 'custom-show' }, (csOpt) => ({
              ...baseSlot,
              type: 'custom-show',
              customShowId: csOpt.customShowId,
            }))
            .otherwise(() => null);

          if (!newSlot) {
            continue;
          }

          newSlot.weight =
            frequencies[getRandomSlotId(newSlot) as string] ?? 0.0;

          slots.push(newSlot);
        }

        const maxWeight = maxBy(slots, (slot) => slot.weight)?.weight ?? 100.0;
        forEach(slots, (slot) => {
          slot.weight = Math.ceil(
            (slot.weight * UnlockedWeightScale) / maxWeight,
          );
        });

        reset({
          ...defaultRandomSlotSchedule,
          randomDistribution: 'weighted',
          padMs: 1,
          slots,
          lockWeights: false,
        } satisfies RandomSlotSchedule);
      }
    }
    handleClose();
  };

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <React.Fragment>
      <Button
        // startIcon={<OrganizeIcon />}
        endIcon={<KeyboardArrowDown />}
        onClick={handleToggle}
        ref={anchorRef}
        variant="contained"
      >
        Presets
      </Button>
      <StyledMenu
        anchorEl={anchorRef.current}
        open={open}
        onClose={handleClose}
      >
        {options.map((option) => (
          <MenuItem
            key={option.key}
            onClick={(event) => handleMenuItemClick(event, option)}
          >
            <ListItemIcon>
              <option.Icon fontSize="small" />
            </ListItemIcon>
            {option.description}
          </MenuItem>
        ))}
      </StyledMenu>
    </React.Fragment>
  );
};
