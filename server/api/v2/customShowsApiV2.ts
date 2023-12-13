import { CustomShow } from '../../dao/entities/CustomShow.js';
import createLogger from '../../logger.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';

const logger = createLogger(import.meta);

// eslint-disable-next-line @typescript-eslint/require-await
export const customShowsApiV2: RouterPluginAsyncCallback = async (fastify) => {
  fastify.addHook('onError', (req, _, error, done) => {
    logger.error(req.routeConfig.url, error);
    done();
  });

  fastify.get('/custom-shows', async (req, res) => {
    const customShows = await req.entityManager.find(
      CustomShow,
      {},
      {
        // populate: ['content'],
      },
    );

    return res.send(customShows);
  });
};
