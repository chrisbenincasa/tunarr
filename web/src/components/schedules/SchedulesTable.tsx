import { Add, Delete, Edit } from '@mui/icons-material';
import {
  Box,
  Dialog,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { SmartCollection } from '@tunarr/types';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useCallback, useState } from 'react';
import { getSchedulesOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { useDeleteSmartCollection } from '../../hooks/smartCollectionHooks.ts';
import { useStoreBackedTableSettings } from '../../hooks/useTableSettings.ts';
import { Route } from '../../routes/schedules_/index.tsx';
import type { Maybe } from '../../types/util.ts';
import {
  RouterButtonLink,
  RouterIconButtonLink,
} from '../base/RouterButtonLink.tsx';
import { DeleteConfirmationDialog } from '../DeleteConfirmationDialog.tsx';
import { EditSmartCollectionDialog } from '../smart_collections/EditSmartCollectionDialog.tsx';

export const SchedulesTable = () => {
  const navigate = Route.useNavigate();
  const schedulesQuery = useSuspenseQuery({
    ...getSchedulesOptions(),
  });
  const tableSettings = useStoreBackedTableSettings('Schedules');

  const [editingSchedule, setEditingSchedule] = useState<Maybe<string>>();
  const [deletingSchedule, setDeletingSchedule] =
    useState<Maybe<SmartCollection>>();

  const deleteSmartCollectionMut = useDeleteSmartCollection();

  const handleDeleteSmartCollection = useCallback(
    (id: string) => {
      deleteSmartCollectionMut.mutate({
        path: {
          id,
        },
      });
    },
    [deleteSmartCollectionMut],
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
        size: 112, // 3 icons + 16px padding
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
      console.log(row.original);
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
      <Dialog
        open={isNonEmptyString(editingSchedule)}
        onClose={() => setEditingSchedule(undefined)}
        fullWidth
      >
        <EditSmartCollectionDialog
          onClose={() => setEditingSchedule(undefined)}
          id={editingSchedule ?? ''}
        />
      </Dialog>
      <DeleteConfirmationDialog
        open={!!deletingSchedule}
        onClose={() => setDeletingSchedule(undefined)}
        onConfirm={() => handleDeleteSmartCollection(deletingSchedule!.uuid)}
        title={`Delete "${deletingSchedule?.name}"`}
        body={`Are you sure you want to delete Smart Collection "${deletingSchedule?.name}"?`}
      />
    </>
  );
};
