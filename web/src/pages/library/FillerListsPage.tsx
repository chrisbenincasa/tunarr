import AddCircleIcon from '@mui/icons-material/AddCircle';

import { isNonEmptyString } from '@/helpers/util.ts';
import { Delete, Edit } from '@mui/icons-material';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Link,
  Tooltip,
} from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TableContainer from '@mui/material/TableContainer';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from '@tanstack/react-router';
import { type FillerList } from '@tunarr/types';
import { find } from 'lodash-es';
import {
  type MRT_ColumnDef,
  type MRT_Row,
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useSnackbar } from 'notistack';
import { useCallback, useMemo, useState } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import {
  deleteApiFillerListsByIdMutation,
  getApiFillerListsQueryKey,
} from '../../generated/@tanstack/react-query.gen.ts';
import { useFillerLists } from '../../hooks/useFillerLists.ts';

export default function FillerListsPage() {
  const queryClient = useQueryClient();
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<
    string | undefined
  >(undefined);
  const snackbar = useSnackbar();

  const deleteFillerList = useMutation({
    ...deleteApiFillerListsByIdMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: getApiFillerListsQueryKey(),
        exact: false,
      });
    },
    onError: (e) => {
      snackbar.enqueueSnackbar({
        message: (
          <span>
            Error deleting filler list: {e.message}
            <br />
            Please consider opening a bug with details!
          </span>
        ),
        variant: 'error',
      });
      console.error(e);
    },
    onSettled: () => {
      setDeleteConfirmationId(undefined);
    },
  });

  const { data: fillerLists } = useFillerLists();
  const navigate = useNavigate();

  const handleFillterNavigation = (
    _: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    id: string,
  ) => {
    navigate({
      to: `/library/fillers/$fillerId/edit`,
      params: { fillerId: id },
    }).catch(console.error);
  };

  const renderConfirmationDialog = () => {
    return (
      <Dialog
        open={isNonEmptyString(deleteConfirmationId)}
        onClose={() => setDeleteConfirmationId(undefined)}
        aria-labelledby="delete-filler-list-title"
        aria-describedby="delete-filler-list-description"
      >
        <DialogTitle id="delete-filler-list-title">
          Delete Filler List "
          {find(fillerLists, { id: deleteConfirmationId })?.name}"?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-filler-list-description">
            Deleting a Filler will remove all programming from the channel. This
            action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmationId(undefined)} autoFocus>
            Cancel
          </Button>
          <Button
            onClick={() =>
              deleteFillerList.mutate({ path: { id: deleteConfirmationId! } })
            }
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderActionCell = useCallback(
    ({ row: { original: filler } }: { row: MRT_Row<FillerList> }) => {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'end', width: '100%' }}>
          <Tooltip title="Edit" placement="top">
            <IconButton
              to={`/library/fillers/${filler.id}/edit`}
              component={RouterLink}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete" placement="top">
            <IconButton
              onClick={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                setDeleteConfirmationId(filler.id);
              }}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      );
    },
    [],
  );

  const columns = useMemo<MRT_ColumnDef<FillerList>[]>(
    () => [
      {
        header: 'Name',
        accessorKey: 'name',
      },
      {
        header: '# Programs',
        accessorKey: 'contentCount',
        filterVariant: 'range',
      },
    ],
    [],
  );

  const table = useMaterialReactTable({
    columns: columns,
    data: fillerLists,
    enableRowActions: true,
    layoutMode: 'grid',
    renderRowActions: renderActionCell,
    renderEmptyRowsFallback() {
      return (
        <Typography
          sx={{ py: '2rem', textAlign: 'center', fontStyle: 'italic' }}
        >
          You have no Filler Lists. Create your first Filler List{' '}
          <Link component={RouterLink} to="/library/fillers/new">
            here.
          </Link>
        </Typography>
      );
    },
    muiTableBodyRowProps: ({ row }) => ({
      sx: {
        cursor: 'pointer',
      },
      onClick: (event) => handleFillterNavigation(event, row.original.id),
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
  });

  return (
    <Box>
      <Breadcrumbs />
      {renderConfirmationDialog()}
      <Box display="flex" mb={2} alignItems="flex-start">
        <Box flexDirection={'column'} flexGrow={1}>
          <Typography flexGrow={1} variant="h4">
            Filler Lists
          </Typography>
          <Typography maxWidth={'800px'}>
            Filler lists are collections of videos that you may want to play
            during 'flex' time segments. Flex is time within a channel that does
            not have a program scheduled (usually used for padding).
          </Typography>
        </Box>

        <Button
          component={RouterLink}
          to="/library/fillers/new"
          variant="contained"
          startIcon={<AddCircleIcon />}
          sx={{ alignSelf: 'end' }}
        >
          New
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ width: '100%' }}>
        <MaterialReactTable table={table} />
      </TableContainer>
    </Box>
  );
}
