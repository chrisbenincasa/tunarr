import { chain, hasIn, isNil } from 'lodash-es';
import { scheduledJobsById } from '../../services/scheduler.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';
import dayjs from 'dayjs';
import { z } from 'zod';
import { TaskId } from '../../tasks/task.js';
import createLogger from '../../logger.js';
import { TaskSchema } from '@tunarr/types/schemas';

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
          400: z.object({ reason: z.string() }),
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
        return res.status(400).send({ reason: 'Task already running' });
      }

      task.runNow(true).catch((e) => {
        logger.error('Async task triggered by API failed: %O', e);
      });

      return res.status(202).send();
    },
  );
};
