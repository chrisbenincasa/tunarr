import { PlayArrowOutlined } from '@mui/icons-material';
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
import { useMutation, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { apiClient } from '../../external/api.ts';
import { Task } from '@tunarr/types';

// Separated so we can track mutation state individually
function TaskRow({ task }: { task: Task }) {
  const runJobMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.runTask(undefined, { params: { id } });
    },
  });

  const runJobWithId = (id: string) => {
    runJobMutation.mutate(id);
  };

  return (
    <TableRow key={task.id}>
      <TableCell>{task.name}</TableCell>
      <TableCell>
        {task.lastExecutionEpoch
          ? dayjs(task.lastExecutionEpoch * 1000).format()
          : 'Never run'}
      </TableCell>
      <TableCell>
        {task.nextExecutionEpoch
          ? dayjs(task.nextExecutionEpoch * 1000).format()
          : 'Not scheduled'}
      </TableCell>
      <TableCell>
        <Button
          onClick={() => runJobWithId(task.id)}
          disabled={runJobMutation.isPending || task.running}
          startIcon={<PlayArrowOutlined />}
        >
          Run Now
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function TaskSettingsPage() {
  const { isPending, data: tasks } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      return apiClient.getTasks();
    },
    refetchInterval: 60 * 1000, // Check tasks every minute
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
          <TableBody>{renderTableRows()}</TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
