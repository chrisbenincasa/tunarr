import AddCircleIcon from '@mui/icons-material/AddCircle';

import { Delete, Edit } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TableContainer from '@mui/material/TableContainer';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { useFillerLists } from '../../hooks/useFillerLists.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { useCallback, useMemo } from 'react';
import { FillerList } from '@tunarr/types';
import {
  MRT_ColumnDef,
  MRT_Row,
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';

type DeleteFillerListRequest = { id: string };

export default function FillerListsPage() {
  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();

  const deleteFillerList = useMutation({
    mutationFn: ({ id }: DeleteFillerListRequest) =>
      apiClient.deleteFillerList(undefined, { params: { id } }),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['fillers'],
      });
    },
    onError: (e) => console.error(e),
  });

  const { data: fillerLists } = useFillerLists();

  const renderActionCell = useCallback(
    ({ row: { original: filler } }: { row: MRT_Row<FillerList> }) => {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'end', width: '100%' }}>
          <Tooltip title="Edit" placement="top">
            <IconButton
              color="primary"
              to={`/library/fillers/${filler.id}/edit`}
              component={Link}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete" placement="top">
            <IconButton
              color="error"
              onClick={() => deleteFillerList.mutate({ id: filler.id })}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      );
    },
    [deleteFillerList],
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
    muiTableBodyRowProps: () => ({
      sx: {
        cursor: 'pointer',
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
  });

  return (
    <Box>
      <Breadcrumbs />
      <Box display="flex" mb={2}>
        <Typography flexGrow={1} variant="h4">
          Filler Lists
        </Typography>
        <Button
          component={Link}
          to="/library/fillers/new"
          variant="contained"
          startIcon={<AddCircleIcon />}
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
