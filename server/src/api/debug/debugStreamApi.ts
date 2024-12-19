import { getDatabase } from '@/db/DBAccess.ts';
import { createOfflineStreamLineupItem } from '@/db/derived_types/StreamLineup.ts';
import { AllChannelTableKeys, Channel } from '@/db/schema/Channel.ts';
import { ProgramDao, ProgramType } from '@/db/schema/Program.ts';
import {
  AllTranscodeConfigColumns,
  TranscodeConfig,
} from '@/db/schema/TranscodeConfig.ts';
import { MpegTsOutputFormat } from '@/ffmpeg/builder/constants.ts';
import { serverContext } from '@/serverContext.ts';
import { OfflineProgramStream } from '@/stream/OfflinePlayer.ts';
import { PlayerContext } from '@/stream/PlayerStreamContext.ts';
import { ProgramStream } from '@/stream/ProgramStream.ts';
import { JellyfinProgramStream } from '@/stream/jellyfin/JellyfinProgramStream.ts';
import { PlexProgramStream } from '@/stream/plex/PlexProgramStream.ts';
import { TruthyQueryParam } from '@/types/schemas.ts';
import { RouterPluginAsyncCallback } from '@/types/serverType.ts';
import { jsonObjectFrom } from 'kysely/helpers/sqlite';
import { isNumber, isUndefined, nth, random } from 'lodash-es';
import { PassThrough } from 'stream';
import { z } from 'zod';

