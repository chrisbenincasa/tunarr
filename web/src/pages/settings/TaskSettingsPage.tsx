import { MoreVert, PlayArrowOutlined } from '@mui/icons-material';
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { Task } from '@tunarr/types';
import { maxBy, minBy } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import { MRT_Table, useMaterialReactTable } from 'material-react-table';
import { useSnackbar } from 'notistack';
import { useCallback, useMemo, useState } from 'react';
import {
  getApiTasksOptions,
  postApiTasksByIdRunMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import type { Nullable } from '../../types/util.ts';

export default function TaskSettingsPage() {
  const snackbar = useSnackbar();
  const { data: tasks } = useSuspenseQuery({
    ...getApiTasksOptions(),
    refetchInterval: 60 * 1000, // Check tasks every minute
  });
  const dayjs = useDayjs();
  const [selectedTaskMenu, setSelectedTaskMenu] =
    useState<Nullable<string>>(null);
  const [menuRef, setMenuRef] = useState<Nullable<HTMLElement>>(null);

  const runTaskNowMutation = useMutation({
    ...postApiTasksByIdRunMutation(),
  });

  const runTaskNow = useCallback(
    (taskId: string) => {
      runTaskNowMutation.mutate(
        {
          path: {
            id: taskId,
          },
          query: {
            background: true,
          },
        },
        {
          onSuccess: () => {
            snackbar.enqueueSnackbar({
              variant: 'success',
              message: `Successfully scheduled ${taskId} (running in background).`,
            });
          },
          onError: (e) => {
            console.error(e);
            snackbar.enqueueSnackbar({
              variant: 'error',
              message: `Error while scheduling ${taskId}. Check server logs for details`,
            });
          },
        },
      );
      setSelectedTaskMenu(null);
      setMenuRef(null);
    },
    [runTaskNowMutation, snackbar],
  );

  const columns = useMemo<MRT_ColumnDef<Task>[]>(
    () => [
      {
        header: 'Name',
        accessorKey: 'name',
      },
      {
        header: 'Description',
        id: 'description',
        accessorFn: (row) => {
          return row.description ?? '-';
        },
        enableSorting: false,
      },
      {
        header: 'Last Scheduled Execution',
        id: 'lastScheduledExecution',
        accessorFn: (originalRow) => {
          const max = maxBy(
            originalRow.scheduledTasks,
            (task) => task.lastExecutionEpoch,
          );
          const epoch = max?.lastExecutionEpoch;
          if (!epoch) {
            return '-';
          }
          return dayjs(epoch * 1000).format('llll');
        },
      },
      {
        header: 'Next Scheduled Execution',
        id: 'nextScheduledExecution',
        accessorFn: (originalRow) => {
          const min = minBy(
            originalRow.scheduledTasks,
            (task) => task.nextExecutionEpoch,
          );
          const epoch = min?.nextExecutionEpoch;
          if (!epoch) {
            return '-';
          }
          return dayjs(epoch * 1000).format('llll');
        },
      },
    ],
    [dayjs],
  );

  const openTaskActionMenu = useCallback(
    (target: HTMLElement, taskId: string) => {
      setMenuRef(target);
      setSelectedTaskMenu(taskId);
    },
    [],
  );

  const table = useMaterialReactTable<Task>({
    columns,
    data: tasks ?? [],
    enableRowActions: true,
    layoutMode: 'semantic',
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
        <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: '8px' }}>
          <IconButton
            onClick={(e) =>
              openTaskActionMenu(e.currentTarget, row.original.id)
            }
          >
            <MoreVert />
          </IconButton>
          <Menu
            open={!!menuRef && row.original.id === selectedTaskMenu}
            anchorEl={menuRef}
            onClose={() => setMenuRef(null)}
          >
            <MenuItem onClick={() => runTaskNow(row.original.id)}>
              <ListItemIcon>
                <PlayArrowOutlined />
              </ListItemIcon>
              <ListItemText primary="Run" />
            </MenuItem>
          </Menu>
        </Box>
      );
    },
  });

  return (
    <Stack gap={2}>
      <Box>
        <Typography variant="h4">Tasks</Typography>
        <Typography>
          Tunarr runs various tasks, sometimes on a schedule, for background
          operations.
        </Typography>
      </Box>
      <MRT_Table table={table} />
      {/* <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Task Name</TableCell>
              <TableCell> Last Execution</TableCell>
              <TableCell>Next Execution</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {renderTableRows()}
            <TableRow>
              <TableCell>Clear M3U Cache</TableCell>
              <TableCell>-</TableCell>
              <TableCell>--</TableCell>
              <TableCell>
                <Button
                  onClick={() =>
                    clearM3UCacheMutation.mutate(
                      {},
                      {
                        onSettled: () => {
                          clearM3UCacheMutation.reset();
                        },
                      },
                    )
                  }
                  disabled={clearM3UCacheMutation.isPending}
                  startIcon={
                    clearM3UCacheMutation.isPending ? (
                      <StyledLoopIcon />
                    ) : (
                      <PlayArrowOutlined />
                    )
                  }
                  variant="contained"
                >
                  Run Now
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer> */}
    </Stack>
  );
}
