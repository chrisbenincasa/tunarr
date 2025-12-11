import {
  HourglassTop,
  Radar,
  Refresh,
  VideoLibrary,
} from '@mui/icons-material';
import {
  Box,
  IconButton,
  Link as MuiLink,
  Paper,
  TableContainer,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { prettifySnakeCaseString } from '@tunarr/shared/util';
import type { MediaSourceLibrary, MediaSourceSettings } from '@tunarr/types';
import type { ScanProgress } from '@tunarr/types/api';
import { capitalize, maxBy, some } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';
import {
  getApiMediaLibrariesByLibraryIdQueryKey,
  getApiMediaSourcesByMediaSourceIdByLibraryIdStatusOptions,
  getApiMediaSourcesQueryKey,
} from '../generated/@tanstack/react-query.gen.ts';
import {
  useLibraryScanState,
  useScanLibraryMutation,
} from '../hooks/media-sources/mediaSourceLibraryHooks.ts';
import { useMediaSources } from '../hooks/settingsHooks.ts';
import { useDayjs } from '../hooks/useDayjs.ts';
import { useQueryObserver } from '../hooks/useQueryObserver.ts';
import type { Nullable } from '../types/util.ts';
import { RouterIconButtonLink } from './base/RouterButtonLink.tsx';

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
  const [isRefreshing, setIsRefreshing] = useState(library.isLocked);
  const refreshLibraryMutation = useScanLibraryMutation();
  const scanStateQuery = useLibraryScanState(
    mediaSource.id,
    library.id,
    isRefreshing,
  );
  const [prevScanState, setPrevScanState] =
    useState<Nullable<ScanProgress['state']>>(null);

  const queryClient = useQueryClient();

  const startRefresh = useCallback(
    (force: boolean = false) => {
      setIsRefreshing(true);
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

  const opts = useMemo(
    () =>
      getApiMediaSourcesByMediaSourceIdByLibraryIdStatusOptions({
        path: {
          mediaSourceId: mediaSource.id,
          libraryId: library.id,
        },
      }),
    [library.id, mediaSource.id],
  );

  useQueryObserver(
    opts,
    useCallback(
      (result) => {
        if (result.status !== 'success') {
          return;
        }

        if (!isRefreshing) {
          return;
        }

        if (
          (prevScanState === 'in_progress' || prevScanState === 'queued') &&
          result.data?.state === 'not_scanning'
        ) {
          setIsRefreshing(false);
          setPrevScanState(null);
          queryClient
            .invalidateQueries({
              queryKey: getApiMediaSourcesQueryKey(),
            })
            .catch(console.error);
        } else {
          setPrevScanState(result.data.state);
        }
      },
      [isRefreshing, prevScanState, queryClient],
    ),
  );

  return (
    <>
      <Tooltip placement="top" title="View Library">
        {mediaSource.type === 'local' ? (
          <RouterIconButtonLink
            to="/media_sources/$mediaSourceId"
            params={{ mediaSourceId: mediaSource.id }}
          >
            <VideoLibrary />
          </RouterIconButtonLink>
        ) : (
          <RouterIconButtonLink
            to={'/media_sources/$mediaSourceId/libraries/$libraryId'}
            params={{ mediaSourceId: mediaSource.id, libraryId: library.id }}
          >
            <VideoLibrary />
          </RouterIconButtonLink>
        )}
      </Tooltip>
      <Tooltip
        placement="top"
        title={
          scanStateQuery.data?.state === 'queued'
            ? 'Queued'
            : library.isLocked
              ? 'Scanning'
              : 'Scan'
        }
      >
        <span>
          <IconButton
            disabled={library.isLocked}
            onClick={() => startRefresh()}
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
      {!isRefreshing && (
        <Tooltip
          placement="top"
          title={
            scanStateQuery.data?.state === 'queued'
              ? 'Queued'
              : library.isLocked
                ? 'Scanning'
                : 'Force Scan'
          }
        >
          <span>
            <IconButton
              disabled={library.isLocked}
              onClick={() => startRefresh(true)}
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
      {isRefreshing && (
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            minWidth: '40px',
            textAlign: 'center',
          }}
        >
          {`${(scanStateQuery.data?.state === 'in_progress' ? scanStateQuery.data.percentComplete : 0).toFixed(0)}%`}
        </Box>
      )}
    </>
  );
};

export const MediaSourceLibraryTable = () => {
  const dayjs = useDayjs();
  const { data: mediaSources } = useMediaSources();

  const columns = useMemo<MRT_ColumnDef<MediaSourceLibraryRow>[]>(() => {
    return [
      {
        header: 'Source Type',
        id: 'type',
        accessorFn: ({ type }) => capitalize(type),
        // size: 100,
        enableSorting: false,
        grow: false,
      },
      {
        header: 'Name',
        id: 'name',
        accessorFn(originalRow) {
          if (originalRow.type === 'local') {
            return originalRow.name;
          } else {
            return `${originalRow.mediaSource.name} - ${originalRow.name}`;
          }
        },
        // size: 150,
        // grow: false,
      },
      {
        header: 'Media Type',
        id: 'mediaType',
        accessorFn: ({ mediaType }) => prettifySnakeCaseString(mediaType),
        // size: 150,
        // grow: false,
      },
      {
        header: 'Last Synced',
        id: 'lastUpdated',
        accessorFn: ({ lastScannedAt }) =>
          lastScannedAt ? dayjs(lastScannedAt).format('LLL') : '-',
      },
      {
        header: '',
        id: 'actions',
        grow: true,
        enableColumnFilter: false,
        enableColumnActions: false,
        muiTableBodyCellProps: {
          sx: {
            flexDirection: 'row',
          },
          align: 'right',
        },
        Cell: (props) => {
          return (
            <MediaSourceLibraryTableActionCell
              mediaSource={props.row.original.mediaSource}
              library={props.row.original}
            />
          );
        },
      },
    ];
  }, [dayjs]);

  const data = useMemo(() => {
    const remoteLibraries = mediaSources
      .filter((source) => source.type !== 'local')
      .flatMap((source) =>
        source.libraries.map((lib) => ({ ...lib, mediaSource: source })),
      )
      .filter((lib) => lib.enabled);
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
        } satisfies MediaSourceLibraryRow;
      });

    return [...remoteLibraries, ...localLibraries];
  }, [mediaSources]);

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
    positionActionsColumn: 'last',
  });

  return (
    <>
      <TableContainer component={Paper} sx={{ width: '100%' }}>
        <MaterialReactTable table={table} />
      </TableContainer>
      <Typography variant="body2" align="center">
        Don't see the library you want here? Ensure it is enabled in the{' '}
        <MuiLink component={Link} to="/settings/sources">
          Media Source Settings.
        </MuiLink>
      </Typography>
    </>
  );
};
