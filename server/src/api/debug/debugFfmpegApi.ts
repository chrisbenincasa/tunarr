import { FfmpegStreamFactory } from '@/ffmpeg/FfmpegStreamFactory.js';
import { NutOutputFormat } from '@/ffmpeg/builder/constants.js';
import { LocalFileStreamDetails } from '@/stream/local/LocalFileStreamDetails.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import dayjs from 'dayjs';
import { z } from 'zod';
import { container } from '../../container.ts';
import type { FFmpegFactory } from '../../ffmpeg/FFmpegModule.ts';
import { KEYS } from '../../types/inject.ts';

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
      const details = new LocalFileStreamDetails(
        req.query.path,
        req.serverCtx.settings,
      );
      return res.send(await details.getStream());
    },
  );

  fastify.get(
    '/ffmpeg/pipeline',
    {
      schema: {
        tags: ['Debug'],
        querystring: z.object({
          channel: z.coerce.number().or(z.string()),
          path: z.string(),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(
        req.query.channel,
      );

      if (!channel) {
        return res.status(404).send();
      }

      const transcodeConfig =
        await req.serverCtx.transcodeConfigDB.getChannelConfig(channel.uuid);

      const details = new LocalFileStreamDetails(
        req.query.path,
        req.serverCtx.settings,
      );
      const streamDetails = await details.getStream();

      if (!streamDetails) {
        return res.status(500).send();
      }

      const ffmpeg = container.getNamed<FFmpegFactory>(
        KEYS.FFmpegFactory,
        FfmpegStreamFactory.name,
      )(transcodeConfig, channel, channel.streamMode);

      const session = await ffmpeg.createStreamSession({
        ...streamDetails,
        duration: dayjs.duration({ seconds: 30 }),
        outputFormat: NutOutputFormat,
        realtime: false,
        startTime: dayjs.duration(0),
        watermark: channel.watermark ?? undefined,
        streamMode: channel.streamMode,
      });

      return res.send({
        args: session?.process.args.join(' '),
      });
    },
  );
};
