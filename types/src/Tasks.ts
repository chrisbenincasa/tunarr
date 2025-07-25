import type { z } from 'zod/v4';
import type { TaskSchema } from './schemas/tasksSchema.js';

type Alias<T> = T & { _?: never };

export type Task = Alias<z.infer<typeof TaskSchema>>;
