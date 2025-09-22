import { FfprobeStreamDetails } from '@/stream/FfprobeStreamDetails.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { z } from 'zod/v4';
import { container } from '../../container.ts';
import type { FfmpegEncoder } from '../../ffmpeg/ffmpegInfo.ts';
import { FfmpegInfo } from '../../ffmpeg/ffmpegInfo.ts';

export const debugFfmpegApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get(
    '/ffmpeg/probe',
    {
      schema: {
        tags: ['Debug'],
        querystring: z.object({
          path: z.string(),
        }),
      },
    },
    async (req, res) => {
      const details = await container
        .get<FfprobeStreamDetails>(FfprobeStreamDetails)
        .getStream({ path: req.query.path });
      return res.send(details);
    },
  );

  fastify.get('/ffmpeg/capabilities', async (_, res) => {
    const info = container.get(FfmpegInfo);
    const capabilities = await info.getCapabilities();
    return res.send({
      options: [...capabilities.allOptions()],
      filters: [...capabilities.allFilters()],
      videoEncoders: capabilities
        .allVideoEncoders()
        .entries()
        .reduce(
          (acc, [key, value]) => {
            acc[key] = value;
            return acc;
          },
          {} as Record<string, FfmpegEncoder>,
        ),
    });
  });
};
