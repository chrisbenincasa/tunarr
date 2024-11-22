import { FfmpegStreamFactory } from '@/ffmpeg/FfmpegStreamFactory.ts';
import { NutOutputFormat } from '@/ffmpeg/builder/constants.ts';
import { LocalFileStreamDetails } from '@/stream/local/LocalFileStreamDetails.ts';
import { RouterPluginAsyncCallback } from '@/types/serverType.ts';
import dayjs from 'dayjs';
import { z } from 'zod';

export const debugFfmpegApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get(
    '/ffmpeg/probe',
    {
      schema: {
        querystring: z.object({
          path: z.string(),
        }),
      },
    },
    async (req, res) => {
      const details = new LocalFileStreamDetails(req.query.path);
      return res.send(await details.getStream());
    },
  );

  fastify.get(
    '/ffmpeg/pipeline',
    {
      schema: {
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
      const details = new LocalFileStreamDetails(req.query.path);
      const streamDetails = await details.getStream();

      if (!streamDetails) {
        return res.status(500).send();
      }

      const ffmpeg = new FfmpegStreamFactory(
        req.serverCtx.settings.ffmpegSettings(),
        channel,
      );

      console.log(channel.watermark);

      const session = await ffmpeg.createStreamSession({
        ...streamDetails,
        duration: dayjs.duration({ seconds: 30 }),
        outputFormat: NutOutputFormat,
        realtime: false,
        startTime: dayjs.duration(0),
        watermark: channel.watermark ?? undefined,
      });

      return res.send({
        args: session?.process.args.join(' '),
      });
    },
  );
};
