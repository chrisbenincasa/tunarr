import { Radar, Refresh, VideoLibrary } from '@mui/icons-material';
import { Box, IconButton, Tooltip } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from '@tanstack/react-router';
import { prettifySnakeCaseString } from '@tunarr/shared/util';
import type { MediaSourceLibrary, MediaSourceSettings } from '@tunarr/types';
import { usePrevious } from '@uidotdev/usehooks';
import { capitalize, isEqual } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useLibraryScanState,
  useRefreshLibraryMutation,
} from '../hooks/media-sources/mediaSourceLibraryHooks.ts';
import {
  MediaSourcesQueryKey,
  useMediaSources,
} from '../hooks/settingsHooks.ts';
import { useDayjs } from '../hooks/useDayjs.ts';

type MediaSourceLibraryRow = MediaSourceLibrary & {
  mediaSource: MediaSourceSettings;
};

type ActionCellProps = {
  library: MediaSourceLibraryRow;
};

const MediaSourceLibraryTableActionCell = ({ library }: ActionCellProps) => {
  const [isRefreshing, setIsRefreshing] = useState(library.isLocked);
  const refreshLibraryMutation = useRefreshLibraryMutation();
  const scanStateQuery = useLibraryScanState(library.id, isRefreshing);
  const prevScanState = usePrevious(scanStateQuery.data);
  const queryClient = useQueryClient();

  const startRefresh = useCallback(
    (force: boolean = false) => {
      setIsRefreshing(true);
      refreshLibraryMutation.mutate(
        {
          libraryId: library.id,
          mediaSourceId: library.mediaSource.id,
          forceScan: force,
        },
        {
          onSuccess: () => {
            queryClient
              .invalidateQueries({
                queryKey: ['media-source-library', library.id],
                exact: false,
              })
              .catch(console.error);
          },
        },
      );
    },
    [library.id, library.mediaSource.id, queryClient, refreshLibraryMutation],
  );

  useEffect(() => {
    if (
      prevScanState?.state === 'in_progress' &&
      scanStateQuery.data?.state === 'not_scanning'
    ) {
      setIsRefreshing(false);
      queryClient
        .invalidateQueries({
          predicate(query) {
            return (
              isEqual(query.queryKey, MediaSourcesQueryKey) ||
              isEqual(query.queryKey.slice(0, 2), [
                'media-source-library',
                library.id,
              ])
            );
          },
        })
        .catch(console.error);
    }
  }, [
    library.id,
    prevScanState?.state,
    queryClient,
    scanStateQuery.data?.state,
  ]);

  return (
    <>
      <Tooltip placement="top" title="View Library">
        <IconButton component={RouterLink} to={`/library/${library.id}`}>
          <VideoLibrary />
        </IconButton>
      </Tooltip>
      <Tooltip placement="top" title="Scan">
        <span>
          <IconButton
            disabled={library.isLocked}
            onClick={() => startRefresh()}
          >
            <Refresh
              sx={{
                animation: library.isLocked
                  ? 'spin 2s linear infinite'
                  : undefined,
              }}
            />
          </IconButton>
        </span>
      </Tooltip>
      {!isRefreshing && (
        <Tooltip placement="top" title="Force Scan">
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
      {(isRefreshing || scanStateQuery.data?.state === 'in_progress') && (
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

  const refreshLibraryMutation = useRefreshLibraryMutation();

  const columns = useMemo<MRT_ColumnDef<MediaSourceLibraryRow>[]>(() => {
    return [
      {
        header: 'Source Type',
        id: 'type',
        accessorFn: ({ type }) => capitalize(type),
        size: 100,
        enableSorting: false,
      },
      {
        header: 'Source Name',
        id: 'sourceName',
        accessorFn: ({ mediaSource: { name } }) => name,
        size: 150,
        grow: false,
      },
      {
        header: 'Name',
        accessorKey: 'name',
        size: 150,
        grow: false,
      },
      {
        header: 'Media Type',
        id: 'mediaType',
        accessorFn: ({ mediaType }) => prettifySnakeCaseString(mediaType),
        size: 150,
        grow: false,
      },
      {
        header: 'Last Synced',
        id: 'lastUpdated',
        accessorFn: ({ lastScannedAt }) =>
          lastScannedAt ? dayjs(lastScannedAt).format('LLL') : '-',
      },
    ];
  }, [dayjs]);

  const data = useMemo(
    () =>
      mediaSources
        .flatMap((source) =>
          source.libraries.map((lib) => ({ ...lib, mediaSource: source })),
        )
        .filter((lib) => lib.enabled),
    [mediaSources],
  );

  const table = useMaterialReactTable({
    data,
    columns,
    layoutMode: 'grid',
    enableRowActions: true,
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
    renderRowActions: ({ row: { original: library } }) => (
      <MediaSourceLibraryTableActionCell library={library} />
    ),
    positionActionsColumn: 'last',
  });

  return <MaterialReactTable table={table} />;
};
