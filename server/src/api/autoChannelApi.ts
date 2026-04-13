import {
  AutoChannelCreateRequestSchema,
  ChannelPresetSchema,
  ContentPreviewResponseSchema,
  ContentQuerySchema,
} from '@tunarr/types/api';
import { ChannelSchema } from '@tunarr/types/schemas';
import { inject, injectable } from 'inversify';
import { z } from 'zod/v4';
import { AutoChannelService } from '../services/AutoChannelService.ts';
import type { RouterPluginAsyncCallback } from '../types/serverType.js';
import type { ApiController } from './ApiController.ts';

@injectable()
export class AutoChannelApiController implements ApiController {
  constructor(
    @inject(AutoChannelService) private autoChannelService: AutoChannelService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  mount: RouterPluginAsyncCallback = async (fastify) => {
    fastify.get(
      '/auto-channels/presets',
      {
        schema: {
          tags: ['Auto Channels'],
          description: 'List available channel presets',
          response: {
            200: ChannelPresetSchema.array(),
          },
        },
      },
      async (_req, res) => {
        const presets = this.autoChannelService.getPresets();
        return res.send(presets);
      },
    );

    fastify.post(
      '/auto-channels/preview-content',
      {
        schema: {
          tags: ['Auto Channels'],
          description: 'Preview content matching a query',
          body: ContentQuerySchema,
          response: {
            200: ContentPreviewResponseSchema,
          },
        },
      },
      async (req, res) => {
        const preview = await this.autoChannelService.previewContent(req.body);
        return res.send(preview);
      },
    );

    fastify.post(
      '/auto-channels/create',
      {
        schema: {
          tags: ['Auto Channels'],
          description: 'Create a channel from a preset',
          body: AutoChannelCreateRequestSchema,
          response: {
            201: ChannelSchema,
            400: z.object({ message: z.string() }),
            500: z.object({ message: z.string() }),
          },
        },
      },
      async (req, res) => {
        try {
          const channel = await this.autoChannelService.createChannel(req.body);
          return res.status(201).send(channel);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return res.status(400).send({ message });
        }
      },
    );
  };
}
