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
import { useMemo, useState } from 'react';
import { DeleteConfirmationDialog } from '../../components/DeleteConfirmationDialog.tsx';
import { EditMediaSourceLibrariesDialog } from '../../components/settings/media_source/EditMediaSourceLibrariesDialog.tsx';
import { EmbyServerEditDialog } from '../../components/settings/media_source/EmbyServerEditDialog.tsx';
import { JellyfinServerEditDialog } from '../../components/settings/media_source/JelllyfinServerEditDialog.tsx';
import { LocalMediaEditDialog } from '../../components/settings/media_source/LocalMediaEditDialog.tsx';
import { MediaSourceLibrariesChip } from '../../components/settings/media_source/MediaSourceLibrariesChip.tsx';
import { MediaSourceHealthyTableCell } from '../../components/settings/media_source/MediaSourceHealthyTableCell.tsx';
import { PlexServerEditDialog } from '../../components/settings/media_source/PlexServerEditDialog.tsx';
import { DataTable } from '../../components/ui/table/DataTable.tsx';
import { actionsColumn } from '../../components/ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../../components/ui/table/tunarrTable.ts';
import { useStoreBackedTableSettings } from '../../components/ui/table/useStoreBackedTableSettings.ts';
import {
  deleteApiMediaSourcesByIdMutation,
  postApiMediaSourcesByIdLibrariesRefreshMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';
import type { Nullable } from '../../types/util.ts';

const columnHelper = createAppColumnHelper<MediaSourceSettings>();

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
    ...deleteApiMediaSourcesByIdMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
    },
  });

  const { mutate: refreshLibraries } = useMutation({
    ...postApiMediaSourcesByIdLibrariesRefreshMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
    },
  });

  const columns = useMemo(
    () => [
      ...columnHelper.columns([
        columnHelper.accessor(({ type }) => capitalize(type), {
          id: 'type',
          header: t`Type`,
          enableSorting: false,
        }),
        columnHelper.accessor('name', { header: t`Name` }),
        columnHelper.accessor('uri', {
          header: t`URL`,
          cell: ({ getValue, row }) =>
            row.original.type === 'local' ? (
              '-'
            ) : (
              <Link
                href={getValue()}
                sx={{
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                target="_blank"
              >
                {getValue()}
              </Link>
            ),
        }),
        columnHelper.display({
          id: 'libraries',
          header: t`Libraries`,
          cell: ({ row }) => (
            <MediaSourceLibrariesChip
              mediaSource={row.original}
              onClick={() => setEditingMediaSourceLibraries(row.original)}
            />
          ),
        }),
        columnHelper.display({
          id: 'isHealthy',
          header: t`Healthy?`,
          cell: ({ row }) => (
            <MediaSourceHealthyTableCell mediaSource={row.original} />
          ),
        }),
      ]),
      actionsColumn<MediaSourceSettings>({
        render: ({ original: source }) => (
          <>
            <Tooltip title={t`Edit Media Source`} placement="top">
              <IconButton
                aria-label={t`Edit Media Source`}
                onClick={() => setEditingMediaSource(source)}
              >
                <Edit />
              </IconButton>
            </Tooltip>
            {source.type !== 'local' && (
              <>
                <Tooltip title={t`Refresh Libraries`} placement="top">
                  <IconButton
                    aria-label={t`Refresh Libraries`}
                    onClick={() =>
                      refreshLibraries({
                        path: {
                          id: source.id,
                        },
                      })
                    }
                  >
                    <Refresh />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t`Edit Libraries`} placement="top">
                  <IconButton
                    aria-label={t`Edit Libraries`}
                    onClick={() => setEditingMediaSourceLibraries(source)}
                  >
                    <VideoLibrary />
                  </IconButton>
                </Tooltip>
              </>
            )}
            <IconButton
              aria-label={t`Delete`}
              onClick={() => setDeletingMediaSource(source)}
            >
              <Delete />
            </IconButton>
          </>
        ),
      }),
    ],
    [refreshLibraries, t],
  );

  const table = useTunarrTable({
    columns,
    data: servers,
    ...tableState,
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
          <DataTable table={table} aria-label={t`Media Sources`} />
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
        onConfirm={() => {
          if (deletingMediaSource) {
            deleteMediaSourceMut.mutate({
              path: { id: deletingMediaSource.id },
            });
          }
        }}
      />
    </>
  );
}
