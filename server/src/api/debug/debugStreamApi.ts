import { container } from '@/container.js';
import type { StreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import { createOfflineStreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { Channel } from '@/db/schema/Channel.js';
import { AllChannelTableKeys } from '@/db/schema/Channel.js';
import { ProgramType } from '@/db/schema/Program.js';
import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import { AllTranscodeConfigColumns } from '@/db/schema/TranscodeConfig.js';
import { MpegTsOutputFormat } from '@/ffmpeg/builder/constants.js';
import { PlayerContext } from '@/stream/PlayerStreamContext.js';
import type { OfflineStreamFactoryType } from '@/stream/StreamModule.js';
import { KEYS } from '@/types/inject.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import dayjs from '@/util/dayjs.js';
import { jsonObjectFrom } from 'kysely/helpers/sqlite';
import { isNumber, isUndefined, nth, random } from 'lodash-es';
import { PassThrough } from 'node:stream';
import type { MarkRequired } from 'ts-essentials';
import { z } from 'zod/v4';
import type { ProgramWithRelationsOrm } from '../../db/schema/derivedTypes.ts';
import type { ProgramStreamFactory } from '../../stream/ProgramStreamFactory.ts';
import { isNonEmptyString } from '../../util/index.ts';

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
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx
        .databaseFactory()
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
          true,
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
          channelId: z.uuid().or(z.coerce.number()).optional(),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx
        .databaseFactory()
        .selectFrom('channel')
        .selectAll()
        .$if(isNonEmptyString(req.query.channelId), (eb) =>
          eb.where('channel.uuid', '=', req.query.channelId as string),
        )
        .$if(isNumber(req.query.channelId), (eb) =>
          eb.where('channel.number', '=', req.query.channelId as number),
        )
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

  fastify.get('/streams/random', async (req, res) => {
    const program = await req.serverCtx
      .drizzleFactory()
      .query.program.findFirst({
        where: (fields, ops) => ops.eq(fields.type, ProgramType.Episode),
        orderBy: (_, { sql }) => sql`random()`,
        with: {
          externalIds: true,
        },
      });
    if (!program) {
      return res.status(404).send();
    }

    const channels = await req.serverCtx
      .databaseFactory()
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

    const firstChannel = channels?.[0]!.channel;

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

      const channels = await req.serverCtx
        .databaseFactory()
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
        firstChannel = await req.serverCtx
          .databaseFactory()
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
      );
      return res.header('Content-Type', 'video/mp2t').send(outStream);
    },
  );

  async function initStream(
    program: MarkRequired<ProgramWithRelationsOrm, 'externalIds'>,
    channel: Channel,
    transcodeConfig: TranscodeConfig,
    startTime: number = 0,
  ) {
    if (!program.mediaSourceId) {
      throw new Error('');
    }
    const mediaSourceId = program.mediaSourceId;
    const lineupItem: StreamLineupItem = {
      type: 'program',
      program: { ...program, mediaSourceId },
      duration: program.duration,
      infiniteLoop: false,
      programBeginMs: +dayjs(),
      streamDuration: program.duration,
    };
    lineupItem.startOffset = startTime;
    const ctx = new PlayerContext(
      lineupItem,
      channel,
      channel,
      false,
      true,
      transcodeConfig,
      'mpegts',
    );

    const stream = container.getNamed<ProgramStreamFactory>(
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
