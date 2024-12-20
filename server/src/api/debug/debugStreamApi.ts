import { container } from '@/container.js';
import { getDatabase } from '@/db/DBAccess.js';
import type { ProgramStreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import { createOfflineStreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { Channel } from '@/db/schema/Channel.js';
import { AllChannelTableKeys } from '@/db/schema/Channel.js';
import { MediaSourceType } from '@/db/schema/MediaSource.js';
import type { ProgramDao } from '@/db/schema/Program.js';
import { ProgramType } from '@/db/schema/Program.js';
import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import { AllTranscodeConfigColumns } from '@/db/schema/TranscodeConfig.js';
import { MpegTsOutputFormat } from '@/ffmpeg/builder/constants.js';
import { PlayerContext } from '@/stream/PlayerStreamContext.js';
import type {
  OfflineStreamFactoryType,
  ProgramStreamFactoryType,
} from '@/stream/StreamModule.js';
import { KEYS } from '@/types/inject.js';
import { TruthyQueryParam } from '@/types/schemas.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import dayjs from '@/util/dayjs.js';
import { jsonObjectFrom } from 'kysely/helpers/sqlite';
import { isNumber, isUndefined, nth, random } from 'lodash-es';
import { PassThrough } from 'node:stream';
import { z } from 'zod';

export const debugStreamApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get(
    '/streams/offline',
    {
      schema: {
        tags: ['Debug'],
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

      const stream = container.getNamed<OfflineStreamFactoryType>(
        KEYS.ProgramStreamFactory,
        'offline',
      )(false)(
        new PlayerContext(
          {
            ...createOfflineStreamLineupItem(req.query.duration, +dayjs()),
            streamDuration: req.query.duration,
          },
          channel,
          channel,
          false,
          false,
          true,
          req.query.useNewPipeline ?? false,
          channel.transcodeConfig,
          'mpegts',
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
        tags: ['Debug'],
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

      const stream = container.getNamed<OfflineStreamFactoryType>(
        KEYS.ProgramStreamFactory,
        'offline',
      )(true)(
        PlayerContext.error(
          30_000,
          '',
          channel,
          channel,
          true,
          req.query.useNewPipeline ?? false,
          channel.transcodeConfig,
          'mpegts',
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
      .select(withProgramExternalIds)
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
        tags: ['Debug'],
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
    program: ProgramWithExternalIds,
    channel: Channel,
    transcodeConfig: TranscodeConfig,
    startTime: number = 0,
    useNewPipeline: boolean = false,
  ) {
    const lineupItem = createStreamItemFromProgram(program);
    lineupItem.startOffset = startTime;
    const ctx = new PlayerContext(
      lineupItem,
      channel,
      channel,
      false,
      false,
      true,
      useNewPipeline,
      transcodeConfig,
      'mpegts',
    );

    const stream = container.getNamed<ProgramStreamFactoryType>(
      KEYS.ProgramStreamFactory,
      program.sourceType,
    )(ctx, MpegTsOutputFormat);

    const out = new PassThrough();
    stream.on('error', () => out.end());
    out.on('close', () => stream.shutdown());
    await stream.start(out);
    return out;
  }
};

function createStreamItemFromProgram(
  program: ProgramDao,
): ProgramStreamLineupItem {
  return {
    ...program,
    type: 'program',
    programType: program.type,
    programId: program.uuid,
    id: program.uuid,
    // HACK
    externalSource: z.nativeEnum(MediaSourceType).parse(program.sourceType),
    plexFilePath: program.plexFilePath ?? undefined,
    filePath: program.filePath ?? undefined,
    programBeginMs: +dayjs(),
  };
}
