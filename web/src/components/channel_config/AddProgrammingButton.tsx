import { Route } from '@/routes/channels_/$channelId/programming/index.tsx';
import {
  Add as AddIcon,
  AddToQueue,
  Expand as FlexIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Directions as RedirectIcon,
} from '@mui/icons-material';
import { Button, MenuItem } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { ElevatedTooltip } from '../base/ElevatedTooltip.tsx';
import { StyledMenu } from '../base/StyledMenu';
import AddFlexModal from '../programming_controls/AddFlexModal';
import AddRedirectModal from '../programming_controls/AddRedirectModal';

export default function AddProgrammingButton() {
  const { t } = useLingui();
  const [addRedirectModalOpen, setAddRedirectModalOpen] = useState(false);
  const [addFlexModalOpen, setAddFlexModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const { channelId } = Route.useParams();

  const open = anchorEl !== null;

  const handleClose = () => {
    setAnchorEl(null);
  };

  const addProgrammingOptions = [
    {
      icon: <AddToQueue />,
      name: t`Media...`,
      callback: () =>
        navigate({
          to: '/channels/$channelId/programming/add',
          params: { channelId },
        }),
      description: t`Add TV Shows or Movies to programming list.`,
    },
    {
      icon: <RedirectIcon />,
      name: t`Redirect...`,
      callback: () => setAddRedirectModalOpen(true),
      description: t`Adds a channel redirect. During this period of time, the channel will redirect to another channel.`,
    },
    {
      icon: <FlexIcon />,
      name: t`Flex...`,
      callback: () => setAddFlexModalOpen(true),
      description: t`Programs a single Flex time slot. To add Flex across the whole lineup at once, use the Flex menu.`,
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

      <Button
        id="channel-programming-add-button"
        startIcon={<AddIcon />}
        endIcon={<KeyboardArrowDownIcon />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        variant="outlined"
      >
        <Trans>Add</Trans>
      </Button>
      <StyledMenu
        id="channel-programming-add"
        MenuListProps={{
          'aria-labelledby': 'channel-programming-add-button',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        {addProgrammingOptions.map((item) => (
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
                handleClose();
              }}
            >
              {item.icon} {item.name}
            </MenuItem>
          </ElevatedTooltip>
        ))}
      </StyledMenu>
    </>
  );
}
