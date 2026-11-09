import type { Task } from '@tunarr/types';
import { maxBy, minBy } from 'lodash-es';

// A task can have several schedules. Its last run is the latest of theirs and
// its next run the earliest.
export const lastRunEpoch = (task: Task) =>
  maxBy(task.scheduledTasks, (s) => s.lastExecutionEpoch)?.lastExecutionEpoch;

export const nextRunEpoch = (task: Task) =>
  minBy(task.scheduledTasks, (s) => s.nextExecutionEpoch)?.nextExecutionEpoch;

export type TaskStatus = 'running' | 'scheduled' | 'manual';

export const taskStatus = (task: Task): TaskStatus => {
  if (task.scheduledTasks.some((s) => s.running)) {
    return 'running';
  }
  return task.scheduledTasks.length > 0 ? 'scheduled' : 'manual';
};
