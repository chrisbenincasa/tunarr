import UnsavedNavigationAlert from '@/components/settings/UnsavedNavigationAlert.tsx';
import { AddMediaSourceButton } from '@/components/settings/media_source/AddMediaSourceButton.tsx';
import {
  CheckboxFormController,
  TypedController,
} from '@/components/util/TypedController.tsx';
import {
  useMediaSources,
  usePlexStreamSettings,
} from '@/hooks/settingsHooks.ts';
import { Delete, Edit, Refresh, VideoLibrary } from '@mui/icons-material';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MediaSourceSettings, PlexStreamSettings } from '@tunarr/types';
import { defaultPlexStreamSettings } from '@tunarr/types';
import { capitalize, isEqual } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useSnackbar } from 'notistack';
import { useEffect, useMemo, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { EditMediaSourceLibrariesDialog } from '../../components/settings/media_source/EditMediaSourceLibrariesDialog.tsx';
import { EmbyServerEditDialog } from '../../components/settings/media_source/EmbyServerEditDialog.tsx';
import { JellyfinServerEditDialog } from '../../components/settings/media_source/JelllyfinServerEditDialog.tsx';
import { MediaSourceHealthyTableCell } from '../../components/settings/media_source/MediaSourceHealthyTableCell.tsx';
import { PlexServerEditDialog } from '../../components/settings/media_source/PlexServerEditDialog.tsx';
import {
  postApiMediaSourcesByIdLibrariesRefreshMutation,
  putApiPlexSettingsMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';
import type { Nullable } from '../../types/util.ts';

const supportedPaths = [
  { value: 'network', string: 'Network' },
  { value: 'direct', string: 'Direct' },
];

export default function MediaSourceSettingsPage() {
  const [restoreTunarrDefaults, setRestoreTunarrDefaults] = useState(false);

  const serverQuery = useMediaSources();
  const { data: servers, error: serversError } = serverQuery;

  const { data: streamSettings, error: streamsError } = usePlexStreamSettings();

  const snackbar = useSnackbar();

  const [editingMediaSource, setEditingMediaSource] =
    useState<Nullable<MediaSourceSettings>>(null);
  const [editingMediaSourceLibraries, setEditingMediaSourceLibraries] =
    useState<Nullable<MediaSourceSettings>>(null);

  const {
    reset,
    control,
    formState: { isDirty, isValid, isSubmitting, defaultValues },
    watch,
    handleSubmit,
  } = useForm<PlexStreamSettings>({
    defaultValues: defaultPlexStreamSettings,
    mode: 'onBlur',
  });

  const streamPath = watch('streamPath');

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
      setRestoreTunarrDefaults(false);
      reset(data, { keepValues: true });
      return queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Settings'),
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
        Cell: ({ cell }) => (
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
          <IconButton
          // onClick={() => setDeleteDialogOpen(true)}
          >
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

  const renderPathReplacements = () => {
    return (
      <>
        <Typography component="h6" sx={{ my: 2 }}>
          Path Replacements
        </Typography>
        <Grid flex="1 0 50%" container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth sx={{ my: 1 }}>
              <Controller
                control={control}
                name="pathReplace"
                render={({ field }) => (
                  <TextField
                    id="original-path-replace"
                    label="Original Plex path to replace"
                    {...field}
                  />
                )}
              />
            </FormControl>

            <FormControl fullWidth sx={{ my: 1 }}>
              <Controller
                control={control}
                name="pathReplaceWith"
                render={({ field }) => (
                  <TextField
                    id="new-path-replace-with"
                    label="Replace Plex path with"
                    {...field}
                  />
                )}
              />
            </FormControl>
          </Grid>
        </Grid>
      </>
    );
  };

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
              variant="h6"
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
            <Typography variant="caption" sx={{ width: '60%' }}>
              Add sources of content for your channels.
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 1 }}></Box>
          <MaterialReactTable table={table} />
        </Box>
        <Typography component="h6" variant="h6" sx={{ mb: 2 }}>
          Streaming Options
        </Typography>

        <Grid flex="1 0 50%" container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel id="stream-path-label">Stream Path</InputLabel>
              <TypedController
                control={control}
                name="streamPath"
                render={({ field }) => (
                  <Select
                    labelId="stream-path-label"
                    id="stream-path"
                    label="Stream Path"
                    {...field}
                  >
                    {supportedPaths.map((path) => (
                      <MenuItem key={path.value} value={path.value}>
                        {path.string}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              <FormHelperText>
                <strong>Network</strong>: This option will initialize the stream
                over the network, e.g. stream from the Plex server
                <br />
                <strong>Direct</strong>: This option attempts to open the file
                from the filesystem, using the file path provided by Plex. This
                path can be normalized for Tunarr using a find/replace string
                combination
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <FormControlLabel
                control={
                  <CheckboxFormController
                    control={control}
                    name="updatePlayStatus"
                  />
                }
                label="Send play status to Media Source"
              />
              <FormHelperText>
                Note: This affects the "continue watching" section of the media
                source.
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
        <Box sx={{ display: 'block', p: 2 }}>
          {streamPath === 'direct' ? renderPathReplacements() : null}
        </Box>
        <UnsavedNavigationAlert isDirty={isDirty} />
        <Stack spacing={2} direction="row" sx={{ mt: 2 }}>
          <Stack
            spacing={2}
            direction="row"
            justifyContent="left"
            sx={{ mt: 2, flexGrow: 1 }}
          >
            {!isEqual(defaultValues, defaultPlexStreamSettings) && (
              <Button
                variant="outlined"
                onClick={() => {
                  reset(defaultPlexStreamSettings);
                  setRestoreTunarrDefaults(true);
                }}
              >
                Restore Default Settings
              </Button>
            )}
          </Stack>
          <Stack
            spacing={2}
            direction="row"
            justifyContent="right"
            sx={{ mt: 2 }}
          >
            {isDirty && (
              <Button
                variant="outlined"
                onClick={() => {
                  reset(streamSettings);
                  setRestoreTunarrDefaults(false);
                }}
              >
                Reset Changes
              </Button>
            )}
            <Button
              variant="contained"
              disabled={
                !isValid || isSubmitting || (!isDirty && !restoreTunarrDefaults)
              }
              type="submit"
            >
              Save
            </Button>
          </Stack>
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
        <EditMediaSourceLibrariesDialog
          open={!!editingMediaSourceLibraries}
          mediaSource={editingMediaSourceLibraries}
          onClose={() => setEditingMediaSourceLibraries(null)}
        />
      </Box>
    </Box>
  );
}
