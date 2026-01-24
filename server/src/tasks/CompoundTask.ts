import { zip } from 'lodash-es';
import type z from 'zod';
import { Result } from '../types/result.ts';
import { Task2 } from './Task.ts';

export class CompoundTask<
  RequestSchema extends z.ZodType,
  ResultT = void,
> extends Task2<z.ZodArray<RequestSchema>> {
  ID = CompoundTask.name;

  constructor(
    public schema: z.ZodArray<RequestSchema>,
    private tasks: Task2<RequestSchema, ResultT>[],
  ) {
    super();
  }

  protected async runInternal(
    request: z.output<RequestSchema>[],
  ): Promise<void> {
    const zipped = zip(this.tasks, request);
    for (const [task, request] of zipped) {
      if (!task || !request) {
        continue;
      }

      const result = await Result.attemptAsync(() => task.run(request));
      if (result.isFailure()) {
        this.logger.warn(
          result.error,
          'Task %s in CompoundTask failed',
          task.taskName,
        );
      }
    }
  }
}
