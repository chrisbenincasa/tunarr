import { PlexWebhookPayloadSchema } from '@tunarr/types/plex';
import createLogger from '../logger';
import { RouterPluginAsyncCallback } from '../types/serverType';

const logger = createLogger(import.meta);

// eslint-disable-next-line @typescript-eslint/require-await
export const plexWebhookRouter: RouterPluginAsyncCallback = async (f) => {
  f.post(
    '/plex/webhook',
    {
      schema: {
        consumes: ['multipart/form-data'],
      },
    },
    async (req, res) => {
      for await (const part of req.parts()) {
        if (part.type === 'field' && part.mimetype === 'application/json') {
          const parseResult = await PlexWebhookPayloadSchema.safeParseAsync(
            part.value,
          );
          logger.info('Payload: %O', part.value);
          if (!parseResult.success) {
            logger.error(
              'Unable to parse Plex webhook payload: %O',
              parseResult.error,
            );
            return res.status(400).send();
          }
        }
      }

      return res.send();
    },
  );
};