export const debugStreamApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get(
    '/streams/offline',
    {
      schema: {
        querystring: z.object({
          duration: z.coerce.number().default(30_000),
          useNewPipeline: TruthyQueryParam.optional(),
        }),
      },
    },
    async (req, res) => {
      const channel = await getDatabase()
        .selectFrom('channel')
        .selectAll()
        .select((eb) =>
          jsonObjectFrom(
            eb
              .selectFrom('transcodeConfig')
              .whereRef(
                'transcodeConfig.uuid',
                '=',
                'channel.transcodeConfigId',
              )
              .select(AllTranscodeConfigColumns),
          ).as('transcodeConfig'),
        )
        .$narrowType<{ transcodeConfig: TranscodeConfig }>()
        .executeTakeFirstOrThrow();

      const stream = new OfflineProgramStream(
        false,
        new PlayerContext(
          {
            ...createOfflineStreamLineupItem(req.query.duration),
            streamDuration: req.query.duration,
          },
          channel,
          false,
          false,
          true,
          req.query.useNewPipeline ?? false,
          channel.transcodeConfig,
        ),
        MpegTsOutputFormat,
      );

      const out = new PassThrough();
      stream.on('error', () => out.end());
      await stream.start(out);
      return res.header('Content-Type', 'video/mp2t').send(out);
    },
  );

  fastify.get(
    '/streams/error',
    {
      schema: {
        querystring: z.object({
          useNewPipeline: TruthyQueryParam.optional(),
        }),
      },
    },
    async (req, res) => {
      const channel = await getDatabase()
        .selectFrom('channel')
        .selectAll()
        .select((eb) =>
          jsonObjectFrom(
            eb
              .selectFrom('transcodeConfig')
              .whereRef(
                'transcodeConfig.uuid',
                '=',
                'channel.transcodeConfigId',
              )
              .select(AllTranscodeConfigColumns),
          ).as('transcodeConfig'),
        )
        .$narrowType<{ transcodeConfig: TranscodeConfig }>()
        .executeTakeFirstOrThrow();

      const stream = new OfflineProgramStream(
        true,
        PlayerContext.error(
          30_000,
          '',
          channel,
          true,
          req.query.useNewPipeline ?? false,
          channel.transcodeConfig,
        ),
        MpegTsOutputFormat,
      );

      const out = new PassThrough();
      stream.on('error', () => out.end());
      await stream.start(out);
      return res.header('Content-Type', 'video/mp2t').send(out);
    },
  );

  fastify.get('/streams/random', async (_, res) => {
    const program = await getDatabase()
      .selectFrom('program')
      .orderBy((ob) => ob.fn('random'))
      .where('type', '=', ProgramType.Episode)
      .limit(1)
      .selectAll()
      .executeTakeFirstOrThrow();

    const channels = await getDatabase()
      .selectFrom('channelPrograms')
      .where('programUuid', '=', program.uuid)
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('channel')
            .whereRef('channel.uuid', '=', 'channelPrograms.channelUuid')
            .select((eb) =>
              jsonObjectFrom(
                eb
                  .selectFrom('transcodeConfig')
                  .whereRef(
                    'transcodeConfig.uuid',
                    '=',
                    'channel.transcodeConfigId',
                  )
                  .select(AllTranscodeConfigColumns),
              ).as('transcodeConfig'),
            )
            .select(AllChannelTableKeys),
        ).as('channel'),
      )
      .execute();

    const firstChannel = channels?.[0].channel;

    if (!firstChannel) {
      return res.status(404);
    }

    const out = await initStream(
      program,
      firstChannel,
      firstChannel.transcodeConfig!,
    );
    return res.header('Content-Type', 'video/mp2t').send(out);
  });

  fastify.get(
    '/streams/programs/:id',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        querystring: z.object({
          start: z.literal('random').or(z.coerce.number()).optional(),
          useNewPipeline: TruthyQueryParam.optional(),
        }),
      },
    },
    async (req, res) => {
      const program = await req.serverCtx.programDB.getProgramById(
        req.params.id,
      );
      if (!program) {
        return res.status(404).send();
      }

      const startTime =
        isUndefined(req.query.start) ||
        (isNumber(req.query.start) && req.query.start <= 0)
          ? 0
          : req.query.start === 'random'
          ? random(program.duration / 1000, true)
          : req.query.start;

      const channels = await getDatabase()
        .selectFrom('channelPrograms')
        .where('programUuid', '=', program.uuid)
        .select((eb) =>
          jsonObjectFrom(
            eb
              .selectFrom('channel')
              .whereRef('channel.uuid', '=', 'channelPrograms.channelUuid')
              .select((eb) =>
                jsonObjectFrom(
                  eb
                    .selectFrom('transcodeConfig')
                    .whereRef(
                      'transcodeConfig.uuid',
                      '=',
                      'channel.transcodeConfigId',
                    )
                    .select(AllTranscodeConfigColumns),
                ).as('transcodeConfig'),
              )
              .select(AllChannelTableKeys),
          ).as('channel'),
        )
        .execute();

      let firstChannel = nth(channels, 0)?.channel;

      if (!firstChannel) {
        firstChannel = await getDatabase()
          .selectFrom('channel')
          .selectAll()
          .select((eb) =>
            jsonObjectFrom(
              eb
                .selectFrom('transcodeConfig')
                .whereRef(
                  'transcodeConfig.uuid',
                  '=',
                  'channel.transcodeConfigId',
                )
                .select(AllTranscodeConfigColumns),
            ).as('transcodeConfig'),
          )
          .$narrowType<{ transcodeConfig: TranscodeConfig }>()
          .executeTakeFirstOrThrow();
      }

      const outStream = await initStream(
        program,
        firstChannel,
        firstChannel.transcodeConfig!,
        startTime * 1000,
        req.query.useNewPipeline,
      );
      return res.header('Content-Type', 'video/mp2t').send(outStream);
    },
  );

  async function initStream(
    program: ProgramDao,
    channel: Channel,
    transcodeConfig: TranscodeConfig,
    startTime: number = 0,
    useNewPipeline: boolean = false,
  ) {
    const lineupItem = serverContext()
      .streamProgramCalculator()
      .createStreamItemFromProgram(program);
    lineupItem.start = startTime;
    const ctx = new PlayerContext(
      lineupItem,
      channel,
      false,
      false,
      true,
      useNewPipeline,
      transcodeConfig,
    );

    let stream: ProgramStream;
    switch (program.sourceType) {
      case 'jellyfin':
        stream = new JellyfinProgramStream(ctx, MpegTsOutputFormat);
        break;
      case 'plex':
        stream = new PlexProgramStream(ctx, MpegTsOutputFormat);
        break;
    }

    const out = new PassThrough();
    stream.on('error', () => out.end());
    out.on('close', () => stream.shutdown());
    await stream.start(out);
    return out;
  }
};
