import { Add } from '@mui/icons-material';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  SvgIcon,
  ListItemText,
  ButtonProps,
} from '@mui/material';
import { isNull } from 'lodash-es';
import { useState } from 'react';
import { JellyfinServerEditDialog } from './JelllyfinServerEditDialog.tsx';
import { PlexServerEditDialog } from './PlexServerEditDialog.tsx';
import PlexIcon from '@/assets/plex.svg?react';
import JellyfinIcon from '@/assets/jellyfin.svg?react';
import { usePlexLogin } from '@/hooks/plex/usePlexLogin.tsx';

type Props = {
  ButtonProps?: ButtonProps;
};

export function AddMediaSourceButton({ ButtonProps }: Props) {
  const [manualAddPopoverRef, setManualAddPopoverRef] =
    useState<HTMLButtonElement | null>(null);

  const [plexEditDialogOpen, setPlexEditDialogOpen] = useState(false);
  const [jellyfinEditDialogOpen, setJellyfinEditDialogOpen] = useState(false);
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

  const handleOpenMediaSourceDialog = (source: 'plex' | 'jellyfin') => {
    switch (source) {
      case 'plex':
        setPlexEditDialogOpen(true);
        break;
      case 'jellyfin':
        setJellyfinEditDialogOpen(true);
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
        <MenuItem onClick={discoverPlexServers}>
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
      </Menu>
      <PlexServerEditDialog
        open={plexEditDialogOpen}
        onClose={() => setPlexEditDialogOpen(false)}
      />
      <JellyfinServerEditDialog
        open={jellyfinEditDialogOpen}
        onClose={() => setJellyfinEditDialogOpen(false)}
      />
    </Box>
  );
}
