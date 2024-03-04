import { Link } from 'react-router-dom';
import {
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  MenuProps,
  Tooltip,
  alpha,
  styled,
} from '@mui/material';
import {
  Expand as FlexIcon,
  Expand as PaddingIcon,
  Directions as RedirectIcon,
  FreeBreakfast as BreaksIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Nightlight as RestrictHoursIcon,
  Tv as MediaIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import AddFlexModal from '../programming_controls/AddFlexModal';
import AddRedirectModal from '../programming_controls/AddRedirectModal';
import AddPaddingModal from '../programming_controls/AddPaddingModal';
import ProgrammingSelectorDialog from './ProgrammingSelectorDialog';
import AddRestrictHoursModal from '../programming_controls/AddRestrictHoursModal';
import AddBreaksModal from '../programming_controls/AddBreaksModal';

const StyledMenu = styled((props: MenuProps) => (
  <Menu
    elevation={0}
    anchorOrigin={{
      vertical: 'bottom',
      horizontal: 'right',
    }}
    transformOrigin={{
      vertical: 'top',
      horizontal: 'right',
    }}
    {...props}
  />
))(({ theme }) => ({
  '& .MuiPaper-root': {
    borderRadius: 6,
    marginTop: theme.spacing(1),
    minWidth: 180,
    color:
      theme.palette.mode === 'light'
        ? 'rgb(55, 65, 81)'
        : theme.palette.grey[300],
    boxShadow:
      'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
    '& .MuiMenu-list': {
      padding: '4px 0',
    },
    '& .MuiMenuItem-root': {
      '& .MuiSvgIcon-root': {
        fontSize: 18,
        color: theme.palette.text.secondary,
        marginRight: theme.spacing(1.5),
      },
      '&:active': {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity,
        ),
      },
    },
  },
}));

export default function AddProgrammingButton() {
  const [addRedirectModalOpen, setAddRedirectModalOpen] = useState(false);
  const [addFlexModalOpen, setAddFlexModalOpen] = useState(false);
  const [addPaddingModalOpen, setAddPaddingModalOpen] = useState(false);
  const [addRestrictHoursModalOpen, setAddRestrictHoursModalOpen] =
    useState(false);
  const [addBreaksModalOpen, setAddBreaksModalOpen] = useState(false);
  const [programmingModalOpen, setProgrammingModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

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
      <ProgrammingSelectorDialog
        open={programmingModalOpen}
        onClose={() => setProgrammingModalOpen(false)}
      />
      <AddRestrictHoursModal
        open={addRestrictHoursModalOpen}
        onClose={() => setAddRestrictHoursModalOpen(false)}
      />
      <AddBreaksModal
        open={addBreaksModalOpen}
        onClose={() => setAddBreaksModalOpen(false)}
      />

      <ButtonGroup variant="contained" aria-label="Basic button group">
        <Button
          variant="contained"
          component={Link}
          to="add"
          startIcon={<MediaIcon />}
        >
          Add Media
        </Button>
        <Button onClick={handleClick}>
          <KeyboardArrowDownIcon />
        </Button>
      </ButtonGroup>
      <StyledMenu
        id="demo-customized-menu"
        MenuListProps={{
          'aria-labelledby': 'demo-customized-button',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <Tooltip
          title="Add TV Shows or Movies to programming list."
          placement="right"
        >
          <MenuItem disableRipple component={Link} to="add">
            <MediaIcon /> Add Media
          </MenuItem>
        </Tooltip>
        <Tooltip
          title="Adds a channel redirect. During this period of time, the channel will redirect to another channel."
          placement="right"
        >
          <MenuItem
            disableRipple
            onClick={() => {
              setAddRedirectModalOpen(true);
              handleClose();
            }}
          >
            <RedirectIcon /> Add Redirect
          </MenuItem>
        </Tooltip>
        <MenuItem divider disabled>
          Flex
        </MenuItem>
        <Tooltip
          title="Programs a Flex time slot. Normally you'd use pad times, restrict times or add breaks to add a large quantity of Flex times at once, but this exists for more specific cases."
          placement="right"
        >
          <MenuItem
            disableRipple
            onClick={() => {
              setAddFlexModalOpen(true);
              handleClose();
            }}
          >
            <FlexIcon /> Add Flex
          </MenuItem>
        </Tooltip>
        <Tooltip
          title="Adds Flex breaks between programs, attempting to avoid groups of consecutive programs that exceed the specified number of minutes. This button might be disabled if the channel is already too large."
          placement="right"
        >
          <MenuItem
            disableRipple
            onClick={() => {
              setAddBreaksModalOpen(true);
              handleClose();
            }}
          >
            <BreaksIcon /> Add Breaks
          </MenuItem>
        </Tooltip>
        <Tooltip
          title="Adds Flex breaks after each TV episode or movie to ensure that the program starts at one of the allowed minute marks. For example, you can use this to ensure that all your programs start at either XX:00 times or XX:30 times. Removes any existing Flex periods before adding the new ones. This button might be disabled if the channel is already too large."
          placement="right"
        >
          <MenuItem
            disableRipple
            onClick={() => {
              setAddPaddingModalOpen(true);
              handleClose();
            }}
          >
            <PaddingIcon /> Add Padding
          </MenuItem>
        </Tooltip>
        <Tooltip
          title="The channel's regular programming between the specified hours. Flex time will fill up the remaining hours."
          placement="right"
        >
          <MenuItem
            disableRipple
            onClick={() => {
              setAddRestrictHoursModalOpen(true);
              handleClose();
            }}
          >
            <RestrictHoursIcon /> Restrict Hours
          </MenuItem>
        </Tooltip>
      </StyledMenu>
    </>
  );
}
