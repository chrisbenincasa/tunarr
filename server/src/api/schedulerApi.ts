import { FastifyPluginCallback } from 'fastify';
import { map } from 'lodash-es';
import schedule from 'node-schedule';

export const schedulerRouter: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get('/api/v1/jobs', (_req, res) => {
    const data = map(schedule.scheduledJobs, (job, jobName) => {
      return {
        next: job.nextInvocation(),
        name: jobName,
      };
    });

    return res.send(data);
  });

  done();
};
