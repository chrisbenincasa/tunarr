import { AddMediaSourceButton } from '@/components/settings/media_source/AddMediaSourceButton.tsx';

import { useMediaSources } from '@/hooks/settingsHooks.ts';
import { Delete, Edit, Refresh, VideoLibrary } from '@mui/icons-material';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { MediaSourceSettings } from '@tunarr/types';
import type { GlobalMediaSourceSettings } from '@tunarr/types/schemas';
import { capitalize } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useSnackbar } from 'notistack';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { DeleteConfirmationDialog } from '../../components/DeleteConfirmationDialog.tsx';
import { EditMediaSourceLibrariesDialog } from '../../components/settings/media_source/EditMediaSourceLibrariesDialog.tsx';
import { EmbyServerEditDialog } from '../../components/settings/media_source/EmbyServerEditDialog.tsx';
import { JellyfinServerEditDialog } from '../../components/settings/media_source/JelllyfinServerEditDialog.tsx';
import { LocalMediaEditDialog } from '../../components/settings/media_source/LocalMediaEditDialog.tsx';
import { MediaSourceHealthyTableCell } from '../../components/settings/media_source/MediaSourceHealthyTableCell.tsx';
import { PlexServerEditDialog } from '../../components/settings/media_source/PlexServerEditDialog.tsx';
import { NumericFormControllerText } from '../../components/util/TypedController.tsx';
import {
  deleteApiMediaSourcesByIdMutation,
  getApiSettingsMediaSourceOptions,
  postApiMediaSourcesByIdLibrariesRefreshMutation,
  putApiSettingsMediaSourceMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';
import type { Nullable } from '../../types/util.ts';

export default function MediaSourceSettingsPage() {
  const { data: servers } = useMediaSources();
  const { data: mediaSourceSettings } = useSuspenseQuery(
    getApiSettingsMediaSourceOptions(),
  );

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

  const refreshLibrariesMutation = useMutation({
    ...postApiMediaSourcesByIdLibrariesRefreshMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
    },
  });

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
        header: 'Healthy?',
        id: 'isHealthy',
        Cell: ({ row }) => (
          <MediaSourceHealthyTableCell mediaSource={row.original} />
        ),
        enableSorting: false,
        grow: false,
        // size: 40,
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

  const snackbar = useSnackbar();

  const settingsForm = useForm<GlobalMediaSourceSettings>({
    defaultValues: mediaSourceSettings,
  });

  const updateMediaSourceSettingsMut = useMutation({
    ...putApiSettingsMediaSourceMutation(),
    onSuccess: (returned) => {
      settingsForm.reset(returned);
      snackbar.enqueueSnackbar({
        variant: 'success',
        message: 'Successfully updated Media Source settings.',
      });
    },
    onError: (err) => {
      console.error(err);
      snackbar.enqueueSnackbar({
        variant: 'error',
        message:
          'Failed to update Media Source settings. Please check server and browser logs for details.',
      });
    },
  });

  const onSubmit = useCallback(
    (data: GlobalMediaSourceSettings) => {
      updateMediaSourceSettingsMut.mutate({
        body: data,
      });
    },
    [updateMediaSourceSettingsMut],
  );

  const onError = useCallback(() => {
    snackbar.enqueueSnackbar({
      variant: 'error',
      message:
        'There was an error submitting the request to update Media Source settings. Please check the form and try again',
    });
  }, [snackbar]);

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
              Jellyfin. At least one Media Source is necessary to create channels
              and play media in Tunarr.
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 1 }}></Box>
          <MaterialReactTable table={table} />
        </Box>
        <Box
          component="form"
          onSubmit={settingsForm.handleSubmit(onSubmit, onError)}
        >
          <Stack gap={2}>
            <Typography variant="h5">Scanner Settings</Typography>
            <NumericFormControllerText
              control={settingsForm.control}
              name="rescanIntervalHours"
              prettyFieldName="Rescan Interval (hours)"
              TextFieldProps={{
                label: 'Rescan Interval (hours)',
                helperText:
                  'How frequently libraries should be scanned (starting from midnight).',
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                disabled={!settingsForm.formState.isDirty}
              >
                Save
              </Button>
            </Box>
          </Stack>
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
        title={`Delete Media Source "${deletingMediaSource?.name}?"`}
        body="Deleting a media source will remove all of its associated programs from Tunarr."
        onConfirm={() =>
          deleteMediaSourceMut.mutate({
            path: { id: deletingMediaSource!.id },
          })
        }
      />
    </>
  );
}
