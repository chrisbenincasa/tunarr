import { Loop, PlayArrowOutlined } from '@mui/icons-material';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@tunarr/types';
import dayjs from 'dayjs';
import { map } from 'lodash-es';
import { useSnackbar } from 'notistack';
import {
  deleteApiChannelsM3uMutation,
  getApiChannelsAllLineupsQueryKey,
  getApiJobsOptions,
  postApiJobsByIdRunMutation,
} from '../../generated/@tanstack/react-query.gen.ts';

const StyledLoopIcon = styled(Loop)({
  animation: 'spin 2s linear infinite',
  '@keyframes spin': {
    '0%': {
      transform: 'rotate(360deg)',
    },
    '100%': {
      transform: 'rotate(0deg)',
    },
  },
});

// Separated so we can track mutation state individually
function TaskRow({ task }: { task: Task }) {
  const queryClient = useQueryClient();

  const runJobMutation = useMutation({
    ...postApiJobsByIdRunMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: getApiChannelsAllLineupsQueryKey(),
      });
    },
    onMutate: async ({ path: { id } }) => {
      await queryClient.cancelQueries({ queryKey: ['jobs'] });
      const prevJobs = queryClient.getQueryData<Task[]>(['jobs']);
      const now = new Date();
      queryClient.setQueryData(
        ['jobs'],
        map(prevJobs, (j) => {
          return j.id === id
            ? {
                ...j,
                lastExecution: now,
                lastExecutionEpoch: now.getTime() / 1000,
              }
            : j;
        }),
      );
    },
  });

  const runJobWithId = (id: string) => {
    runJobMutation.mutate({ path: { id } });
  };

  return (
    <TableRow key={task.id}>
      <TableCell>{task.name}</TableCell>
      <TableCell>
        {task.lastExecutionEpoch
          ? dayjs(task.lastExecutionEpoch * 1000).format('llll')
          : 'Never run'}
      </TableCell>
      <TableCell>
        {task.nextExecutionEpoch
          ? dayjs(task.nextExecutionEpoch * 1000).format('llll')
          : 'Not scheduled'}
      </TableCell>
      <TableCell>
        <Button
          onClick={() => runJobWithId(task.id)}
          disabled={runJobMutation.isPending || task.running}
          startIcon={
            runJobMutation.isPending || task.running ? (
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
  );
}

export default function TaskSettingsPage() {
  const snackbar = useSnackbar();
  const { isPending, data: tasks } = useQuery({
    ...getApiJobsOptions(),
    refetchInterval: 60 * 1000, // Check tasks every minute
  });

  const clearM3UCacheMutation = useMutation({
    ...deleteApiChannelsM3uMutation(),
    onSuccess: () => {
      snackbar.enqueueSnackbar('Successfully cleared m3u cache', {
        variant: 'success',
      });
    },
  });

  const renderTableRows = () => {
    if (isPending) {
      return (
        <TableRow>
          <TableCell colSpan={4}>Loading...</TableCell>
        </TableRow>
      );
    }

    if (!tasks || tasks.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={4}>No Scheduled Tasks!</TableCell>
        </TableRow>
      );
    }

    return tasks.map((task) => <TaskRow key={task.id} task={task} />);
  };

  return (
    <>
      <Typography variant="h4">Tasks</Typography>
      <TableContainer>
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
      </TableContainer>
    </>
  );
}
