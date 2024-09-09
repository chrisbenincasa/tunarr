import { betterHumanize } from '@/helpers/dayjs.ts';
import { useApiQuery } from '@/hooks/useApiQuery.ts';
import { setChannelTableColumnModel } from '@/store/settings/actions.ts';
import {
  Check,
  Close,
  Delete,
  MoreVert,
  Settings,
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
import { VisibilityState } from '@tanstack/react-table';
import { Channel, ChannelIcon } from '@tunarr/types';
import dayjs from 'dayjs';
import { isEmpty, isUndefined } from 'lodash-es';
import {
  MRT_Row,
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef, //if using TypeScript (optional, but recommended)
} from 'material-react-table';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCopyToClipboard } from 'usehooks-ts';
import TunarrLogo from '../../components/TunarrLogo.tsx';
import NoChannelsCreated from '../../components/channel_config/NoChannelsCreated.tsx';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useSuspenseChannels } from '../../hooks/useChannels.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { useSettings } from '../../store/settings/selectors.ts';

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
  const settings = useSettings();

  const initialColumnModel = settings.ui.channelTableColumnModel;
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(initialColumnModel);

  useEffect(() => {
    setChannelTableColumnModel(columnVisibility);
  }, [columnVisibility]);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setOpen(true);
    setAnchorEl(event.currentTarget);
  };

  const snackbar = useSnackbar();

  const [, copyToClipboard] = useCopyToClipboard();

  const handleClose = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setOpen(false);
    setAnchorEl(null);
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

  const handleStopSessions = useCallback(
    (channelId: string) => {
      stopSessionsMutation.mutate({ id: channelId });
    },
    [stopSessionsMutation],
  );

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

  const renderChannelMenu = useCallback(
    ({ id: channelId, name: channelName }: Channel) => {
      return (
        <Menu
          id="channel-options-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          MenuListProps={{
            'aria-labelledby': 'channel-options-button',
          }}
        >
          {mediumViewport ? (
            <MenuItem
              to={`/channels/${channelId}/edit`}
              component={RouterLink}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <ListItemIcon>
                <EditIcon />
              </ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
          ) : null}

          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(
                `${
                  isNonEmptyString(backendUri) ? `${backendUri}/` : ''
                }media-player/${channelId}.m3u`,
              )
                .then(() =>
                  snackbar.enqueueSnackbar(
                    `Copied channel "${channelName}" m3u link to clipboard`,
                    { variant: 'success' },
                  ),
                )
                .catch((e) => {
                  snackbar.enqueueSnackbar(
                    'Error copying channel m3u link to clipboard',
                    {
                      variant: 'error',
                    },
                  );
                  console.error(e);
                })
                .finally(() => setOpen(false));
            }}
          >
            <ListItemIcon>
              <TextSnippetIcon />
            </ListItemIcon>
            <ListItemText>Copy M3U URL</ListItemText>
          </MenuItem>
          <MenuItem
            component={RouterLink}
            to={`/channels/${channelId}/watch`}
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
              handleStopSessions(channelId);
            }}
            disabled={
              channelSessionsLoading ||
              isUndefined(channelSessions) ||
              isEmpty(channelSessions[channelId])
            }
          >
            <ListItemIcon>
              <Stop />
            </ListItemIcon>
            <ListItemText primary="Stop Transcode Session" />
          </MenuItem>
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              setDeleteChannelConfirmation(channelId);
            }}
          >
            <ListItemIcon>
              <Delete />
            </ListItemIcon>
            <ListItemText>Delete Channel</ListItemText>
          </MenuItem>
        </Menu>
      );
    },
    [
      anchorEl,
      backendUri,
      channelSessions,
      channelSessionsLoading,
      copyToClipboard,
      handleStopSessions,
      mediumViewport,
      open,
      snackbar,
    ],
  );

  const renderActionCell = useCallback(
    ({ row: { original: channel } }: { row: MRT_Row<Channel> }) => {
      return (
        <>
          {renderChannelMenu(channel)}
          {!mediumViewport && (
            <Tooltip title="Edit Channel Settings" placement="top">
              <IconButton
                to={`/channels/${channel.id}/edit`}
                component={RouterLink}
                onClick={(e) => e.stopPropagation()}
              >
                <Settings />
              </IconButton>
            </Tooltip>
          )}
          <IconButton
            id="channel-options-button"
            aria-controls={open ? 'channel-options-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
            onClick={handleOpenMenu}
          >
            <MoreVert />
          </IconButton>
        </>
      );
    },
    [mediumViewport, open, renderChannelMenu],
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
        size: mediumViewport ? 60 : 100,
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
