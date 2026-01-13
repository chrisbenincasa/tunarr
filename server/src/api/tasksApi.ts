import { GlobalScheduler } from '@/services/Scheduler.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import { TaskSchema } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { z } from 'zod/v4';
import { container } from '../container.ts';
import type { GenericTask } from '../tasks/Task.ts';
import { TaskRegistry } from '../tasks/TaskRegistry.ts';

// eslint-disable-next-line @typescript-eslint/require-await
export const tasksApiRouter: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'TasksApi',
  });

  fastify.get(
    '/tasks',
    {
      schema: {
        tags: ['System', 'Tasks'],
        response: {
          200: z.array(TaskSchema),
        },
      },
    },
    async (_, res) => {
      const allTasks = TaskRegistry.getAll();

      const tasks = Object.entries(allTasks).map(([name, def]) => {
        const scheduledTasks = seq.collect(
          GlobalScheduler.scheduledJobsById[name],
          (scheduledTask) => {
            if (!scheduledTask.visible) {
              return;
            }

            const lastExecution = scheduledTask.lastExecution
              ? dayjs(scheduledTask.lastExecution)
              : undefined;
            const nextExecution = scheduledTask.nextExecution()
              ? dayjs(scheduledTask.nextExecution())
              : undefined;
            return {
              running: scheduledTask.running,
              lastExecution: lastExecution?.format(),
              lastExecutionEpoch: lastExecution?.unix(),
              nextExecution: nextExecution?.format(),
              nextExecutionEpoch: nextExecution?.unix(),
              args: scheduledTask.presetArgs,
              // schedule: scheduledTask.schedule,
            };
          },
        );
        return {
          id: def.name,
          name: def.name,
          description: def.description,
          scheduledTasks,
          schema: z.toJSONSchema(def.schema, { unrepresentable: 'any' }),
        };
      });

      return res.send(tasks);
    },
  );

  fastify.post(
    '/tasks/:id/run',
    {
      schema: {
        tags: ['System', 'Tasks'],
        params: z.object({
          id: z.string(),
        }),
        querystring: z.object({
          background: z.coerce
            .boolean()
            .or(z.stringbool())
            .optional()
            .default(true),
        }),
        body: z.any(),
        response: {
          200: z.any(),
          202: z.void(),
          400: z.void(),
          404: z.string(),
        },
      },
    },
    async (req, res) => {
      const taskDef = TaskRegistry.getTask(req.params.id);
      if (!taskDef) {
        return res
          .status(404)
          .send(`Task with ID ${req.params.id} does not exist`);
      }
      const parsed = taskDef.schema.safeParse(req.body, { reportInput: true });
      if (parsed.error) {
        logger.error(parsed.error, z.prettifyError(parsed.error));
        return res.status(400).send();
      }
      const task = container.get<GenericTask>(taskDef.injectKey);
      task.logLevel = 'info';
      if (req.query.background) {
        setTimeout(() => {
          task.run(parsed.data).catch((e) => {
            logger.error(
              e,
              'Error while running task %s in background (via API)',
              req.params.id,
            );
          });
        }, 0);
        return res.status(202).send();
      } else {
        const result = await task.run(parsed.data);
        if (result.isFailure()) {
          throw result.error;
        }
        return res.send(result.get());
      }
    },
  );
};
