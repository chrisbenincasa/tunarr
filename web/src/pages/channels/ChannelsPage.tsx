import { betterHumanize } from '@/helpers/dayjs.ts';
import { useTranscodeConfigs } from '@/hooks/settingsHooks.ts';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard.ts';
import {
  setChannelPaginationState,
  setChannelTableColumnModel,
} from '@/store/settings/actions.ts';
import type { Maybe } from '@/types/util.ts';
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
import type { BoxProps } from '@mui/material';
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
import { green, red, yellow } from '@mui/material/colors';
import { styled, useTheme } from '@mui/material/styles';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from '@tanstack/react-router';
import type { PaginationState, VisibilityState } from '@tanstack/react-table';
import type { ChannelSession } from '@tunarr/types';
import {
  type Channel,
  type ChannelIcon,
  type TranscodeConfig,
} from '@tunarr/types';
import dayjs from 'dayjs';
import { find, isEmpty, map, sum, trimEnd } from 'lodash-es';
import type { MRT_Row } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef, //if using TypeScript (optional, but recommended)
} from 'material-react-table';
import pluralize from 'pluralize';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TunarrLogo from '../../components/TunarrLogo.tsx';
import NoChannelsCreated from '../../components/channel_config/NoChannelsCreated.tsx';
import { ChannelSessionsDialog } from '../../components/channels/ChannelSessionsDialog.tsx';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useChannelsSuspense } from '../../hooks/useChannels.ts';
import { useServerEvents } from '../../hooks/useServerEvents.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { useSettings } from '../../store/settings/selectors.ts';

type ChannelRow = Channel;

interface GlowingCircleProps extends BoxProps {
  color?: string;
  glowColor?: string;
}

const GlowingCircle = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color' && prop !== 'glowColor',
})<GlowingCircleProps>(({ color = '#87CEEB', glowColor = '#ADD8E6' }) => ({
  width: '50px',
  height: '50px',
  borderRadius: '50%',
  backgroundColor: color,
  boxShadow: `0 0 10px ${color}`,
  animation: 'glow 2s infinite alternate',
  '@keyframes glow': {
    '0%': {
      boxShadow: `0 0 10px ${color}` /* Start with a moderate glow */,
      backgroundColor: color,
    },
    '100%': {
      boxShadow: `0 0 20px ${glowColor}, 0 0 30px ${glowColor}` /* Increase glow and intensity, lighter blue */,
      backgroundColor: glowColor,
    },
  },
}));

export default function ChannelsPage() {
  const { backendUri } = useSettings();
  const apiClient = useTunarrApi();
  const { data: channels } = useChannelsSuspense();
  const { data: transcodeConfigs } = useTranscodeConfigs();
  const theme = useTheme();
  const mediumViewport = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteChannelConfirmation, setDeleteChannelConfirmation] = useState<
    Channel | undefined
  >(undefined);
  const [sessionDetailDialog, setSessionDetailDialog] =
    useState<Channel | null>(null);
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
  const { addListener, removeListener } = useServerEvents();

  useEffect(() => {
    setChannelTableColumnModel(columnVisibility);
  }, [columnVisibility]);

  useEffect(() => {
    const key = addListener((ev) => {
      if (ev.type === 'stream') {
        queryClient
          .invalidateQueries({
            queryKey: ['channels'],
          })
          .catch(console.error);
      }
    });
    return () => {
      removeListener(key);
    };
  }, [addListener, queryClient, removeListener]);

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
          disableRipple
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(channelId, 'Copied Channel ID!')
              .catch(console.error)
              .finally(() => {
                setChannelMenuOpen(null);
              });
          }}
        >
          <ListItemIcon>
            <TextSnippetIcon />
          </ListItemIcon>
          <ListItemText>Copy Channel ID</ListItemText>
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
      </Box>
    );
  };

  const columnsNew = useMemo<MRT_ColumnDef<ChannelRow>[]>(
    () => [
      {
        header: '',
        accessorKey: 'sessions',
        enableSorting: false,
        enableColumnActions: false,
        size: 50,
        Header: () => null,
        Cell: ({ cell, row: { original: channel } }) => {
          const sessions = cell.getValue<ChannelSession[] | undefined>();
          if (!sessions || isEmpty(sessions)) {
            return (
              <Tooltip placement="top" title="No active sessions">
                <Box
                  sx={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: red[200],
                  }}
                />
              </Tooltip>
            );
          }

          const totalConnections = sum(map(sessions, (s) => s.numConnections));
          const lameDuck = totalConnections === 0 && sessions.length > 0;

          return (
            <Tooltip
              placement="top"
              title={
                <Box component="span" sx={{ textAlign: 'center' }}>
                  {sessions.length} {pluralize('session', sessions.length)}
                  <br />
                  {totalConnections} {totalConnections > 1 ? 'total' : ''}
                  {pluralize('connection', totalConnections)}
                </Box>
              }
            >
              <GlowingCircle
                sx={{ width: '10px', height: '10px' }}
                color={lameDuck ? yellow[400] : green[400]}
                glowColor={lameDuck ? yellow[200] : green[200]}
                onClick={(e) => {
                  e.stopPropagation();
                  setSessionDetailDialog(channel);
                }}
              />
            </Tooltip>
          );
        },
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
        header: 'Number',
        accessorKey: 'number',
        minSize: 120,
        size: 120,
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

  // const channelTableData = useMemo(() => {
  //   return map(channels, (channel) => {
  //     return {
  //       ...channel,
  //       sessions: channelSessions ? channelSessions[channel.id] : undefined,
  //     };
  //   });
  // }, [channels, channelSessions]);

  const table = useMaterialReactTable({
    columns: columnsNew,
    data: channels,
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
    renderRowActions: renderActionCell,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility(updater);
    },
    onPaginationChange: (updater) => setPaginationState(updater),
    autoResetPageIndex: false,
  });

  return (
    <div>
      <Box display="flex" mb={2}>
        {renderConfirmationDialog()}
        <Typography flexGrow={1} variant="h3">
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
      <ChannelSessionsDialog
        open={!!sessionDetailDialog}
        onClose={() => setSessionDetailDialog(null)}
        channel={sessionDetailDialog}
      />
    </div>
  );
}
