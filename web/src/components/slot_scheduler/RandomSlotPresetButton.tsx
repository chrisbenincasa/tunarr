import { StyledMenu } from '@/components/base/StyledMenu.tsx';
import type { SvgIconComponent } from '@mui/icons-material';
import { Shuffle } from '@mui/icons-material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Button, ListItemIcon, MenuItem } from '@mui/material';
import React, { useState } from 'react';
import { SlotSchedulerCyclicShuffleDialog } from './SlotSchedulerCyclicShuffleDialog.tsx';

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

type Dialogs = (typeof options)[number]['key'];

export const RandomSlotPresetButton = () => {
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const [openDialog, setOpenDialog] = useState<Dialogs | null>(null);

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
        variant="outlined"
      >
        Presets
      </Button>
      <StyledMenu
        anchorEl={anchorRef.current}
        open={open}
        onClose={handleClose}
      >
        {options.map((option) => (
          <MenuItem key={option.key} onClick={() => setOpenDialog(option.key)}>
            <ListItemIcon>
              <option.Icon fontSize="small" />
            </ListItemIcon>
            {option.description}
          </MenuItem>
        ))}
      </StyledMenu>
      <SlotSchedulerCyclicShuffleDialog
        open={openDialog === 'cyclie_shuffle'}
        onClose={() => setOpenDialog(null)}
      />
    </React.Fragment>
  );
};
