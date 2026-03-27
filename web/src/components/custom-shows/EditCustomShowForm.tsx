import { isNonEmptyString } from '@/helpers/util.ts';
import { customShowQuery } from '@/hooks/useCustomShows.ts';
import useStore from '@/store';
import {
  clearCurrentCustomShow,
  moveProgramInCustomShow,
  resetCustomShowProgramming,
  setCustomShowProgramDirty,
  updateCurrentCustomShow,
} from '@/store/customShowEditor/actions.ts';
import { removeCustomShowProgram } from '@/store/entityEditor/util';
import { type UICustomShowProgram } from '@/types';
import { Refresh, Save, Sync, Tv, Undo } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type CustomShow, type Playlist } from '@tunarr/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useCallback, useEffect } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import {
  getApiCustomShowsByIdProgramsQueryKey,
  getApiCustomShowsByIdQueryKey,
  getApiCustomShowsQueryKey,
} from '../../generated/@tanstack/react-query.gen.ts';
import {
  createCustomShow,
  getApiMediaSources,
  getApiPlexByMediaSourceIdPlaylists,
  putApiCustomShowsById,
  syncCustomShow,
} from '../../generated/sdk.gen.ts';
import ChannelLineupList from '../channel_config/ChannelLineupList.tsx';
import { CustomShowSortToolsMenu } from './CustomShowSortToolsMenu.tsx';

dayjs.extend(relativeTime);

type CustomShowForm = {
  id?: string;
  name: string;
  syncEnabled: boolean;
  syncMediaSourceId: string;
  syncExternalPlaylistId: string;
};

type Props = {
  customShow: CustomShow;
  customShowPrograms: UICustomShowProgram[];
  isNew: boolean;
};

