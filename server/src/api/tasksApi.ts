import { GlobalScheduler } from '@/services/Scheduler.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import { BaseErrorSchema } from '@tunarr/types/api';
import { TaskSchema } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { isEmpty, isNil } from 'lodash-es';
import { z } from 'zod/v4';
import { container } from '../container.ts';
import { RemoveDanglingProgramsFromSearchTask } from '../tasks/RemoveDanglingProgramsFromSearchTask.ts';
import type { Task } from '../tasks/Task.ts';
import { KEYS } from '../types/inject.ts';

// eslint-disable-next-line @typescript-eslint/require-await
export const tasksApiRouter: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'TasksApi',
  });

  fastify.get(
    '/jobs',
    {
      schema: {
        tags: ['System', 'Tasks'],
        response: {
          200: z.array(TaskSchema),
        },
      },
    },
    async (_, res) => {
      const allJobs = seq.collectMapValues(
        GlobalScheduler.scheduledJobsById,
        (tasks, id) => {
          if (isNil(tasks) || isEmpty(tasks)) {
            return;
          }

          // TODO: We're goingn to have to figure out a better way
          // to represnt this in the API
          const task = tasks[0]!;

          const lastExecution = task.lastExecution
            ? dayjs(task.lastExecution)
            : undefined;
          const nextExecution = task.nextExecution()
            ? dayjs(task.nextExecution())
            : undefined;

          return {
            id,
            name: task.name,
            running: task.running,
            lastExecution: lastExecution?.format(),
            lastExecutionEpoch: lastExecution?.unix(),
            nextExecution: nextExecution?.format(),
            nextExecutionEpoch: nextExecution?.unix(),
          };
        },
      );

      allJobs.push({
        id: RemoveDanglingProgramsFromSearchTask.ID,
        name: RemoveDanglingProgramsFromSearchTask.name,
        running: false,
        lastExecution: undefined,
        lastExecutionEpoch: undefined,
        nextExecution: undefined,
        nextExecutionEpoch: undefined,
      });

      return res.send(allJobs);
    },
  );

  fastify.post(
    '/jobs/:id/run',
    {
      schema: {
        tags: ['System', 'Tasks'],
        params: z.object({
          id: z.string(),
        }),
        querystring: z.object({
          background: z.stringbool().default(true),
        }),
        response: {
          200: z.any(),
          202: z.void(),
          400: BaseErrorSchema,
          404: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      const tasks = GlobalScheduler.getScheduledJobs(req.params.id);
      if (isNil(tasks) || isEmpty(tasks)) {
        const allTasks = container.getAll<Task>(KEYS.Task);
        const matchedTask = allTasks.find(
          (task) => task.taskName === req.params.id,
        );
        if (!matchedTask) {
          return res.status(404).send();
        }

        const runPromise = matchedTask.run();
        if (req.query.background) {
          try {
            const result = await runPromise;
            return res.send(result);
          } catch (e) {
            logger.error(e, 'Task %s failed to run', matchedTask.taskName);
            return res.status(500).send();
          }
        } else {
          runPromise.catch((e) => {
            logger.error(e, 'Async task triggered by API failed');
          });
          return res.status(202).send();
        }
      } else {
        const task = tasks[0]!;
        if (task.running) {
          return res.status(400).send({ message: 'Task already running' });
        }
        const taskPromise = task.runNow(req.query.background);

        if (!req.query.background) {
          try {
            const result = await taskPromise;
            return res.send(result);
          } catch (e) {
            logger.error(e, 'Task %s failed to run', task.name);
            return res.status(500).send();
          }
        } else {
          taskPromise.catch((e) => {
            logger.error(e, 'Async task triggered by API failed');
          });
          return res.status(202).send();
        }
      }
    },
  );
};
