import { betterHumanize } from '@/helpers/dayjs.ts';
import {
  Check,
  Close,
  Delete,
  MoreVert,
  Stop,
  PlayArrow as WatchIcon,
} from '@mui/icons-material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  TableContainer,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from '@tanstack/react-router';
import { Channel, ChannelIcon } from '@tunarr/types';
import dayjs from 'dayjs';
import {
  MRT_Row,
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef, //if using TypeScript (optional, but recommended)
} from 'material-react-table';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TunarrLogo from '../../components/TunarrLogo.tsx';
import NoChannelsCreated from '../../components/channel_config/NoChannelsCreated.tsx';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useSuspenseChannels } from '../../hooks/useChannels.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { useSettings } from '../../store/settings/selectors.ts';
import { VisibilityState } from '@tanstack/react-table';
import { setChannelTableColumnModel } from '@/store/settings/actions.ts';
import { useApiQuery } from '@/hooks/useApiQuery.ts';
import { isEmpty, isUndefined } from 'lodash-es';

export default function ChannelsPage() {
  const { backendUri } = useSettings();
  const apiClient = useTunarrApi();
  const { data: channels } = useSuspenseChannels();
  const { data: channelSessions, isLoading: channelSessionsLoading } =
    useApiQuery({
      queryKey: ['channels', 'sessions'],
      queryFn(apiClient) {
        return apiClient.getAllChannelSessions();
      },
      staleTime: 10_000,
    });
  const theme = useTheme();
  const mediumViewport = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteChannelConfirmation, setDeleteChannelConfirmation] = useState<
    string | undefined
  >(undefined);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [open, setOpen] = React.useState(false);
  const [channelMenu, setChannelMenu] = useState<Channel | null>(null);
  const settings = useSettings();

  const initialColumnModel = settings.ui.channelTableColumnModel;
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(initialColumnModel);

  useEffect(() => {
    setChannelTableColumnModel(columnVisibility);
  }, [columnVisibility]);

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
  // useEffect(() => {
  //   setAnchorEl(null);
  //   setChannelMenu(null);
  // }, [channelsFetching]);

  const stopSessionsMutation = useMutation({
    mutationKey: ['channels', 'stop-sessions'],
    mutationFn: ({ id }: { id: string }) => {
      return apiClient.stopChannelSessions(undefined, { params: { id } });
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['channels', 'sessions'],
        exact: true,
      });
    },
  });

  const handleStopSessions = (channelId: string) => {
    stopSessionsMutation.mutate({ id: channelId });
  };

  const handleChannelNavigation = (
    _: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    id: string,
  ) => {
    navigate({
      to: `/channels/$channelId/programming`,
      params: { channelId: id },
    }).catch(console.error);
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

  const renderChannelMenu = useCallback(() => {
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
            href={`${
              isNonEmptyString(backendUri) ? `${backendUri}/` : ''
            }media-player/${channelMenu.number}.m3u`}
            target="_blank"
            component={Link}
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
  }, [anchorEl, backendUri, channelMenu, open]);

  const renderActionCell = useCallback(
    ({ row: { original: channel } }: { row: MRT_Row<Channel> }) => {
      return mediumViewport ? (
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
        <Box>
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
          <Tooltip title="Stop Transcode Session" placement="top">
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                handleStopSessions(channel.id);
              }}
              disabled={
                channelSessionsLoading ||
                isUndefined(channelSessions) ||
                isEmpty(channelSessions[channel.id])
              }
            >
              <Stop />
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
        </Box>
      );
    },
    [
      backendUri,
      channelSessions,
      channelSessionsLoading,
      mediumViewport,
      open,
      renderChannelMenu,
    ],
  );

  const columnsNew = useMemo<MRT_ColumnDef<Channel>[]>(
    () => [
      {
        header: 'Number',
        accessorKey: 'number',
        minSize: 120,
        size: 120,
      },
      {
        header: 'Icon',
        accessorKey: 'icon',
        size: 100,
        Cell: ({ cell }) => {
          const value = cell.getValue<ChannelIcon>();
          return isNonEmptyString(value?.path) ? (
            <img style={{ maxHeight: '40px' }} src={value.path} />
          ) : (
            <TunarrLogo style={{ width: '40px', height: '32px' }} />
          );
        },
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        header: 'Name',
        accessorKey: 'name',
        size: 250,
      },
      {
        header: '# Programs',
        accessorKey: 'programCount',
      },
      {
        header: 'Duration',
        accessorKey: 'duration',
        Cell: ({ cell }) =>
          betterHumanize(dayjs.duration(cell.getValue<number>()), {
            style: 'short',
          }),
      },
      {
        header: 'Stealth?',
        accessorKey: 'stealth',
        Cell: ({ cell }) => (cell.getValue<boolean>() ? <Check /> : <Close />),
        muiTableBodyCellProps: {
          align: 'justify',
        },
        filterVariant: 'checkbox',
        enableSorting: false,
        size: 150,
      },
      {
        header: 'On-Demand?',
        accessorKey: 'onDemand.enabled',
        Cell: ({ cell }) => (cell.getValue<boolean>() ? <Check /> : <Close />),
        filterVariant: 'checkbox',
        enableSorting: false,
        id: 'onDemand',
      },
    ],
    [],
  );

  const table = useMaterialReactTable({
    columns: columnsNew,
    data: channels,
    enableRowActions: true,
    layoutMode: 'grid',
    state: {
      columnVisibility,
    },
    muiTableBodyRowProps: ({ row }) => ({
      sx: {
        cursor: 'pointer',
      },
      onClick: (event) => {
        handleChannelNavigation(event, row.original.id);
      },
    }),
    displayColumnDefOptions: {
      'mrt-row-actions': {
        size: mediumViewport ? 60 : 200,
        grow: false,
        Header: '',
        visibleInShowHideMenu: false,
      },
    },
    positionActionsColumn: 'last',
    renderRowActions: renderActionCell,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility(updater);
    },
  });

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

      <TableContainer component={Paper} sx={{ width: '100%' }}>
        <MaterialReactTable table={table} />
      </TableContainer>

      <NoChannelsCreated />
    </div>
  );
}
