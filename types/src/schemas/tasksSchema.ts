import { z } from 'zod/v4';

export const ScheduledTaskSchema = z.object({
  running: z.boolean(),
  lastExecution: z.string().optional(),
  lastExecutionEpoch: z.number().optional(),
  nextExecution: z.string().optional(),
  nextExecutionEpoch: z.number().optional(),
  args: z.object().or(z.string()).or(z.unknown()),
});

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  scheduledTasks: z.array(ScheduledTaskSchema),
});
