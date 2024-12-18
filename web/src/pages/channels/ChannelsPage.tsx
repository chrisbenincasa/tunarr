import { betterHumanize } from '@/helpers/dayjs.ts';
import { useTranscodeConfigs } from '@/hooks/settingsHooks.ts';
import { useApiQuery } from '@/hooks/useApiQuery.ts';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard.ts';
import {
  setChannelPaginationState,
  setChannelTableColumnModel,
} from '@/store/settings/actions.ts';
import { Maybe } from '@/types/util.ts';
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
import { PaginationState, VisibilityState } from '@tanstack/react-table';
import { Channel, ChannelIcon, TranscodeConfig } from '@tunarr/types';
import { ChannelSessionsResponse } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { find, isEmpty, map, trimEnd } from 'lodash-es';
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
import { useChannelsSuspense } from '../../hooks/useChannels.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { useSettings } from '../../store/settings/selectors.ts';

type ChannelRow = Channel & {
  sessions: ChannelSessionsResponse[] | undefined;
};

export default function ChannelsPage() {
  const { backendUri } = useSettings();
  const apiClient = useTunarrApi();
  const { data: channels } = useChannelsSuspense();
  const { data: channelSessions } = useApiQuery({
    queryKey: ['channels', 'sessions'],
    queryFn(apiClient) {
      return apiClient.getAllChannelSessions();
    },
    staleTime: 10_000,
  });
  const { data: transcodeConfigs } = useTranscodeConfigs();
  const theme = useTheme();
  const mediumViewport = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteChannelConfirmation, setDeleteChannelConfirmation] = useState<
    Channel | undefined
  >(undefined);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [channelMenuOpen, setChannelMenuOpen] = React.useState<string | null>(
    null,
  );
  const settings = useSettings();

  const initialColumnModel = settings.ui.channelTableColumnModel;
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(initialColumnModel);
  const [paginationState, setPaginationState] = useState<PaginationState>(
    settings.ui.channelTablePagination,
  );

  useEffect(() => {
    setChannelTableColumnModel(columnVisibility);
  }, [columnVisibility]);

  useEffect(() => {
    setChannelPaginationState(paginationState);
  }, [paginationState]);

  const handleOpenMenu = (
    event: React.MouseEvent<HTMLElement>,
    channelId: string,
  ) => {
    event.stopPropagation();
    setChannelMenuOpen(channelId);
    setAnchorEl(event.currentTarget);
  };

  const copyToClipboard = useCopyToClipboard();

  const handleChannelMenuClose = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setChannelMenuOpen(null);
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
        {deleteChannelConfirmation && (
          <>
            <DialogTitle id="delete-channel-title">
              Delete Channel "{deleteChannelConfirmation.name}"?
            </DialogTitle>
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
                onClick={() => removeChannel(deleteChannelConfirmation.id)}
                variant="contained"
              >
                Delete
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    );
  };

  const renderChannelMenu = (row: ChannelRow) => {
    const { id: channelId, name: channelName, sessions } = row;
    return (
      <Menu
        id="channel-options-menu"
        anchorEl={anchorEl}
        open={channelMenuOpen === row.id}
        onClose={handleChannelMenuClose}
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
            const base = isNonEmptyString(backendUri)
              ? backendUri
              : window.location.origin;
            const url = `${trimEnd(
              base,
              '/',
            )}/stream/channels/${channelId}.m3u8`;
            copyToClipboard(
              url,
              `Copied channel "${channelName}" m3u link to clipboard`,
              'Error copying channel m3u link to clipboard',
            )
              .catch(console.error)
              .finally(() => {
                setChannelMenuOpen(null);
              });
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
            handleChannelMenuClose(e);
          }}
          disabled={isEmpty(sessions)}
        >
          <ListItemIcon>
            <Stop />
          </ListItemIcon>
          <ListItemText primary={`Stop Transcode Session`} />
        </MenuItem>
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            setDeleteChannelConfirmation(row);
          }}
        >
          <ListItemIcon>
            <Delete />
          </ListItemIcon>
          <ListItemText>Delete Channel</ListItemText>
        </MenuItem>
      </Menu>
    );
  };

  const renderActionCell = ({
    row: { original: channel },
  }: {
    row: MRT_Row<ChannelRow>;
  }) => {
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
          aria-controls={channelMenuOpen ? 'channel-options-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={channelMenuOpen ? 'true' : undefined}
          onClick={(e) => handleOpenMenu(e, channel.id)}
        >
          <MoreVert />
        </IconButton>
      </>
    );
  };

  const columnsNew = useMemo<MRT_ColumnDef<ChannelRow>[]>(
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
      {
        header: 'Transcode Config',
        accessorFn: (row) =>
          find(transcodeConfigs, { id: row.transcodeConfigId }),
        id: 'transcodeConfigId',
        Cell: ({ cell }) => {
          const conf = cell.getValue<Maybe<TranscodeConfig>>();
          if (!conf) {
            return '-';
          }

          return (
            <Link
              to={`/settings/ffmpeg/${conf.id}`}
              onClick={(e) => e.stopPropagation()}
              component={RouterLink}
            >
              {conf.name}
            </Link>
          );
        },
        enableSorting: false,
      },
    ],
    [transcodeConfigs],
  );

  const channelTableData = useMemo(() => {
    return map(channels, (channel) => {
      return {
        ...channel,
        sessions: channelSessions ? channelSessions[channel.id] : undefined,
      };
    });
  }, [channels, channelSessions]);

  const table = useMaterialReactTable({
    columns: columnsNew,
    data: channelTableData,
    enableRowActions: true,
    layoutMode: 'grid',
    state: {
      columnVisibility,
      pagination: paginationState,
    },
    initialState: {
      pagination: paginationState,
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
    onPaginationChange: (updater) => setPaginationState(updater),
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
