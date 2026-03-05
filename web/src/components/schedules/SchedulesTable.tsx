import { Add, Delete, Edit } from '@mui/icons-material';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { Schedule } from '@tunarr/types/api';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useCallback, useState } from 'react';
import {
  deleteInfiniteScheduleMutation,
  getSchedulesOptions,
  getSchedulesQueryKey,
} from '../../generated/@tanstack/react-query.gen.ts';
import { useStoreBackedTableSettings } from '../../hooks/useTableSettings.ts';
import type { Maybe } from '../../types/util.ts';
import {
  RouterButtonLink,
  RouterIconButtonLink,
} from '../base/RouterButtonLink.tsx';
import { DeleteConfirmationDialog } from '../DeleteConfirmationDialog.tsx';

export const SchedulesTable = () => {
  const queryClient = useQueryClient();
  const schedulesQuery = useSuspenseQuery({
    ...getSchedulesOptions(),
  });
  const tableSettings = useStoreBackedTableSettings('Schedules');

  const [deletingSchedule, setDeletingSchedule] = useState<Maybe<Schedule>>();

  const deleteScheduleMut = useMutation({
    ...deleteInfiniteScheduleMutation(),
    onSuccess: () => {
      setDeletingSchedule(undefined);
      queryClient
        .invalidateQueries({ queryKey: getSchedulesQueryKey() })
        .catch(console.error);
    },
  });

  const handleDeleteSchedule = useCallback(
    (id: string) => {
      deleteScheduleMut.mutate({ path: { id } });
    },
    [deleteScheduleMut],
  );

  const table = useMaterialReactTable({
    data: schedulesQuery.data,
    columns: [
      {
        header: 'Name',
        accessorKey: 'name',
        grow: true,
      },
    ],
    renderEmptyRowsFallback() {
      return (
        <Typography
          sx={{ py: '2rem', textAlign: 'center', fontStyle: 'italic' }}
        >
          You have no schedules.
        </Typography>
      );
    },
    layoutMode: 'grid',
    enableRowActions: true,
    positionActionsColumn: 'last',
    displayColumnDefOptions: {
      'mrt-row-actions': {
        size: 108, // 2 icons + 4px gap + 24px padding
        grow: false,
        Header: '',
        visibleInShowHideMenu: false,
      },
    },
    renderTopToolbarCustomActions() {
      return (
        <Stack direction="row" alignItems="center" gap={2} useFlexGap>
          <RouterButtonLink
            variant="contained"
            to="/schedules/new"
            startIcon={<Add />}
          >
            New
          </RouterButtonLink>
        </Stack>
      );
    },
    renderRowActions: ({ row }) => {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Edit" placement="top">
            <Box component={'span'}>
              <RouterIconButtonLink
                to="/schedules/$scheduleId"
                params={{ scheduleId: row.original.uuid ?? '' }}
              >
                <Edit />
              </RouterIconButtonLink>
            </Box>
          </Tooltip>
          <Tooltip title="Delete" placement="top">
            <IconButton onClick={() => setDeletingSchedule(row.original)}>
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      );
    },
    ...tableSettings,
  });

  return (
    <>
      <MaterialReactTable table={table} />
      <DeleteConfirmationDialog
        open={!!deletingSchedule}
        onClose={() => setDeletingSchedule(undefined)}
        onConfirm={() => handleDeleteSchedule(deletingSchedule!.uuid)}
        title={`Delete "${deletingSchedule?.name}"`}
        body={`Are you sure you want to delete schedule "${deletingSchedule?.name}"?`}
      />
    </>
  );
};
