import { useLingui } from '@lingui/react/macro';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { Task } from '@tunarr/types';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';
import { TasksView } from '../../components/system/tasks/TasksView.tsx';
import {
  getApiTasksOptions,
  postApiTasksByIdRunMutation,
} from '../../generated/@tanstack/react-query.gen.ts';

export default function TaskSettingsPage() {
  const { t } = useLingui();
  const snackbar = useSnackbar();
  const { data: tasks } = useSuspenseQuery({
    ...getApiTasksOptions(),
    refetchInterval: 60 * 1000,
  });
  const { mutate: runTask } = useMutation({
    ...postApiTasksByIdRunMutation(),
  });

  const runTaskNow = useCallback(
    (task: Task) => {
      runTask(
        { path: { id: task.id }, query: { background: true } },
        {
          onSuccess: () => {
            snackbar.enqueueSnackbar({
              variant: 'success',
              message: t`Successfully scheduled ${task.id} (running in background).`,
            });
          },
          onError: (e) => {
            console.error(e);
            snackbar.enqueueSnackbar({
              variant: 'error',
              message: t`Error while scheduling ${task.id}. Check server logs for details`,
            });
          },
        },
      );
    },
    [runTask, snackbar, t],
  );

  return <TasksView tasks={tasks} onRunTask={runTaskNow} />;
}
