import { isError, isNil } from 'lodash-es';
import z from 'zod';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings.js';
import createLogger from '../../logger.js';
import { Plex } from '../../plex.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';
import { wait } from '../../util.js';
import { ErrorSchema } from '../schemas/errorSchema.js';

const logger = createLogger(import.meta);

// eslint-disable-next-line @typescript-eslint/require-await
export const plexServerApiV2: RouterPluginAsyncCallback = async (fastify) => {
  fastify.addHook('onError', (req, _, error, done) => {
    logger.error(req.routeConfig.url, error);
    done();
  });

  fastify.get(
    '/plex/status',
    {
      schema: {
        querystring: z.object({
          serverName: z.string(),
        }),
        response: {
          200: z.object({
            healthy: z.boolean(),
          }),
          404: ErrorSchema,
          500: ErrorSchema,
        },
      },
    },
    async (req, res) => {
      try {
        const server = await req.entityManager
          .repo(PlexServerSettings)
          .findOne({ name: req.query.serverName });

        if (isNil(server)) {
          return res.status(404).send({ message: 'Plex server not found.' });
        }

        const plex = new Plex(server);

        const s = await Promise.race([
          plex.checkServerStatus().then((res) => res === 1),
          wait(15000).then(() => false),
        ]);

        return res.send({
          healthy: s,
        });
      } catch (err) {
        return res.status(500).send({
          message: isError(err) ? err.message : 'Unknown error occurred',
        });
      }
    },
  );
};
