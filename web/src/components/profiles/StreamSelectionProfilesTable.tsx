import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import {
  deleteApiStreamSelectionProfilesByIdMutation,
  getApiStreamSelectionProfilesOptions,
  getApiStreamSelectionProfilesQueryKey,
  getApiStreamSelectionSettingsQueryKey,
  postApiStreamSelectionProfilesMutation,
  putApiStreamSelectionSettingsMutation,
} from '@/generated/@tanstack/react-query.gen';
import type { GetApiStreamSelectionProfilesResponse } from '@/generated/types.gen';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  AddCircle,
  ContentCopy,
  Delete,
  Edit,
  Lock,
  Star,
  Visibility,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { RouterLink } from '../base/RouterLink.tsx';
import { DataTable } from '../ui/table/DataTable.tsx';
import { actionsColumn } from '../ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../ui/table/tunarrTable.ts';
import { useStoreBackedTableSettings } from '../ui/table/useStoreBackedTableSettings.ts';

type Profile = GetApiStreamSelectionProfilesResponse[number];

const columnHelper = createAppColumnHelper<Profile>();

const TableName = 'StreamSelectionProfiles';

function usageCount(profile: Profile) {
  const { channels, fillerLists, customShows, programCount } = profile.usage;
  return (
    channels.length + fillerLists.length + customShows.length + programCount
  );
}

const ProfileUsage = ({ profile }: { profile: Profile }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { channels, fillerLists, customShows, programCount } = profile.usage;

  if (usageCount(profile) === 0) {
    return <Chip label={t`Not assigned`} size="small" variant="outlined" />;
  }

  const summary = [
    channels.length > 0 ? t`${channels.length} channel(s)` : null,
    fillerLists.length > 0 ? t`${fillerLists.length} filler list(s)` : null,
    customShows.length > 0 ? t`${customShows.length} playlist(s)` : null,
    programCount > 0 ? t`${programCount} program(s)` : null,
  ]
    .filter((s) => s !== null)
    .join(', ');

  return (
    <>
      <Chip
        label={summary}
        size="small"
        color="primary"
        variant="outlined"
        onClick={(e) => setAnchor(e.currentTarget)}
      />
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack sx={{ p: 2, maxWidth: 360 }} spacing={1.5}>
          {channels.length > 0 && (
            <Box>
              <Typography variant="subtitle2">
                <Trans>Channels</Trans>
              </Typography>
              {channels.map((channel) => (
                <RouterLink
                  key={channel.uuid}
                  to="/channels/$channelId/edit"
                  params={{ channelId: channel.uuid }}
                  display="block"
                >
                  {channel.number} - {channel.name}
                </RouterLink>
              ))}
            </Box>
          )}
          {fillerLists.length > 0 && (
            <Box>
              <Typography variant="subtitle2">
                <Trans>Filler Lists</Trans>
              </Typography>
              {fillerLists.map((filler) => (
                <RouterLink
                  key={filler.uuid}
                  to="/library/fillers/$fillerId/edit"
                  params={{ fillerId: filler.uuid }}
                  display="block"
                >
                  {filler.name}
                </RouterLink>
              ))}
            </Box>
          )}
          {customShows.length > 0 && (
            <Box>
              <Typography variant="subtitle2">
                <Trans>Playlists</Trans>
              </Typography>
              {customShows.map((show) => (
                <RouterLink
                  key={show.uuid}
                  to="/library/playlists/$showId/edit"
                  params={{ showId: show.uuid }}
                  display="block"
                >
                  {show.name}
                </RouterLink>
              ))}
            </Box>
          )}
          {programCount > 0 && (
            <Typography variant="body2">
              <Trans>{programCount} program(s)</Trans>
            </Typography>
          )}
        </Stack>
      </Popover>
    </>
  );
};

