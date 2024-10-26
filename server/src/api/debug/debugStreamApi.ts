import { jsonObjectFrom } from 'kysely/helpers/sqlite';
import { PassThrough } from 'stream';
import { z } from 'zod';
import { createOfflineStreamLineupItem } from '../../dao/derived_types/StreamLineup.ts';
import { directDbAccess } from '../../dao/direct/directDbAccess.ts';
import { AllChannelTableKeys } from '../../dao/direct/schema/Channel.ts';
import { ProgramType } from '../../dao/entities/Program.ts';
import { MpegTsOutputFormat } from '../../ffmpeg/OutputFormat.ts';
import { OfflineProgramStream } from '../../stream/OfflinePlayer.ts';
import { PlayerContext } from '../../stream/PlayerStreamContext.ts';
import { ProgramStream } from '../../stream/ProgramStream.ts';
import { JellyfinProgramStream } from '../../stream/jellyfin/JellyfinProgramStream.ts';
import { PlexProgramStream } from '../../stream/plex/PlexProgramStream.ts';
import { RouterPluginAsyncCallback } from '../../types/serverType.ts';

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
        }),
      },
    },
    async (req, res) => {
      const channel = await directDbAccess()
        .selectFrom('channel')
        .selectAll()
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
        ),
        MpegTsOutputFormat,
      );

      const out = new PassThrough();
      stream.on('error', () => out.end());
      await stream.start(out);
      return res.header('Content-Type', 'video/mp2t').send(out);
    },
  );

  fastify.get('/streams/error', async (_, res) => {
    const channel = await directDbAccess()
      .selectFrom('channel')
      .selectAll()
      .executeTakeFirstOrThrow();
    const stream = new OfflineProgramStream(
      true,
      new PlayerContext(
        {
          ...createOfflineStreamLineupItem(30_000),
          streamDuration: 30_000,
          title: 'Error',
        },
        channel,
        false,
        false,
        true,
      ),
      MpegTsOutputFormat,
    );

    const out = new PassThrough();
    stream.on('error', () => out.end());
    await stream.start(out);
    return res.header('Content-Type', 'video/mp2t').send(out);
  });

  fastify.get('/streams/random', async (req, res) => {
    const program = await directDbAccess()
      .selectFrom('program')
      .orderBy((ob) => ob.fn('random'))
      .where('type', '=', ProgramType.Episode)
      .limit(1)
      .selectAll()
      .executeTakeFirstOrThrow();

    const channels = await directDbAccess()
      .selectFrom('channelPrograms')
      .where('programUuid', '=', program.uuid)
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('channel')
            .whereRef('channel.uuid', '=', 'channelPrograms.channelUuid')
            .select(AllChannelTableKeys),
        ).as('channel'),
      )
      .execute();

    const firstChannel = channels?.[0].channel;

    if (!firstChannel) {
      return res.status(404);
    }

    const lineupItem = req.serverCtx
      .streamProgramCalculator()
      .createStreamItemFromProgram(program);
    const ctx = new PlayerContext(lineupItem, firstChannel, false, false, true);

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
    return res.header('Content-Type', 'video/mp2t').send(out);
  });
};
