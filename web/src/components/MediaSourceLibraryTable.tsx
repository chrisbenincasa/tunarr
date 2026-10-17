import { Trans, useLingui } from '@lingui/react/macro';
import { HourglassTop, Radar, Refresh } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  IconButton,
  Link as MuiLink,
  Paper,
  Stack,
  Switch,
  TableContainer,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { prettifySnakeCaseString } from '@tunarr/shared/util';
import type { MediaSourceLibrary, MediaSourceSettings } from '@tunarr/types';
import { maxBy, some, sortBy } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getApiMediaLibrariesByLibraryIdQueryKey,
  getApiMediaSourcesQueryKey,
} from '../generated/@tanstack/react-query.gen.ts';
import {
  useLibraryScanState,
  useScanLibraryMutation,
  useUpdateLibraryMutation,
} from '../hooks/media-sources/mediaSourceLibraryHooks.ts';
import { useMediaSources } from '../hooks/settingsHooks.ts';
import { useDayjs } from '../hooks/useDayjs.ts';
import { useStoreBackedTableSettings } from '../hooks/useTableSettings.ts';
import { UnavailableLibraryIcon } from './UnavailableLibraryIndicator.tsx';
import { NetworkIcon } from './util/NetworkIcon.tsx';

type MediaSourceLibraryRow = MediaSourceLibrary & {
  mediaSource: MediaSourceSettings;
};

type ActionCellProps = {
  mediaSource: MediaSourceSettings;
  library: MediaSourceLibraryRow;
};

const MediaSourceLibraryTableActionCell = ({
  mediaSource,
  library,
}: ActionCellProps) => {
  const { t } = useLingui();
  const refreshLibraryMutation = useScanLibraryMutation();
  const isScanning = library.isLocked || refreshLibraryMutation.isPending;
  const scanStateQuery = useLibraryScanState(
    mediaSource.id,
    library.id,
    isScanning,
  );
  const scanState = scanStateQuery.data?.state;
  const scanStateUpdatedAt = scanStateQuery.dataUpdatedAt;

  const queryClient = useQueryClient();

  const startRefresh = useCallback(
    (ev: React.MouseEvent, force: boolean = false) => {
      ev.stopPropagation();
      ev.preventDefault();
      refreshLibraryMutation.mutate(
        {
          path: {
            id: library.mediaSource.id,
            libraryId: library.id,
          },
          query: {
            forceScan: force,
          },
        },
        {
          onSuccess: () => {
            queryClient
              .invalidateQueries({
                queryKey: getApiMediaLibrariesByLibraryIdQueryKey({
                  path: { libraryId: library.id },
                }),
                exact: false,
              })
              .catch(console.error);
          },
        },
      );
    },
    [library.id, library.mediaSource.id, queryClient, refreshLibraryMutation],
  );

  // The server reports not_scanning before it releases the library lock,
  // because post-scan work such as the collection scan still holds it.
  // Refetch media sources on every status poll until the lock clears.
  useEffect(() => {
    if (library.isLocked && scanState === 'not_scanning') {
      queryClient
        .invalidateQueries({ queryKey: getApiMediaSourcesQueryKey() })
        .catch(console.error);
    }
  }, [library.isLocked, queryClient, scanState, scanStateUpdatedAt]);

  return (
    <>
      <Tooltip
        placement="top"
        title={
          scanStateQuery.data?.state === 'queued'
            ? t`Queued`
            : library.isLocked
              ? t`Scanning`
              : t`Scan`
        }
      >
        <span>
          <IconButton
            size="small"
            disabled={library.isLocked}
            onClick={(e) => startRefresh(e)}
          >
            {scanStateQuery.data?.state === 'queued' ? (
              <HourglassTop />
            ) : (
              <Refresh
                sx={{
                  animation: library.isLocked
                    ? 'spin 2s linear infinite'
                    : undefined,
                }}
              />
            )}
          </IconButton>
        </span>
      </Tooltip>
      {!isScanning && (
        <Tooltip
          placement="top"
          title={
            scanStateQuery.data?.state === 'queued'
              ? t`Queued`
              : library.isLocked
                ? t`Scanning`
                : t`Force Scan`
          }
        >
          <span>
            <IconButton
              size="small"
              disabled={library.isLocked}
              onClick={(e) => startRefresh(e, true)}
            >
              <Radar
                sx={{
                  animation: library.isLocked
                    ? 'spin 2s linear infinite'
                    : undefined,
                }}
              />
            </IconButton>
          </span>
        </Tooltip>
      )}
      {isScanning && (
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            minWidth: '40px',
            textAlign: 'center',
          }}
        >
          {scanStateQuery.data?.state === 'in_progress'
            ? `${scanStateQuery.data.percentComplete.toFixed(0)}%`
            : null}
        </Box>
      )}
    </>
  );
};

