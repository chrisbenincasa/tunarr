import UnsavedNavigationAlert from '@/components/settings/UnsavedNavigationAlert.tsx';
import { AddMediaSourceButton } from '@/components/settings/media_source/AddMediaSourceButton.tsx';

import {
  useMediaSources,
  usePlexStreamSettings,
} from '@/hooks/settingsHooks.ts';
import { Delete, Edit, Refresh, VideoLibrary } from '@mui/icons-material';
import {
  Box,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MediaSourceSettings, PlexStreamSettings } from '@tunarr/types';
import { defaultPlexStreamSettings } from '@tunarr/types';
import { capitalize } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useSnackbar } from 'notistack';
import { useEffect, useMemo, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { DeleteConfirmationDialog } from '../../components/DeleteConfirmationDialog.tsx';
import { EditMediaSourceLibrariesDialog } from '../../components/settings/media_source/EditMediaSourceLibrariesDialog.tsx';
import { EmbyServerEditDialog } from '../../components/settings/media_source/EmbyServerEditDialog.tsx';
import { JellyfinServerEditDialog } from '../../components/settings/media_source/JelllyfinServerEditDialog.tsx';
import { LocalMediaEditDialog } from '../../components/settings/media_source/LocalMediaEditDialog.tsx';
import { MediaSourceHealthyTableCell } from '../../components/settings/media_source/MediaSourceHealthyTableCell.tsx';
import { PlexServerEditDialog } from '../../components/settings/media_source/PlexServerEditDialog.tsx';
import {
  deleteApiMediaSourcesByIdMutation,
  postApiMediaSourcesByIdLibrariesRefreshMutation,
  putApiPlexSettingsMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';
import type { Nullable } from '../../types/util.ts';

export default function MediaSourceSettingsPage() {
  const serverQuery = useMediaSources();
  const { data: servers, error: serversError } = serverQuery;

  const { data: streamSettings, error: streamsError } = usePlexStreamSettings();

  const snackbar = useSnackbar();

  const [editingMediaSource, setEditingMediaSource] =
    useState<Nullable<MediaSourceSettings>>(null);
  const [editingMediaSourceLibraries, setEditingMediaSourceLibraries] =
    useState<Nullable<MediaSourceSettings>>(null);
  const [deletingMediaSource, setDeletingMediaSource] =
    useState<Nullable<MediaSourceSettings>>(null);

  const {
    reset,
    formState: { isDirty },
    watch,
    handleSubmit,
  } = useForm<PlexStreamSettings>({
    defaultValues: defaultPlexStreamSettings,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (streamSettings) {
      reset({
        ...streamSettings,
      });
    }
  }, [streamSettings, reset]);

  const queryClient = useQueryClient();

  const updatePlexStreamingSettingsMutation = useMutation({
    ...putApiPlexSettingsMutation(),
    onSuccess: (data) => {
      snackbar.enqueueSnackbar('Settings Saved!', {
        variant: 'success',
      });
      reset(data, { keepValues: true });
      return queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Settings'),
      });
    },
  });

  const deleteMediaSourceMut = useMutation({
    ...deleteApiMediaSourcesByIdMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
    },
  });

  const refreshLibrariesMutation = useMutation({
    ...postApiMediaSourcesByIdLibrariesRefreshMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
    },
  });

  const updatePlexStreamSettings: SubmitHandler<PlexStreamSettings> = (
    streamSettings,
  ) => {
    updatePlexStreamingSettingsMutation.mutate({
      body: {
        ...streamSettings,
      },
    });
  };

  const columns = useMemo<MRT_ColumnDef<MediaSourceSettings>[]>(() => {
    return [
      {
        header: 'Type',
        id: 'type',
        accessorFn: ({ type }) => capitalize(type),
        size: 100,
        grow: false,
        enableSorting: false,
      },
      {
        header: 'Name',
        accessorKey: 'name',
        size: 150,
        grow: false,
      },
      {
        header: 'URL',
        accessorKey: 'uri',
        Cell: ({ cell, row }) =>
          row.original.type === 'local' ? (
            '-'
          ) : (
            <Link href={cell.getValue<string>()} target="_blank">
              {cell.getValue<string>()}
            </Link>
          ),
        grow: true,
      },
      {
        header: 'Healthy?',
        id: 'isHealthy',
        Cell: ({ row }) => (
          <MediaSourceHealthyTableCell mediaSource={row.original} />
        ),
        enableSorting: false,
        grow: false,
        size: 150,
      },
    ];
  }, []);

  const table = useMaterialReactTable({
    data: servers,
    columns: columns,
    enableRowActions: true,
    layoutMode: 'grid',
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
    renderRowActions: ({ row }) => {
      return (
        <>
          <Tooltip title="Edit Media Source" placement="top">
            <IconButton onClick={() => setEditingMediaSource(row.original)}>
              <Edit />
            </IconButton>
          </Tooltip>
          {row.original.type !== 'local' && (
            <>
              <Tooltip title="Refresh Libraries" placement="top">
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
              <Tooltip title="Edit Libraries" placement="top">
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

  // This is messy, lets consider getting rid of combine, it probably isnt useful here
  if (serversError || streamsError) {
    return <h1>Error: {(serversError ?? streamsError)!.message}</h1>;
  }

  return (
    <Box component="form" onSubmit={handleSubmit(updatePlexStreamSettings)}>
      <Box>
        <Box mb={2}>
          <Stack
            spacing={1}
            direction="row"
            useFlexGap
            sx={{ flexWrap: 'wrap' }}
          >
            <Typography
              variant="h5"
              sx={(theme) => ({
                flexGrow: 1,
                [theme.breakpoints.down('sm')]: {
                  width: '100%',
                },
              })}
            >
              Media Sources
            </Typography>
            <AddMediaSourceButton />
            <Box sx={{ flexBasis: '100%', width: 0 }}></Box>
            <Typography sx={{ width: '60%' }}>
              Media Sources are where Tunarr sources your content. Media can
              come from your filesystem or a remote server, like Plex or
              Jellyfin. At leat one Media Source is necessary to create channels
              and play media in Tunarr.
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 1 }}></Box>
          <MaterialReactTable table={table} />
        </Box>
        <UnsavedNavigationAlert isDirty={isDirty} />
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
          title={`Delete Media Source "${deletingMediaSource?.name}?"`}
          onConfirm={() =>
            deleteMediaSourceMut.mutate({
              path: { id: deletingMediaSource!.id },
            })
          }
        />
      </Box>
    </Box>
  );
}
