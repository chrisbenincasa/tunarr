import { FfmpegStreamFactory } from '@/ffmpeg/FfmpegStreamFactory.js';
import { MpegTsOutputFormat } from '@/ffmpeg/builder/constants.js';
import { FfprobeStreamDetails } from '@/stream/FfprobeStreamDetails.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import dayjs from 'dayjs';
import { z } from 'zod/v4';
import { container } from '../../container.ts';
import type { ContentBackedStreamLineupItem } from '../../db/derived_types/StreamLineup.ts';
import { isContentBackedLineupItem } from '../../db/derived_types/StreamLineup.ts';
import type { FFmpegFactory } from '../../ffmpeg/FFmpegModule.ts';
import type { FfmpegEncoder } from '../../ffmpeg/ffmpegInfo.ts';
import { FfmpegInfo } from '../../ffmpeg/ffmpegInfo.ts';
import { ExternalStreamDetailsFetcherFactory } from '../../stream/StreamDetailsFetcher.ts';
import type { ProgramStreamResult } from '../../stream/types.ts';
import { KEYS } from '../../types/inject.ts';
import type { Nullable } from '../../types/util.ts';

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

  fastify.get(
    '/ffmpeg/pipeline',
    {
      schema: {
        tags: ['Debug'],
        querystring: z.object({
          channel: z.coerce.number().or(z.string()),
          path: z.string().optional(),
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

      let streamDetails: Nullable<ProgramStreamResult>;
      let lineupItem: ContentBackedStreamLineupItem;
      if (req.query.path) {
        streamDetails = await container
          .get<FfprobeStreamDetails>(FfprobeStreamDetails)
          .getStream({ path: req.query.path });
        lineupItem = {
          duration: +dayjs.duration({ seconds: 30 }),
          contentDuration: +dayjs.duration({ seconds: 30 }),
          infiniteLoop: false,
          streamDuration: +dayjs.duration({ seconds: 30 }),
          externalKey: 'none',
          externalSource: 'emby',
          externalSourceId: 'none',
          programBeginMs: 0,
          programId: '',
          programType: 'movie',
          type: 'program',
          title: req.query.path,
        };
      } else {
        const lineupItemResult =
          await req.serverCtx.streamProgramCalculator.getCurrentLineupItem({
            allowSkip: false,
            channelId: channel.uuid,
            startTime: +dayjs(),
          });
        if (lineupItemResult.isFailure()) {
          return res.status(500).send();
        }

        const item = lineupItemResult.get().lineupItem;
        if (!isContentBackedLineupItem(item)) {
          return res.status(500).send();
        }

        const server = await req.serverCtx.mediaSourceDB.getByName(
          item.externalSourceId,
        );

        if (!server) {
          return res
            .status(500)
            .send('No server id = ' + item.externalSourceId);
        }

        lineupItem = item;
        streamDetails = await container
          .get<ExternalStreamDetailsFetcherFactory>(
            ExternalStreamDetailsFetcherFactory,
          )
          .getStream({
            lineupItem: {
              ...item,
              externalFilePath: item.plexFilePath ?? undefined,
            },
            server,
          });
      }

      if (!streamDetails) {
        return res.status(500).send();
      }

      const ffmpeg = container.getNamed<FFmpegFactory>(
        KEYS.FFmpegFactory,
        FfmpegStreamFactory.name,
      )(transcodeConfig, channel, channel.streamMode);

      const session = await ffmpeg.createStreamSession({
        stream: {
          details: streamDetails.streamDetails,
          source: streamDetails.streamSource,
        },
        lineupItem,
        options: {
          duration: dayjs.duration({ seconds: 30 }),
          outputFormat: MpegTsOutputFormat,
          realtime: false,
          startTime: dayjs.duration(0),
          watermark: channel.watermark ?? undefined,
          streamMode: channel.streamMode,
        },
      });

      return res.send({
        args: session?.process.args.join(' '),
      });
    },
  );
};
