import { Trans, useLingui } from '@lingui/react/macro';
import { Delete, Edit, Sync } from '@mui/icons-material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
} from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { type CustomShow } from '@tunarr/types';
import { find } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useMemo, useState } from 'react';
import { RouterButtonLink } from '../../components/base/RouterButtonLink.tsx';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { DataTable } from '../../components/ui/table/DataTable.tsx';
import { actionsColumn } from '../../components/ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../../components/ui/table/tunarrTable.ts';
import { useStoreBackedTableSettings } from '../../components/ui/table/useStoreBackedTableSettings.ts';
import { deleteCustomShowMutation } from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';

const columnHelper = createAppColumnHelper<CustomShow>();

export default function CustomShowsPage() {
  const { t } = useLingui();
  const { data: customShows } = useCustomShows();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<
    string | undefined
  >(undefined);
  const snackbar = useSnackbar();
  const tableState = useStoreBackedTableSettings('CustomShows');

  const deleteShowMutation = useMutation({
    ...deleteCustomShowMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Custom Shows'),
      });
    },
    onError: (e) => {
      snackbar.enqueueSnackbar({
        message: (
          <Trans>
            <span>
              Error deleting playlist: {e.message}
              <br />
              Please consider opening a bug with details!
            </span>
          </Trans>
        ),
        variant: 'error',
      });
      console.error(e);
    },
    onSettled: () => {
      setDeleteConfirmationId(undefined);
    },
  });

  const renderConfirmationDialog = () => {
    return (
      <Dialog
        open={isNonEmptyString(deleteConfirmationId)}
        onClose={() => setDeleteConfirmationId(undefined)}
        aria-labelledby="delete-custom-show-title"
        aria-describedby="delete-custom-show-description"
      >
        <DialogTitle id="delete-custom-show-title">
          <Trans>
            Delete Playlist "
            {find(customShows, { id: deleteConfirmationId })?.name}"?
          </Trans>
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-custom-show-description">
            <Trans>
              Deleting a playlist will remove its programming from channels that
              use it. This action cannot be undone.
            </Trans>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmationId(undefined)} autoFocus>
            <Trans>Cancel</Trans>
          </Button>
          <Button
            onClick={() => {
              if (isNonEmptyString(deleteConfirmationId)) {
                deleteShowMutation.mutate({
                  path: { id: deleteConfirmationId },
                });
              }
            }}
            variant="contained"
          >
            <Trans>Delete</Trans>
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const columns = useMemo(
    () => [
      ...columnHelper.columns([
        columnHelper.accessor('name', {
          header: t`Name`,
          cell: ({ row }) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {row.original.name}
              {row.original.syncMediaSourceId && (
                <Tooltip title={t`Synced with external playlist`}>
                  <Sync fontSize="small" color="primary" />
                </Tooltip>
              )}
            </Box>
          ),
        }),
        columnHelper.accessor('contentCount', {
          header: t`# Programs`,
          meta: { filterVariant: 'range', numeric: true },
        }),
      ]),
      actionsColumn<CustomShow>({
        render: ({ original: show }) => (
          <>
            <Tooltip title={t`Edit`} placement="top">
              <IconButton
                aria-label={t`Edit`}
                to={`/library/playlists/${show.id}/edit`}
                component={Link}
              >
                <Edit />
              </IconButton>
            </Tooltip>
            <Tooltip title={t`Delete`} placement="top">
              <IconButton
                aria-label={t`Delete`}
                onClick={() => setDeleteConfirmationId(show.id)}
              >
                <Delete />
              </IconButton>
            </Tooltip>
          </>
        ),
      }),
    ],
    [t],
  );

  const table = useTunarrTable({
    columns,
    data: customShows,
    ...tableState,
  });

  return (
    <Box>
      <Breadcrumbs />
      <Box
        display="flex"
        mb={2}
        alignItems="flex-start"
        flexDirection={{ xs: 'column', md: 'row' }}
      >
        <Box flexDirection={'column'} flexGrow={1}>
          <Typography variant="h4">
            <Trans>Playlists</Trans>
          </Typography>

          <Typography maxWidth={'800px'}>
            <Trans>
              Playlists are ordered lists of videos that play like the episodes
              of a single TV show. When you add a playlist to a channel, the
              scheduling tools treat its videos as if they belonged to one show.
            </Trans>
          </Typography>
        </Box>
        <RouterButtonLink
          to="/library/playlists/new"
          variant="contained"
          startIcon={<AddCircleIcon />}
          sx={{ alignSelf: 'end' }}
        >
          <Trans>New</Trans>
        </RouterButtonLink>
      </Box>
      <DataTable
        table={table}
        aria-label={t`Playlists`}
        getRowProps={(row) => ({
          onClick: () => {
            navigate({
              to: '/library/playlists/$showId/edit',
              params: { showId: row.original.id },
            }).catch(console.warn);
          },
        })}
      />
      {renderConfirmationDialog()}
    </Box>
  );
}
