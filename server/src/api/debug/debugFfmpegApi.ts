import { FfmpegStreamFactory } from '@/ffmpeg/FfmpegStreamFactory.js';
import { MpegTsOutputFormat } from '@/ffmpeg/builder/constants.js';
import { LocalFileStreamDetails } from '@/stream/local/LocalFileStreamDetails.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import dayjs from 'dayjs';
import { z } from 'zod/v4';
import { container } from '../../container.ts';
import type { StreamLineupItem } from '../../db/derived_types/StreamLineup.ts';
import type { FFmpegFactory } from '../../ffmpeg/FFmpegModule.ts';
import type { FfmpegEncoder } from '../../ffmpeg/ffmpegInfo.ts';
import { FfmpegInfo } from '../../ffmpeg/ffmpegInfo.ts';
import { ExternalStreamDetailsFetcherFactory } from '../../stream/StreamDetailsFetcher.ts';
import type { ProgramStreamResult } from '../../stream/types.ts';
import { KEYS } from '../../types/inject.ts';
import type { Nullable } from '../../types/util.ts';
import { isNonEmptyString } from '../../util/index.ts';

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
        .get<LocalFileStreamDetails>(LocalFileStreamDetails)
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
          programId: z.string().optional(),
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

      let streamDetails: Nullable<ProgramStreamResult> = null;
      let lineupItem: Nullable<StreamLineupItem> = null;

      if (isNonEmptyString(req.query.path)) {
        lineupItem = {
          duration: +dayjs.duration({ seconds: 30 }),
          externalKey: 'none',
          externalSource: 'emby',
          externalSourceId: 'none',
          programBeginMs: 0,
          programId: '',
          programType: 'movie',
          type: 'program',
          title: req.query.path,
        };
        streamDetails = await container
          .get<LocalFileStreamDetails>(LocalFileStreamDetails)
          .getStream({ path: req.query.path });
      } else if (isNonEmptyString(req.query.programId)) {
        const program = await req.serverCtx.programDB.getProgramById(
          req.query.programId,
        );
        if (!program) {
          return res.status(404).send();
        }

        const mediaSource = await (program.mediaSourceId
          ? req.serverCtx.mediaSourceDB.getById(program.mediaSourceId)
          : req.serverCtx.mediaSourceDB.getByName(program.externalSourceId));
        if (!mediaSource) {
          return res.status(404).send();
        }

        lineupItem = {
          duration: program.duration,
          externalKey: program.externalKey,
          externalSource: program.sourceType,
          externalSourceId: program.mediaSourceId ?? program.externalSourceId,
          programId: program.uuid,
          type: 'program',
          title: program.title,
          programType: program.type,
          programBeginMs: 0,
        };
        streamDetails = await container
          .get<ExternalStreamDetailsFetcherFactory>(
            ExternalStreamDetailsFetcherFactory,
          )
          .getStream({
            lineupItem,
            server: mediaSource,
          });
      }

      if (!streamDetails || !lineupItem) {
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
