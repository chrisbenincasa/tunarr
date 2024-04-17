import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Construction as OrganizeIcon,
} from '@mui/icons-material';
import { Button } from '@mui/material';
import Menu, { MenuProps } from '@mui/material/Menu';
import { alpha, styled } from '@mui/material/styles';
import { useState } from 'react';
import { ChannelProgrammingDeleteOptions } from './ChannelProgrammingDeleteOptions';
import { ChannelProgrammingOrganizeOptions } from './ChannelProgrammingOrganizeOptions';

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

export function ChannelProgrammingTools() {
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
      <Button
        startIcon={<OrganizeIcon />}
        endIcon={<KeyboardArrowDownIcon />}
        onClick={handleClick}
        variant="contained"
      >
        Tools
      </Button>

      <StyledMenu
        id="channel-programming-tools"
        MenuListProps={{
          'aria-labelledby': 'channel-programming-tools',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <ChannelProgrammingOrganizeOptions />
        <ChannelProgrammingDeleteOptions onClose={() => handleClose()} />
      </StyledMenu>
    </>
  );
}
