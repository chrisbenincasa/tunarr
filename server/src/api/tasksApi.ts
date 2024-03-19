import { BaseErrorSchema } from '@tunarr/types/api';
import { TaskSchema } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { chain, hasIn, isNil } from 'lodash-es';
import { z } from 'zod';
import createLogger from '../logger.js';
import { scheduledJobsById } from '../services/scheduler.js';
import { TaskId } from '../tasks/task.js';
import { RouterPluginAsyncCallback } from '../types/serverType.js';

const logger = createLogger(import.meta);

// eslint-disable-next-line @typescript-eslint/require-await
export const tasksApiRouter: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get(
    '/jobs',
    {
      schema: {
        response: {
          200: z.array(TaskSchema),
        },
      },
    },
    async (_, res) => {
      const result = chain(scheduledJobsById)
        .map((task, id) => {
          if (isNil(task)) {
            return;
          }

          const lastExecution = task.lastExecution
            ? dayjs(task.lastExecution)
            : undefined;
          const nextExecution = task.nextExecution()
            ? dayjs(task.nextExecution())
            : undefined;

          return {
            id,
            name: task.name,
            running: task.running(),
            lastExecution: lastExecution?.format(),
            lastExecutionEpoch: lastExecution?.unix(),
            nextExecution: nextExecution?.format(),
            nextExecutionEpoch: nextExecution?.unix(),
          };
        })
        .compact()
        .value();

      return res.send(result);
    },
  );

  fastify.post(
    '/jobs/:id/run',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          202: z.void(),
          400: BaseErrorSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      if (!hasIn(scheduledJobsById, req.params.id)) {
        return res.status(404).send();
      }

      const task = scheduledJobsById[req.params.id as TaskId];

      if (isNil(task)) {
        return res.status(404).send();
      }

      if (task.running()) {
        return res.status(400).send({ message: 'Task already running' });
      }

      task.runNow(true).catch((e) => {
        logger.error('Async task triggered by API failed: %O', e);
      });

      return res.status(202).send();
    },
  );
};
