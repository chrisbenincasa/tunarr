import { AddMediaSourceButton } from '@/components/settings/media_source/AddMediaSourceButton.tsx';

import { useMediaSources } from '@/hooks/settingsHooks.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import { Delete, Edit, Refresh, VideoLibrary } from '@mui/icons-material';
import {
  Box,
  Divider,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MediaSourceSettings } from '@tunarr/types';
import { capitalize } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useMemo, useState } from 'react';
import { DeleteConfirmationDialog } from '../../components/DeleteConfirmationDialog.tsx';
import { EditMediaSourceLibrariesDialog } from '../../components/settings/media_source/EditMediaSourceLibrariesDialog.tsx';
import { EmbyServerEditDialog } from '../../components/settings/media_source/EmbyServerEditDialog.tsx';
import { JellyfinServerEditDialog } from '../../components/settings/media_source/JelllyfinServerEditDialog.tsx';
import { LocalMediaEditDialog } from '../../components/settings/media_source/LocalMediaEditDialog.tsx';
import { MediaSourceHealthyTableCell } from '../../components/settings/media_source/MediaSourceHealthyTableCell.tsx';
import { PlexServerEditDialog } from '../../components/settings/media_source/PlexServerEditDialog.tsx';
import {
  deleteMediaSourceMutation,
  refreshMediaSourceLibrariesMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';
import { useStoreBackedTableSettings } from '../../hooks/useTableSettings.ts';
import type { Nullable } from '../../types/util.ts';

export default function MediaSourceSettingsPage() {
  const { t } = useLingui();
  const { data: servers } = useMediaSources();
  const tableState = useStoreBackedTableSettings('MediaSourceSettings');

  const [editingMediaSource, setEditingMediaSource] =
    useState<Nullable<MediaSourceSettings>>(null);
  const [editingMediaSourceLibraries, setEditingMediaSourceLibraries] =
    useState<Nullable<MediaSourceSettings>>(null);
  const [deletingMediaSource, setDeletingMediaSource] =
    useState<Nullable<MediaSourceSettings>>(null);

  const queryClient = useQueryClient();

  const deleteMediaSourceMut = useMutation({
    ...deleteMediaSourceMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
    },
  });

  const refreshLibrariesMutation = useMutation({
    ...refreshMediaSourceLibrariesMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
    },
  });

  const columns = useMemo<MRT_ColumnDef<MediaSourceSettings>[]>(() => {
    return [
      {
        header: t`Type`,
        id: 'type',
        accessorFn: ({ type }) => capitalize(type),
        size: 100,
        grow: false,
        enableSorting: false,
      },
      {
        header: t`Name`,
        accessorKey: 'name',
        size: 150,
        grow: false,
      },
      {
        header: t`URL`,
        accessorKey: 'uri',
        Cell: ({ cell, row }) =>
          row.original.type === 'local' ? (
            '-'
          ) : (
            <Link
              href={cell.getValue<string>()}
              sx={{
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
              target="_blank"
            >
              {cell.getValue<string>()}
            </Link>
          ),
        grow: true,
      },
      {
        header: t`Healthy?`,
        id: 'isHealthy',
        Cell: ({ row }) => (
          <MediaSourceHealthyTableCell mediaSource={row.original} />
        ),
        enableSorting: false,
        grow: false,
        // size: 40,
      },
    ];
  }, [t]);

  const table = useMaterialReactTable({
    data: servers,
    columns: columns,
    enableRowActions: true,
    layoutMode: 'grid',
    displayColumnDefOptions: {
      'mrt-row-actions': {
        grow: false,
        Header: '',
        visibleInShowHideMenu: false,
        size: 160,
        muiTableBodyCellProps: {
          sx: {
            flexDirection: 'row',
          },
          align: 'right',
        },
      },
    },
    ...tableState,
    renderRowActions: ({ row }) => {
      return (
        <>
          <Tooltip title={t`Edit Media Source`} placement="top">
            <IconButton onClick={() => setEditingMediaSource(row.original)}>
              <Edit />
            </IconButton>
          </Tooltip>
          {row.original.type !== 'local' && (
            <>
              <Tooltip title={t`Refresh Libraries`} placement="top">
                <IconButton
                  onClick={() =>
                    refreshLibrariesMutation.mutate({
                      path: {
                        id: row.original.id,
                      },
                    })
                  }
                >
                  <Refresh />
                </IconButton>
              </Tooltip>
              <Tooltip title={t`Edit Libraries`} placement="top">
                <IconButton
                  onClick={() => setEditingMediaSourceLibraries(row.original)}
                >
                  <VideoLibrary />
                </IconButton>
              </Tooltip>
            </>
          )}
          <IconButton onClick={() => setDeletingMediaSource(row.original)}>
            <Delete />
          </IconButton>
        </>
      );
    },
    positionActionsColumn: 'last',
  });

  return (
    <>
      <Stack divider={<Divider />} gap={2}>
        <Box>
          <Stack
            spacing={1}
            direction="row"
            useFlexGap
            sx={{ flexWrap: 'wrap' }}
          >
            <Typography
              variant="h3"
              sx={(theme) => ({
                flexGrow: 1,
                [theme.breakpoints.down('sm')]: {
                  width: '100%',
                },
              })}
            >
              <Trans>Media Sources</Trans>
            </Typography>
            <AddMediaSourceButton />
            <Box sx={{ flexBasis: '100%', width: 0 }}></Box>
            <Typography sx={{ width: '60%' }}>
              <Trans>
                Media Sources are where Tunarr sources your content. Media can
                come from your filesystem or a remote server, like Plex or
                Jellyfin. At least one Media Source is necessary to create
                channels and play media in Tunarr.
              </Trans>
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 1 }}></Box>
          <MaterialReactTable table={table} />
        </Box>
      </Stack>
      {editingMediaSource?.type === 'plex' && (
        <PlexServerEditDialog
          open
          onClose={() => setEditingMediaSource(null)}
          server={editingMediaSource}
        />
      )}
      {editingMediaSource?.type === 'jellyfin' && (
        <JellyfinServerEditDialog
          open
          onClose={() => setEditingMediaSource(null)}
          server={editingMediaSource}
        />
      )}
      {editingMediaSource?.type === 'emby' && (
        <EmbyServerEditDialog
          open
          onClose={() => setEditingMediaSource(null)}
          server={editingMediaSource}
        />
      )}
      {editingMediaSource?.type === 'local' && (
        <LocalMediaEditDialog
          open
          onClose={() => setEditingMediaSource(null)}
          source={editingMediaSource}
        />
      )}
      <EditMediaSourceLibrariesDialog
        open={!!editingMediaSourceLibraries}
        mediaSource={editingMediaSourceLibraries}
        onClose={() => setEditingMediaSourceLibraries(null)}
      />
      <DeleteConfirmationDialog
        open={!!deletingMediaSource}
        onClose={() => setDeletingMediaSource(null)}
        title={t`Delete Media Source "${deletingMediaSource?.name}"?`}
        body={t`Deleting a media source will remove all of its associated programs from Tunarr.`}
        onConfirm={() =>
          deleteMediaSourceMut.mutate({
            path: { id: deletingMediaSource!.id },
          })
        }
      />
    </>
  );
}
