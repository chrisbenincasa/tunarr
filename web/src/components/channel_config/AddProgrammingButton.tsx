import { Route } from '@/routes/channels_/$channelId/programming/index.tsx';
import {
  AddToQueue,
  FreeBreakfast as BreaksIcon,
  Expand as FlexIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Expand as PaddingIcon,
  Directions as RedirectIcon,
  Nightlight as RestrictHoursIcon,
} from '@mui/icons-material';
import { Button, ButtonGroup, MenuItem } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import { isNull } from 'lodash-es';
import { useState } from 'react';
import { ElevatedTooltip } from '../base/ElevatedTooltip.tsx';
import { StyledMenu } from '../base/StyledMenu';
import AddBreaksModal from '../programming_controls/AddBreaksModal';
import AddFlexModal from '../programming_controls/AddFlexModal';
import AddPaddingModal from '../programming_controls/AddPaddingModal';
import AddRedirectModal from '../programming_controls/AddRedirectModal';
import AddRestrictHoursModal from '../programming_controls/AddRestrictHoursModal';

export default function AddProgrammingButton() {
  const [addRedirectModalOpen, setAddRedirectModalOpen] = useState(false);
  const [addFlexModalOpen, setAddFlexModalOpen] = useState(false);
  const [addPaddingModalOpen, setAddPaddingModalOpen] = useState(false);
  const [addRestrictHoursModalOpen, setAddRestrictHoursModalOpen] =
    useState(false);
  const [addBreaksModalOpen, setAddBreaksModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [lastSelection, setLastSelection] = useState<number>(0);
  const navigate = useNavigate();
  const { channelId } = Route.useParams();

  const open = !isNull(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const addProgrammingOptions = [
    {
      icon: <AddToQueue />,
      name: 'Add Media',
      callback: () =>
        navigate({
          to: '/channels/$channelId/programming/add',
          params: { channelId },
        }),
      description: 'Add TV Shows or Movies to programming list.',
      divider: false,
    },
    {
      icon: <RedirectIcon />,
      name: 'Add Redirect',
      callback: () => setAddRedirectModalOpen(true),
      description:
        'Adds a channel redirect. During this period of time, the channel will redirect to another channel.',
      divider: false,
    },
    {
      icon: null,
      name: 'Flex',
      callback: () => null,
      description: '',
      divider: true,
    },
    {
      icon: <FlexIcon />,
      name: 'Add Flex',
      callback: () => setAddFlexModalOpen(true),
      description:
        "Programs a Flex time slot. Normally you'd use pad times, restrict times or add breaks to add a large quantity of Flex times at once, but this exists for more specific cases.",
      divider: false,
    },
    {
      icon: <BreaksIcon />,
      name: 'Add Breaks',
      callback: () => setAddBreaksModalOpen(true),
      description:
        'Adds Flex breaks after each TV episode or movie to ensure that the program starts at one of the allowed minute marks. For example, you can use this to ensure that all your programs start at either XX:00 times or XX:30 times. Removes any existing Flex periods before adding the new ones. This button might be disabled if the channel is already too large.',
      divider: false,
    },
    {
      icon: <PaddingIcon />,
      name: 'Add Padding',
      callback: () => setAddPaddingModalOpen(true),
      description:
        'Adds Flex breaks after each TV episode or movie to ensure that the program starts at one of the allowed minute marks. For example, you can use this to ensure that all your programs start at either XX:00 times or XX:30 times. Removes any existing Flex periods before adding the new ones. This button might be disabled if the channel is already too large.',
      divider: false,
    },
    {
      icon: <RestrictHoursIcon />,
      name: 'Restrict Hours',
      callback: () => setAddRestrictHoursModalOpen(true),
      description:
        "The channel's regular programming between the specified hours. Flex time will fill up the remaining hours.",
      divider: false,
    },
  ];

  return (
    <>
      <AddFlexModal
        open={addFlexModalOpen}
        onClose={() => setAddFlexModalOpen(false)}
      />
      <AddRedirectModal
        open={addRedirectModalOpen}
        onClose={() => setAddRedirectModalOpen(false)}
      />
      <AddPaddingModal
        open={addPaddingModalOpen}
        onClose={() => setAddPaddingModalOpen(false)}
      />
      <AddRestrictHoursModal
        open={addRestrictHoursModalOpen}
        onClose={() => setAddRestrictHoursModalOpen(false)}
      />
      <AddBreaksModal
        open={addBreaksModalOpen}
        onClose={() => setAddBreaksModalOpen(false)}
      />

      <ButtonGroup aria-label="Add Programming Button Group">
        <Button
          onClick={addProgrammingOptions[lastSelection].callback}
          startIcon={addProgrammingOptions[lastSelection].icon}
        >
          {addProgrammingOptions[lastSelection].name}
        </Button>
        <Button onClick={handleClick}>
          <KeyboardArrowDownIcon />
        </Button>
      </ButtonGroup>
      <StyledMenu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {addProgrammingOptions.map((item, index) =>
          item.divider ? (
            <MenuItem divider disabled key={item.name}>
              {item.name}
            </MenuItem>
          ) : (
            <ElevatedTooltip
              elevation={5}
              key={item.name}
              title={item.description}
              placement="right"
            >
              <MenuItem
                disableRipple
                onClick={() => {
                  item.callback();
                  setLastSelection(index);
                  handleClose();
                }}
              >
                {item.icon} {item.name}
              </MenuItem>
            </ElevatedTooltip>
          ),
        )}
      </StyledMenu>
    </>
  );
}
