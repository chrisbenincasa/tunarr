import { z } from 'zod/v4';

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  running: z.boolean(),
  lastExecution: z.string().optional(),
  lastExecutionEpoch: z.number().optional(),
  nextExecution: z.string().optional(),
  nextExecutionEpoch: z.number().optional(),
});
