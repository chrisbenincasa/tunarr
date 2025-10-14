import EmbyIcon from '@/assets/emby.svg?react';
import JellyfinIcon from '@/assets/jellyfin.svg?react';
import PlexIcon from '@/assets/plex.svg?react';
import { usePlexLogin } from '@/hooks/plex/usePlexLogin.tsx';
import { Add, Computer } from '@mui/icons-material';
import {
  Box,
  Button,
  type ButtonProps,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  SvgIcon,
} from '@mui/material';
import type { MediaSourceType } from '@tunarr/types';
import { isNull } from 'lodash-es';
import { useState } from 'react';
import { EmbyServerEditDialog } from './EmbyServerEditDialog.tsx';
import { JellyfinServerEditDialog } from './JelllyfinServerEditDialog.tsx';
import { LocalMediaEditDialog } from './LocalMediaEditDialog.tsx';
import { PlexServerEditDialog } from './PlexServerEditDialog.tsx';

type Props = {
  ButtonProps?: ButtonProps;
};

export function AddMediaSourceButton({ ButtonProps }: Props) {
  const [manualAddPopoverRef, setManualAddPopoverRef] =
    useState<HTMLButtonElement | null>(null);

  const [plexEditDialogOpen, setPlexEditDialogOpen] = useState(false);
  const [jellyfinEditDialogOpen, setJellyfinEditDialogOpen] = useState(false);
  const [embyEditDialogOpen, setEmbyEditDialogOpen] = useState(false);
  const [localEditDialogOpen, setLocalEditDialogOpen] = useState(false);
  const discoverPlexServers = usePlexLogin();

  const open = !isNull(manualAddPopoverRef);

  const openManualAddButtonMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    setManualAddPopoverRef(event.currentTarget);
  };

  const closeManualAddButtonMenu = () => {
    setManualAddPopoverRef(null);
  };

  const handleDiscoverPlexServers = () => {
    discoverPlexServers();
    closeManualAddButtonMenu();
  };

  const handleOpenMediaSourceDialog = (source: MediaSourceType) => {
    switch (source) {
      case 'plex':
        setPlexEditDialogOpen(true);
        break;
      case 'jellyfin':
        setJellyfinEditDialogOpen(true);
        break;
      case 'emby':
        setEmbyEditDialogOpen(true);
        break;
      case 'local':
        setLocalEditDialogOpen(true);
        break;
    }
    closeManualAddButtonMenu();
  };

  return (
    <Box>
      <Button
        color="inherit"
        onClick={openManualAddButtonMenu}
        variant="contained"
        startIcon={<Add />}
        {...ButtonProps}
      >
        Add
      </Button>
      <Menu
        open={open}
        anchorEl={manualAddPopoverRef}
        onClose={closeManualAddButtonMenu}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: { minWidth: 150 },
          },
        }}
      >
        <MenuItem onClick={() => handleDiscoverPlexServers()}>
          <ListItemIcon>
            <SvgIcon>
              <PlexIcon />
            </SvgIcon>
          </ListItemIcon>
          <ListItemText>Plex (Auto)</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleOpenMediaSourceDialog('plex')}>
          <ListItemIcon>
            <SvgIcon>
              <PlexIcon />
            </SvgIcon>
          </ListItemIcon>
          <ListItemText>Plex (Manual)</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleOpenMediaSourceDialog('jellyfin')}>
          <ListItemIcon>
            <SvgIcon>
              <JellyfinIcon />
            </SvgIcon>
          </ListItemIcon>
          <ListItemText>Jellyfin</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleOpenMediaSourceDialog('emby')}>
          <ListItemIcon>
            <SvgIcon>
              <EmbyIcon />
            </SvgIcon>
          </ListItemIcon>
          <ListItemText>Emby</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleOpenMediaSourceDialog('local')}>
          <ListItemIcon>
            <Computer />
          </ListItemIcon>
          <ListItemText>Local</ListItemText>
        </MenuItem>
      </Menu>
      <PlexServerEditDialog
        open={plexEditDialogOpen}
        onClose={() => setPlexEditDialogOpen(false)}
      />
      <JellyfinServerEditDialog
        open={jellyfinEditDialogOpen}
        onClose={() => setJellyfinEditDialogOpen(false)}
      />
      <EmbyServerEditDialog
        open={embyEditDialogOpen}
        onClose={() => setEmbyEditDialogOpen(false)}
      />
      <LocalMediaEditDialog
        open={localEditDialogOpen}
        onClose={() => setLocalEditDialogOpen(false)}
      />
    </Box>
  );
}