export const StreamSelectionProfilesTable = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: profiles = [] } = useQuery({
    ...getApiStreamSelectionProfilesOptions(),
  });
  const defaultProfile = profiles.find((p) => p.isDefault);

  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: getApiStreamSelectionProfilesQueryKey(),
    });
    await queryClient.invalidateQueries({
      queryKey: getApiStreamSelectionSettingsQueryKey(),
    });
  }, [queryClient]);

  const deleteMutation = useMutation({
    ...deleteApiStreamSelectionProfilesByIdMutation(),
    onSuccess: async () => {
      setConfirmDelete(null);
      await invalidate();
    },
  });

  const setDefaultMutation = useMutation({
    ...putApiStreamSelectionSettingsMutation(),
    onSuccess: invalidate,
  });

  const duplicateMutation = useMutation({
    ...postApiStreamSelectionProfilesMutation(),
    onSuccess: async (created) => {
      await invalidate();
      await navigate({
        to: '/profiles/stream-selection/$profileId',
        params: { profileId: created.uuid },
      });
    },
  });

  const tableState = useStoreBackedTableSettings(TableName);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: t`Name`,
          cell: ({ row: { original } }) => (
            <Stack direction="row" alignItems="center" spacing={1}>
              {original.locked && (
                <Tooltip title={t`Built-in profiles cannot be edited`}>
                  <Lock fontSize="small" color="disabled" />
                </Tooltip>
              )}
              <span>{original.name}</span>
              {original.isDefault && (
                <Chip label={t`Default`} size="small" color="success" />
              )}
            </Stack>
          ),
        }),
        columnHelper.accessor((row) => row.rules.length, {
          id: 'rules',
          header: t`Rules`,
          meta: { numeric: true },
        }),
        columnHelper.display({
          id: 'usedBy',
          header: t`Used By`,
          cell: ({ row: { original } }) => <ProfileUsage profile={original} />,
        }),
        actionsColumn<Profile>({
          render: ({ original: profile }) => (
            <>
              <Tooltip
                title={profile.locked ? t`View` : t`Edit`}
                placement="top"
              >
                <IconButton
                  aria-label={profile.locked ? t`View` : t`Edit`}
                  to={`/profiles/stream-selection/${profile.uuid}`}
                  component={Link}
                >
                  {profile.locked ? <Visibility /> : <Edit />}
                </IconButton>
              </Tooltip>
              <Tooltip title={t`Duplicate`} placement="top">
                <IconButton
                  aria-label={t`Duplicate`}
                  onClick={() =>
                    duplicateMutation.mutate({
                      body: {
                        name: t`Copy of ${profile.name}`,
                        rules: profile.rules,
                      },
                    })
                  }
                >
                  <ContentCopy />
                </IconButton>
              </Tooltip>
              <Tooltip title={t`Set as default`} placement="top">
                <span>
                  <IconButton
                    aria-label={t`Set as default`}
                    disabled={profile.isDefault}
                    onClick={() =>
                      setDefaultMutation.mutate({
                        body: { defaultProfileId: profile.uuid },
                      })
                    }
                  >
                    <Star />
                  </IconButton>
                </span>
              </Tooltip>
              {!profile.locked && (
                <Tooltip title={t`Delete`} placement="top">
                  <IconButton
                    aria-label={t`Delete`}
                    onClick={() => setConfirmDelete(profile)}
                  >
                    <Delete />
                  </IconButton>
                </Tooltip>
              )}
            </>
          ),
        }),
      ]),
    [duplicateMutation, setDefaultMutation],
  );

  const table = useTunarrTable({
    columns,
    data: profiles,
    ...tableState,
  });

  const toolbarActions = (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      gap={2}
      useFlexGap
    >
      <Button
        variant="contained"
        startIcon={<AddCircle />}
        component={Link}
        to="/profiles/stream-selection/new"
      >
        <Trans>New</Trans>
      </Button>
      <FormControl size="small" sx={{ minWidth: 240 }}>
        <InputLabel id="default-profile-label">
          <Trans>Default profile</Trans>
        </InputLabel>
        <Select
          labelId="default-profile-label"
          label={t`Default profile`}
          value={defaultProfile?.uuid ?? ''}
          onChange={(e) =>
            setDefaultMutation.mutate({
              body: { defaultProfileId: e.target.value },
            })
          }
        >
          {profiles.map((profile) => (
            <MenuItem key={profile.uuid} value={profile.uuid}>
              {profile.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );

  const deleteBody = useMemo(() => {
    if (!confirmDelete) {
      return undefined;
    }
    const parts: string[] = [];
    if (usageCount(confirmDelete) > 0) {
      parts.push(
        t`Everything using this profile will fall back to the next profile in the resolution order (usually the channel's profile, or the default).`,
      );
    }
    if (confirmDelete.isDefault) {
      parts.push(
        t`This is the default profile. The built-in profile will become the default.`,
      );
    }
    return parts.length > 0 ? parts.join(' ') : undefined;
  }, [confirmDelete]);

  return (
    <>
      <DataTable
        table={table}
        aria-label={t`Stream selection profiles`}
        toolbarActions={toolbarActions}
      />
      <DeleteConfirmationDialog
        open={confirmDelete !== null}
        title={t`Delete Profile "${confirmDelete?.name ?? ''}"?`}
        body={deleteBody}
        onConfirm={() => {
          if (confirmDelete) {
            deleteMutation.mutate({ path: { id: confirmDelete.uuid } });
          }
        }}
        onClose={() => setConfirmDelete(null)}
        dialogProps={{
          maxWidth: 'sm',
          fullWidth: true,
        }}
      />
    </>
  );
};
