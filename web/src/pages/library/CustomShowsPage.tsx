import AddCircleIcon from '@mui/icons-material/AddCircle';
import { IconButton, Tooltip } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TableContainer from '@mui/material/TableContainer';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { CustomShow } from '@tunarr/types';
import { Edit, Delete } from '@mui/icons-material';
import {
  MRT_Row,
  MRT_ColumnDef,
  useMaterialReactTable,
  MaterialReactTable,
} from 'material-react-table';
import { useCallback, useMemo } from 'react';

export default function CustomShowsPage() {
  const apiClient = useTunarrApi();
  const { data: customShows } = useCustomShows();
  const queryClient = useQueryClient();

  const deleteShowMutation = useMutation({
    mutationFn: async (id: string) =>
      apiClient.deleteCustomShow(undefined, { params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['custom-shows'],
        exact: false,
      });
    },
  });

  const renderActionCell = useCallback(
    ({ row: { original: show } }: { row: MRT_Row<CustomShow> }) => {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'end', width: '100%' }}>
          <Tooltip title="Edit" placement="top">
            <IconButton
              color="primary"
              to={`/library/custom-shows/${show.id}/edit`}
              component={Link}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete" placement="top">
            <IconButton
              color="error"
              onClick={() => deleteShowMutation.mutate(show.id)}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      );
    },
    [deleteShowMutation],
  );

  const columns = useMemo<MRT_ColumnDef<CustomShow>[]>(
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
    columns,
    data: customShows,
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
          Custom Shows
        </Typography>
        <Button
          component={Link}
          to="/library/custom-shows/new"
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
