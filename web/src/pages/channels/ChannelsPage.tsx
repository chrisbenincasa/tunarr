import { Delete, MoreVert, PlayArrow as WatchIcon } from '@mui/icons-material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Channel } from '@tunarr/types';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash-es';
import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import TunarrLogo from '../../components/TunarrLogo.tsx';
import NoChannelsCreated from '../../components/channel_config/NoChannelsCreated.tsx';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useChannels } from '../../hooks/useChannels.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { useSettings } from '../../store/settings/selectors.ts';

export default function ChannelsPage() {
  const { backendUri } = useSettings();
  const apiClient = useTunarrApi();
  const now = dayjs();
  const {
    isFetching: channelsFetching,
    error: channelsError,
    data: channels,
  } = useChannels();
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const mediumViewport = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteChannelConfirmation, setDeleteChannelConfirmation] = useState<
    string | undefined
  >(undefined);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [open, setOpen] = React.useState(false);
  const [channelMenu, setChannelMenu] = useState<Channel | null>(null);

  const handleClick = (
    event: React.MouseEvent<HTMLElement>,
    channel: Channel,
  ) => {
    event.stopPropagation();
    setOpen(true);
    setChannelMenu(channel);
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setOpen(false);
  };

  // To do: figure out better solution.  This is a temp workaround
  // Without this if user naviages away from tab then back, react query refetches and destroys exisitng ref
  // this moves menu to the top left of the screen.
  useEffect(() => {
    setAnchorEl(null);
    setChannelMenu(null);
  }, [channelsFetching]);

  const handleChannelNavigation = (
    _: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    id: string,
  ) => {
    navigate(`/channels/${id}/programming`);
  };

  const removeChannelMutation = useMutation({
    mutationFn: (id: string) => {
      return apiClient.deleteChannel(undefined, { params: { id } });
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['channels'],
      });
    },
  });

  const removeChannel = (id: string) => {
    removeChannelMutation.mutate(id);
    setDeleteChannelConfirmation(undefined);
  };

  const renderConfirmationDialog = () => {
    return (
      <Dialog
        open={!!deleteChannelConfirmation}
        onClose={() => setDeleteChannelConfirmation(undefined)}
        aria-labelledby="delete-channel-title"
        aria-describedby="delete-channel-description"
      >
        <DialogTitle id="delete-channel-title">{'Delete Channel?'}</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-channel-description">
            Deleting a Channel will remove all programming from the channel.
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteChannelConfirmation(undefined)}
            autoFocus
          >
            Cancel
          </Button>
          <Button
            onClick={() => removeChannel(deleteChannelConfirmation!)}
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderChannelMenu = () => {
    return (
      channelMenu && (
        <Menu
          id="channel-options-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          MenuListProps={{
            'aria-labelledby': 'channel-options-button',
          }}
        >
          <MenuItem
            to={`/channels/${channelMenu.id}/edit`}
            component={RouterLink}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <ListItemIcon>
              <EditIcon />
            </ListItemIcon>
            <ListItemText>Edit Channel Settings</ListItemText>
          </MenuItem>
          <MenuItem
            to={`${
              isNonEmptyString(backendUri) ? `${backendUri}/` : ''
            }media-player/${channelMenu.number}.m3u`}
            component={RouterLink}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <ListItemIcon>
              <TextSnippetIcon />
            </ListItemIcon>
            <ListItemText>Get Channel M3U File</ListItemText>
          </MenuItem>
          <MenuItem
            component={RouterLink}
            to={`/channels/${channelMenu.id}/watch`}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <ListItemIcon>
              <WatchIcon />
            </ListItemIcon>
            <ListItemText>Watch Channel</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              setDeleteChannelConfirmation(channelMenu.id);
            }}
          >
            <ListItemIcon>
              <Delete />
            </ListItemIcon>
            <ListItemText>Delete Channel</ListItemText>
          </MenuItem>
        </Menu>
      )
    );
  };

  // TODO properly define types from API
  const getDataTableRow = (channel: Channel) => {
    const startTime = dayjs(channel.startTime);
    return (
      <TableRow
        key={channel.number}
        onClick={(event) => handleChannelNavigation(event, channel.id)}
        sx={{ cursor: 'pointer' }}
        hover={true}
      >
        <TableCell>{channel.number}</TableCell>
        {!smallViewport && (
          <TableCell>
            {isEmpty(channel.icon.path) ? (
              <TunarrLogo style={{ width: '40px', height: '32px' }} />
            ) : (
              <img style={{ maxHeight: '40px' }} src={channel.icon.path} />
            )}
          </TableCell>
        )}
        <TableCell>{channel.name}</TableCell>
        <TableCell>{startTime.isBefore(now) ? 'Yes' : 'No'}</TableCell>
        <TableCell>{channel.stealth ? 'Yes' : 'No'}</TableCell>
        <TableCell sx={{ textAlign: 'right' }}>
          {mediumViewport ? (
            <>
              <IconButton
                id="channel-options-button"
                aria-controls={open ? 'channel-options-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={(event) => handleClick(event, channel)}
              >
                <MoreVert />
              </IconButton>
              {renderChannelMenu()}
            </>
          ) : (
            <>
              <Tooltip title="Edit Channel Settings" placement="top">
                <IconButton
                  to={`/channels/${channel.id}/edit`}
                  component={RouterLink}
                  onClick={(e) => e.stopPropagation()}
                >
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Get Channel M3U File" placement="top">
                <IconButton
                  href={`${
                    isNonEmptyString(backendUri) ? `${backendUri}/` : ''
                  }media-player/${channel.number}.m3u`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <TextSnippetIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Watch Channel" placement="top">
                <IconButton
                  component={RouterLink}
                  to={`/channels/${channel.id}/watch`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <WatchIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Channel" placement="top">
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteChannelConfirmation(channel.id);
                  }}
                >
                  <Delete />
                </IconButton>
              </Tooltip>
            </>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const getTableRows = () => {
    if (channelsFetching) {
      return (
        <TableRow key="pending">
          <TableCell
            colSpan={smallViewport ? 5 : 6}
            sx={{ my: 2, textAlign: 'center' }}
          >
            <CircularProgress />
          </TableCell>
        </TableRow>
      );
    } else if (channelsError) {
      return (
        <TableRow key="error">
          <TableCell
            colSpan={smallViewport ? 5 : 6}
            sx={{ my: 2, textAlign: 'center' }}
          >{`Error: ${channelsError.message}`}</TableCell>
        </TableRow>
      );
    } else {
      return channels?.map(getDataTableRow);
    }
  };

  return (
    <div>
      <Box display="flex" mb={2}>
        {renderConfirmationDialog()}
        <Typography flexGrow={1} variant="h4">
          Channels
        </Typography>
        <Button
          component={RouterLink}
          to="/channels/new"
          variant="contained"
          startIcon={<AddCircleIcon />}
        >
          New
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Number</TableCell>
              {!smallViewport && <TableCell>Icon</TableCell>}
              <TableCell>Name</TableCell>
              <TableCell>Live?</TableCell>
              <TableCell>Stealth?</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {channels && channels.length > 0 && getTableRows()}
          </TableBody>
        </Table>
      </TableContainer>

      <NoChannelsCreated />
    </div>
  );
}
