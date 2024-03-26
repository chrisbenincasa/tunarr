import { BaseErrorSchema } from '@tunarr/types/api';
import { TaskSchema } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { chain, isNil } from 'lodash-es';
import { z } from 'zod';
import createLogger from '../logger.js';
import { GlobalScheduler } from '../services/scheduler.js';
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
      const result = chain(GlobalScheduler.scheduledJobsById)
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
          background: z.boolean().default(true),
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
      const task = GlobalScheduler.getScheduledJob(req.params.id);
      if (isNil(task)) {
        return res.status(404).send();
      }

      if (isNil(task)) {
        return res.status(404).send();
      }

      if (task.running()) {
        return res.status(400).send({ message: 'Task already running' });
      }

      const taskPromise = task.runNow(req.params.background).catch((e) => {
        logger.error('Async task triggered by API failed: %O', e);
      });

      if (!req.params.background) {
        return taskPromise
          .then((result) => res.status(200).send(result))
          .catch(() => res.status(500).send());
      } else {
        return res.status(202).send();
      }
    },
  );
};