const LibraryEnabledSwitch = ({
  library,
}: {
  library: MediaSourceLibraryRow;
}) => {
  const { t } = useLingui();
  const updateLibraryMutation = useUpdateLibraryMutation();

  if (library.type === 'local') {
    return null;
  }

  return (
    <Tooltip
      placement="top"
      title={
        library.isLocked
          ? t`Cannot disable libraries when they are locked`
          : library.enabled
            ? t`Stop syncing this library`
            : t`Sync this library to Tunarr`
      }
    >
      <span>
        <Switch
          disabled={library.isLocked}
          checked={library.enabled}
          onClick={(e) => e.stopPropagation()}
          onChange={(ev) =>
            updateLibraryMutation.mutate({
              path: {
                id: library.mediaSource.id,
                libraryId: library.id,
              },
              body: {
                enabled: ev.target.checked,
              },
            })
          }
        />
      </span>
    </Tooltip>
  );
};

const NotSyncedChip = () => (
  <Chip size="small" variant="outlined" label={<Trans>Not synced</Trans>} />
);

const TableName = 'MediaSourceLibraryTable';

export const MediaSourceLibraryTable = () => {
  const { t } = useLingui();
  const dayjs = useDayjs();
  const navigate = useNavigate();
  const { data: mediaSources } = useMediaSources();
  const tableSettings = useStoreBackedTableSettings(TableName);
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const [showDisabled, setShowDisabled] = useState(true);

  const navigateToLibrary = useCallback(
    (library: MediaSourceLibraryRow) => {
      // Disabled libraries have no synced content to browse.
      if (!library.enabled) {
        return;
      }
      navigate({
        to:
          library.type === 'local'
            ? '/media_sources/$mediaSourceId'
            : '/media_sources/$mediaSourceId/libraries/$libraryId',
        params: {
          mediaSourceId: library.mediaSource.id,
          libraryId: library.id,
        },
      }).catch(console.error);
    },
    [navigate],
  );

  const columns = useMemo<MRT_ColumnDef<MediaSourceLibraryRow>[]>(() => {
    return [
      {
        header: t`Sync`,
        id: 'enabled',
        Cell: ({ row }) => <LibraryEnabledSwitch library={row.original} />,
        enableSorting: false,
        enableColumnFilter: false,
        enableColumnActions: false,
        size: 90,
      },
      {
        header: t`Source`,
        id: 'source',
        accessorFn: ({ mediaSource }) => mediaSource.name,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <NetworkIcon
                network={row.original.mediaSource.type}
                sx={{ width: '100%', height: '100%' }}
              />
            </Box>
            {row.original.mediaSource.name}
          </Box>
        ),
        size: 200,
      },
      {
        header: t`Name`,
        id: 'name',
        // A local source has one row covering every folder it scans.
        accessorFn: (originalRow) =>
          originalRow.type === 'local' ? t`All folders` : originalRow.name,
        Cell: ({ renderedCellValue, row }) => (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 0.5,
            }}
          >
            {renderedCellValue}
            {!row.original.enabled && <NotSyncedChip />}
            {row.original.unavailableSince !== undefined && (
              <UnavailableLibraryIcon
                unavailableSince={row.original.unavailableSince}
              />
            )}
          </Box>
        ),
        size: 280,
      },
      {
        header: t`Media Type`,
        id: 'mediaType',
        accessorFn: ({ mediaType }) => prettifySnakeCaseString(mediaType),
        size: 120,
      },
      {
        header: t`Last Synced`,
        id: 'lastUpdated',
        accessorFn: ({ lastScannedAt }) =>
          lastScannedAt ? dayjs(lastScannedAt).format('LLL') : '-',
        size: 200,
      },
      {
        header: '',
        id: 'actions',
        size: 110,
        enableColumnFilter: false,
        enableColumnActions: false,
        muiTableBodyCellProps: {
          sx: {
            flexDirection: 'row',
          },
          align: 'right',
        },
        Cell: (props) => {
          if (!props.row.original.enabled) {
            return null;
          }
          return (
            <MediaSourceLibraryTableActionCell
              mediaSource={props.row.original.mediaSource}
              library={props.row.original}
            />
          );
        },
      },
    ];
  }, [dayjs, t]);

  const data = useMemo(() => {
    const remoteLibraries = mediaSources
      .filter((source) => source.type !== 'local')
      .flatMap((source) =>
        source.libraries.map((lib) => ({ ...lib, mediaSource: source })),
      )
      .filter((lib) => showDisabled || lib.enabled);
    const localLibraries = mediaSources
      .filter((source) => source.type === 'local')
      .map((source) => {
        return {
          id: 'all',
          enabled: true,
          externalKey: '',
          isLocked: some(source.libraries, (lib) => lib.isLocked),
          mediaSource: source,
          mediaType: source.mediaType,
          type: 'local',
          name: source.name,
          lastScannedAt: maxBy(source.libraries, (lib) => lib.lastScannedAt)
            ?.lastScannedAt,
          unavailableSince: undefined,
        } satisfies MediaSourceLibraryRow;
      });

    return sortBy(
      [...remoteLibraries, ...localLibraries],
      (lib) => !lib.enabled,
    );
  }, [mediaSources, showDisabled]);

  const renderMobileCards = () => (
    <Stack spacing={1}>
      {data.map((library) => (
        <Card
          key={`${library.mediaSource.id}-${library.id}`}
          variant="outlined"
          onClick={() => navigateToLibrary(library)}
          sx={{ cursor: library.enabled ? 'pointer' : 'default' }}
        >
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LibraryEnabledSwitch library={library} />
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  opacity: library.enabled ? 1 : 0.5,
                }}
              >
                <Typography variant="subtitle2" noWrap>
                  {library.type === 'local'
                    ? library.name
                    : `${library.mediaSource.name} \u2013 ${library.name}`}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mt: 0.25,
                    flexWrap: 'wrap',
                  }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <NetworkIcon
                      network={library.mediaSource.type}
                      sx={{ width: '100%', height: '100%' }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {prettifySnakeCaseString(library.mediaType)}
                  </Typography>
                  {library.lastScannedAt && (
                    <Typography variant="caption" color="text.secondary">
                      · {dayjs(library.lastScannedAt).format('ll')}
                    </Typography>
                  )}
                  {library.unavailableSince !== undefined && (
                    <UnavailableLibraryIcon
                      unavailableSince={library.unavailableSince}
                    />
                  )}
                  {!library.enabled && <NotSyncedChip />}
                </Box>
              </Box>
              {library.enabled && (
                <Box
                  sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <MediaSourceLibraryTableActionCell
                    mediaSource={library.mediaSource}
                    library={library}
                  />
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );

  const table = useMaterialReactTable({
    data,
    columns,
    // layoutMode: 'grid',
    // enableRowActions: true,
    displayColumnDefOptions: {
      'mrt-row-actions': {
        grow: true,
        Header: '',
        visibleInShowHideMenu: false,
        muiTableBodyCellProps: {
          sx: {
            flexDirection: 'row',
          },
          align: 'right',
        },
      },
    },
    renderRowActions: ({ row: { original } }) => (
      <MediaSourceLibraryTableActionCell
        mediaSource={original.mediaSource}
        library={original}
      />
    ),
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => navigateToLibrary(row.original),
      sx: {
        cursor: row.original.enabled ? 'pointer' : 'default',
      },
    }),
    muiTableBodyCellProps: ({ row, column }) => ({
      sx: {
        opacity: !row.original.enabled && column.id !== 'enabled' ? 0.5 : 1,
      },
    }),
    positionActionsColumn: 'last',
    ...tableSettings,
    state: {
      ...tableSettings.state,
      columnVisibility: {
        ...tableSettings.state?.columnVisibility,
        source: !smallViewport,
        lastUpdated: !smallViewport,
      },
    },
  });

  return (
    <>
      <FormControlLabel
        control={
          <Switch
            checked={showDisabled}
            onChange={(ev) => setShowDisabled(ev.target.checked)}
          />
        }
        label={<Trans>Show disabled libraries</Trans>}
      />
      {smallViewport ? (
        renderMobileCards()
      ) : (
        <TableContainer component={Paper} sx={{ width: '100%' }}>
          <MaterialReactTable table={table} />
        </TableContainer>
      )}
      <Typography variant="body2" align="center">
        <Trans>
          Tunarr only syncs content from enabled libraries. Turn on a library's
          switch to sync it, or manage sources in{' '}
          <MuiLink component={Link} to="/settings/sources">
            Media Source Settings.
          </MuiLink>
        </Trans>
      </Typography>
    </>
  );
};
