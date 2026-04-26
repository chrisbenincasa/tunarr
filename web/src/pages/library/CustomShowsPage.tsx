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
import Paper from '@mui/material/Paper';
import TableContainer from '@mui/material/TableContainer';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { type CustomShow } from '@tunarr/types';
import { find } from 'lodash-es';
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  type MRT_Row,
  useMaterialReactTable,
} from 'material-react-table';
import { useSnackbar } from 'notistack';
import React, { useCallback, useMemo, useState } from 'react';
import { RouterButtonLink } from '../../components/base/RouterButtonLink.tsx';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { deleteCustomShowMutation } from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import { useStoreBackedTableSettings } from '../../hooks/useTableSettings.ts';

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
              Error deleting custom show: {e.message}
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

  const handleCustomShowDelete = useCallback(
    (event: React.MouseEvent, showId: string) => {
      event.stopPropagation();
      setDeleteConfirmationId(showId);
    },
    [],
  );

  const renderConfirmationDialog = () => {
    return (
      <Dialog
        open={isNonEmptyString(deleteConfirmationId)}
        onClose={() => setDeleteConfirmationId(undefined)}
        aria-labelledby="delete-custom-show-title"
        aria-describedby="delete-custom-show-description"
      >
        <DialogTitle id="delete-custom-show-title">
          <Trans>Delete Custom Show "{find(customShows, { id: deleteConfirmationId })?.name}"?</Trans>
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-custom-show-description">
            <Trans>
              Deleting a Custom Show will remove its programming from channels
              that use it. This action cannot be undone.
            </Trans>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmationId(undefined)} autoFocus>
            <Trans>Cancel</Trans>
          </Button>
          <Button
            onClick={() =>
              deleteShowMutation.mutate({ path: { id: deleteConfirmationId! } })
            }
            variant="contained"
          >
            <Trans>Delete</Trans>
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderActionCell = useCallback(
    ({ row: { original: show } }: { row: MRT_Row<CustomShow> }) => {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'end', width: '100%' }}>
          <Tooltip title={t`Edit`} placement="top">
            <IconButton
              to={`/library/custom-shows/${show.id}/edit`}
              component={Link}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title={t`Delete`} placement="top">
            <IconButton onClick={(e) => handleCustomShowDelete(e, show.id)}>
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      );
    },
    [handleCustomShowDelete, t],
  );

  const columns = useMemo<MRT_ColumnDef<CustomShow>[]>(
    () => [
      {
        header: t`Name`,
        accessorKey: 'name',
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {row.original.name}
            {row.original.syncMediaSourceId && (
              <Tooltip title={t`Synced with external playlist`}>
                <Sync fontSize="small" color="primary" />
              </Tooltip>
            )}
          </Box>
        ),
      },
      {
        header: t`# Programs`,
        accessorKey: 'contentCount',
        filterVariant: 'range',
      },
    ],
    [t],
  );

  const table = useMaterialReactTable({
    columns,
    data: customShows,
    enableRowActions: true,
    layoutMode: 'grid',
    renderRowActions: renderActionCell,
    muiTableBodyRowProps: ({ row }) => ({
      sx: {
        cursor: 'pointer',
      },
      onClick: () => {
        navigate({
          to: '/library/custom-shows/$showId/edit',
          params: { showId: row.original.id },
        }).catch(console.warn);
      },
    }),
    displayColumnDefOptions: {
      'mrt-row-actions': {
        size: 200,
        grow: false,
        Header: '',
        visibleInShowHideMenu: false,
      },
    },
    positionActionsColumn: 'last',
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
          <Typography variant="h4"><Trans>Custom Shows</Trans></Typography>

          <Typography maxWidth={'800px'}>
            <Trans>
              Custom Shows are sequences of videos that represent a episodes of a
              virtual TV show. When you add these shows to a channel, the schedule
              tools will treat the videos as if they belonged to a single TV show.
            </Trans>
          </Typography>
        </Box>
        <RouterButtonLink
          to="/library/custom-shows/new"
          variant="contained"
          startIcon={<AddCircleIcon />}
          sx={{ alignSelf: 'end' }}
        >
          <Trans>New</Trans>
        </RouterButtonLink>
      </Box>
      <TableContainer component={Paper} sx={{ width: '100%' }}>
        <MaterialReactTable table={table} />
      </TableContainer>
      {renderConfirmationDialog()}
    </Box>
  );
}
