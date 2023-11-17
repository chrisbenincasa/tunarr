import { map } from 'lodash-es';
import { scheduledJobsById } from '../../services/scheduler.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const tasksApiRouter: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get('/jobs', async (_, res) => {
    const result = map(scheduledJobsById, (task, id) => {
      return {
        id,
        lastExecution: task?.lastExecution?.toLocaleString('en-US', {
          timeZone: 'America/New_York',
        }),
        nextExecution: task
          ?.nextExecution()
          .toLocaleString('en-US', { timeZone: 'America/New_York' }),
      };
    });

    return res.send(result);
  });
};
