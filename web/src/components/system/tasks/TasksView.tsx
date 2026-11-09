import { useDayjs } from '@/hooks/useDayjs.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import { PlayArrowOutlined, Schedule } from '@mui/icons-material';
import { Box, IconButton, Tooltip } from '@mui/material';
import type { Task } from '@tunarr/types';
import { useMemo } from 'react';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { PageHeader } from '../../ui/PageHeader.tsx';
import {
  CollectionView,
  type CollectionLayout,
} from '../../ui/patterns/CollectionView/index.ts';
import { DataTable } from '../../ui/table/DataTable.tsx';
import { actionsColumn } from '../../ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../../ui/table/tunarrTable.ts';
import { useStoreBackedTableSettings } from '../../ui/table/useStoreBackedTableSettings.ts';
import { TaskCard } from './TaskCard.tsx';
import { TaskStatusPill } from './TaskStatusPill.tsx';
import { lastRunEpoch, nextRunEpoch, taskStatus } from './taskSchedule.ts';

export type TasksViewProps = {
  tasks: Task[];
  onRunTask: (task: Task) => void;
  layout?: CollectionLayout;
};

const columnHelper = createAppColumnHelper<Task>();

export const TasksView = ({ tasks, onRunTask, layout }: TasksViewProps) => {
  const { t } = useLingui();
  const dayjs = useDayjs();
  const tableState = useStoreBackedTableSettings('Tasks');

  const columns = useMemo(() => {
    const formatEpoch = (epoch: number | undefined) =>
      epoch ? dayjs(epoch * 1000).format('llll') : '-';

    return [
      ...columnHelper.columns([
        columnHelper.accessor('name', {
          header: t`Name`,
          cell: ({ getValue }) => (
            <Box component="span" sx={{ fontWeight: 600 }}>
              {getValue()}
            </Box>
          ),
        }),
        columnHelper.accessor((task) => task.description ?? '-', {
          id: 'description',
          header: t`Description`,
          enableSorting: false,
        }),
        columnHelper.accessor(taskStatus, {
          id: 'status',
          header: t`Status`,
          cell: ({ row }) => <TaskStatusPill task={row.original} />,
        }),
        columnHelper.accessor((task) => formatEpoch(lastRunEpoch(task)), {
          id: 'lastScheduledExecution',
          header: t`Last Scheduled Execution`,
        }),
        columnHelper.accessor((task) => formatEpoch(nextRunEpoch(task)), {
          id: 'nextScheduledExecution',
          header: t`Next Scheduled Execution`,
        }),
      ]),
      actionsColumn<Task>({
        render: ({ original: task }) => (
          <Tooltip title={t`Run now`} placement="top">
            <IconButton aria-label={t`Run now`} onClick={() => onRunTask(task)}>
              <PlayArrowOutlined />
            </IconButton>
          </Tooltip>
        ),
      }),
    ];
  }, [dayjs, t, onRunTask]);

  const table = useTunarrTable({
    columns,
    data: tasks,
    getRowId: (task) => task.id,
    ...tableState,
  });

  const empty = (
    <EmptyState
      icon={<Schedule />}
      title={<Trans>No tasks are registered.</Trans>}
      description={
        <Trans>
          Tunarr registers its background tasks when the server starts. Check
          the server logs if this list stays empty.
        </Trans>
      }
    />
  );

  return (
    <>
      <PageHeader
        title={<Trans>Tasks</Trans>}
        subtitle={
          <Trans>
            Tunarr runs various tasks, sometimes on a schedule, for background
            operations.
          </Trans>
        }
      />
      <CollectionView
        aria-label={t`Tasks`}
        layout={layout}
        items={tasks}
        getItemKey={(task) => task.id}
        empty={empty}
        minCardWidth={280}
        pagination={{
          state: tableState.state.pagination,
          onChange: tableState.onPaginationChange,
        }}
        renderCard={(task) => (
          <TaskCard task={task} onRun={() => onRunTask(task)} />
        )}
        table={
          <DataTable
            table={table}
            aria-label={t`Tasks`}
            emptyFallback={empty}
          />
        }
      />
    </>
  );
};