export function EditCustomShowsForm({
  customShow,
  customShowPrograms,
  isNew,
}: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const customShowProgrammingChanged = useStore(
    (s) => s.customShowEditor.dirty.programs,
  );
  useQuery({
    ...customShowQuery(customShow.id),
    enabled: !isNew,
    refetchInterval: customShow.isSyncing ? 5_000 : undefined,
  });

  const isSynced = !!customShow.syncMediaSourceId;

  const {
    control,
    reset,
    handleSubmit,
    getValues,
    watch,
    setValue,
    formState: { isValid, isDirty },
  } = useForm<CustomShowForm>({
    defaultValues: {
      name: customShow.name ?? '',
      syncEnabled: isSynced,
      syncMediaSourceId: customShow.syncMediaSourceId ?? '',
      syncExternalPlaylistId: customShow.syncExternalPlaylistId ?? '',
    },
  });

  const [syncEnabled, selectedMediaSourceId] = watch([
    'syncEnabled',
    'syncMediaSourceId',
  ]);

  useEffect(() => {
    reset({
      name: customShow.name,
      syncEnabled: !!customShow.syncMediaSourceId,
      syncMediaSourceId: customShow.syncMediaSourceId ?? undefined,
      syncExternalPlaylistId: customShow.syncExternalPlaylistId ?? undefined,
    });
  }, [customShow, reset]);

  // Fetch media sources for the dropdown
  const { data: mediaSources } = useQuery({
    queryKey: ['settings', 'media-sources'],
    queryFn: async () => {
      const result = await getApiMediaSources({ throwOnError: true });
      return result.data;
    },
  });

  // Filter to only Plex sources for now
  const plexSources = (mediaSources ?? []).filter((s) => s.type === 'plex');

  // Fetch playlists for selected media source
  const { data: playlists, isLoading: playlistsLoading } = useQuery({
    queryKey: ['plex', selectedMediaSourceId, 'playlists'],
    queryFn: async () => {
      const result = await getApiPlexByMediaSourceIdPlaylists({
        path: { mediaSourceId: selectedMediaSourceId },
        throwOnError: true,
      });
      return result.data;
    },
    enabled: syncEnabled && !!selectedMediaSourceId,
  });

  const playlistItems: Playlist[] = playlists?.result ?? [];

  const saveShowMutation = useMutation({
    mutationKey: ['custom-shows', isNew ? 'new' : customShow.id],
    mutationFn: async (
      data: CustomShowForm & { programs: UICustomShowProgram[] },
    ) => {
      const body = {
        name: data.name,
        programs: data.syncEnabled ? [] : data.programs,
        enableSync: data.syncEnabled,
        ...(data.syncEnabled &&
        isNonEmptyString(data.syncMediaSourceId) &&
        isNonEmptyString(data.syncExternalPlaylistId)
          ? {
              syncMediaSourceId: data.syncMediaSourceId,
              syncMediaSourceType: 'plex' as const,
              syncExternalPlaylistId: data.syncExternalPlaylistId,
            }
          : {
              syncMediaSourceId: null,
              syncMediaSourceType: null,
              syncExternalPlaylistId: null,
            }),
      };

      if (isNew) {
        return createCustomShow({ body, throwOnError: true });
      } else {
        return putApiCustomShowsById({
          path: { id: customShow.id },
          body,
          throwOnError: true,
        });
      }
    },
    onSuccess: async (updatedShow) => {
      reset({
        name: updatedShow.data.name,
        syncEnabled: !!updatedShow.data.syncMediaSourceId,
        syncMediaSourceId: updatedShow.data.syncMediaSourceId ?? undefined,
        syncExternalPlaylistId:
          updatedShow.data.syncExternalPlaylistId ?? undefined,
      });
      await queryClient.invalidateQueries({
        queryKey: getApiCustomShowsQueryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: getApiCustomShowsByIdQueryKey({
          path: { id: updatedShow.data.id },
        }),
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey: getApiCustomShowsByIdProgramsQueryKey({
          path: { id: updatedShow.data.id },
        }),
        exact: true,
      });
      if (isNew) {
        await navigate({ to: '..' }).catch(console.error);
        clearCurrentCustomShow();
      } else {
        updateCurrentCustomShow(updatedShow.data);
        setCustomShowProgramDirty(false);
      }
    },
  });

  const syncNowMutation = useMutation({
    mutationKey: ['custom-shows', customShow.id, 'sync'],
    mutationFn: async () => {
      return syncCustomShow({
        path: { id: customShow.id },
        throwOnError: true,
      });
    },
    onSuccess: async (updatedShow) => {
      updateCurrentCustomShow(updatedShow.data);
      await queryClient.invalidateQueries({
        queryKey: getApiCustomShowsByIdProgramsQueryKey({
          path: { id: customShow.id },
        }),
      });
      await queryClient.invalidateQueries({
        queryKey: getApiCustomShowsByIdQueryKey({
          path: { id: customShow.id },
        }),
      });
    },
  });

  const saveCustomShow: SubmitHandler<CustomShowForm> = (
    data: CustomShowForm,
  ) => {
    saveShowMutation.mutate({ ...data, programs: customShowPrograms });
  };

  const navToProgramming = () => {
    if (isNew) {
      updateCurrentCustomShow(getValues());
    }
    navigate({
      to: isNew
        ? '/library/custom-shows/new/programming'
        : `/library/custom-shows/$showId/programming`,
      params: { showId: customShow?.id },
    }).catch(console.warn);
  };

  const handleSyncToggle = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setValue('syncMediaSourceId', '');
        setValue('syncExternalPlaylistId', '');
      }
    },
    [setValue],
  );

  return (
    <Box component="form" onSubmit={handleSubmit(saveCustomShow)}>
      <Stack gap={2}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField margin="normal" fullWidth label="Name" {...field} />
          )}
        />

        <Divider />

        <Box>
          <Controller
            control={control}
            name="syncEnabled"
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.checked);
                      handleSyncToggle(e.target.checked);
                    }}
                  />
                }
                label="Sync with external playlist"
              />
            )}
          />
        </Box>

        {syncEnabled && (
          <Stack gap={2}>
            <Controller
              control={control}
              name="syncMediaSourceId"
              rules={{
                required: syncEnabled,
                minLength: syncEnabled ? 1 : 0,
              }}
              render={({ field }) => (
                <Autocomplete
                  options={plexSources}
                  getOptionLabel={(opt) => opt.name}
                  value={plexSources.find((s) => s.id === field.value) ?? null}
                  onChange={(_, newVal) => {
                    field.onChange(newVal?.id ?? undefined);
                    setValue('syncExternalPlaylistId', '');
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Media Source" />
                  )}
                />
              )}
            />

            {selectedMediaSourceId && (
              <Controller
                control={control}
                name="syncExternalPlaylistId"
                rules={{
                  required: syncEnabled,
                  minLength: syncEnabled ? 1 : 0,
                }}
                render={({ field }) => (
                  <Autocomplete
                    options={playlistItems}
                    getOptionLabel={(opt) => opt.title}
                    value={
                      playlistItems.find((p) => p.externalId === field.value) ??
                      null
                    }
                    onChange={(_, newVal) =>
                      field.onChange(newVal?.externalId ?? undefined)
                    }
                    loading={playlistsLoading}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Playlist"
                        slotProps={{
                          input: {
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {playlistsLoading && (
                                  <CircularProgress size={20} />
                                )}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          },
                        }}
                      />
                    )}
                  />
                )}
              />
            )}

            {!isNew && isSynced && (
              <Stack direction="row" gap={2} sx={{ alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  startIcon={
                    syncNowMutation.isPending ? (
                      <CircularProgress size={16} />
                    ) : (
                      <Refresh />
                    )
                  }
                  onClick={() => syncNowMutation.mutate()}
                  disabled={syncNowMutation.isPending || customShow.isSyncing}
                >
                  Sync Now
                </Button>
                {customShow.lastSyncedAt && (
                  <Typography variant="body2" color="text.secondary">
                    Last synced {dayjs(customShow.lastSyncedAt).fromNow()}
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>
        )}

        <Divider />

        <Box>
          {isSynced && !isNew && (
            <Alert severity="info" sx={{ mb: 2 }} icon={<Sync />}>
              This custom show is synced with an external playlist. Content is
              updated automatically and cannot be edited manually.
            </Alert>
          )}

          <Box>
            <Stack
              direction="row"
              sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap' }}
              gap={2}
            >
              <Typography
                variant="h6"
                sx={{ flex: 1, flexBasis: ['100%', 'auto'] }}
              >
                Programming
              </Typography>

              {!syncEnabled && (
                <>
                  <CustomShowSortToolsMenu />
                  {customShowProgrammingChanged && (
                    <Tooltip title="Reset programming to most recently saved state">
                      <Button
                        variant="contained"
                        startIcon={<Undo />}
                        onClick={() => resetCustomShowProgramming()}
                      >
                        Reset
                      </Button>
                    </Tooltip>
                  )}
                  <Tooltip
                    title="Add programming to custom show"
                    placement="top"
                  >
                    <Button
                      disableRipple
                      component="button"
                      onClick={() => navToProgramming()}
                      startIcon={<Tv />}
                      variant="contained"
                    >
                      Add Media
                    </Button>
                  </Tooltip>
                </>
              )}
              <Button
                disabled={
                  saveShowMutation.isPending ||
                  !isValid ||
                  (!isDirty && !customShowProgrammingChanged) ||
                  (!syncEnabled && customShowPrograms.length === 0)
                }
                variant="contained"
                type="submit"
                startIcon={<Save />}
              >
                Save
              </Button>
            </Stack>
          </Box>
          <Paper>
            <ChannelLineupList
              type="selector"
              programListSelector={(s) => s.customShowEditor.programList}
              moveProgram={moveProgramInCustomShow}
              deleteProgram={removeCustomShowProgram}
              enableDnd={!syncEnabled}
              enableRowDelete={!syncEnabled}
              enableRowEdit={!syncEnabled}
              virtualListProps={{
                width: '100%',
                height: 600,
                itemSize: 35,
              }}
            />
          </Paper>
        </Box>
      </Stack>
    </Box>
  );
}
