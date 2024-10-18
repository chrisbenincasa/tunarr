import { PassThrough } from 'stream';
import { createOfflineStreamLineupItem } from '../../dao/derived_types/StreamLineup';
import { directDbAccess } from '../../dao/direct/directDbAccess';
import { MpegTsOutputFormat } from '../../ffmpeg/OutputFormat';
import { OfflineProgramStream } from '../../stream/OfflinePlayer';
import { PlayerContext } from '../../stream/PlayerStreamContext';
import { RouterPluginAsyncCallback } from '../../types/serverType';

export const debugStreamApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get('/streams/offline', async (req, res) => {
    const channel = await directDbAccess()
      .selectFrom('channel')
      .selectAll()
      .executeTakeFirstOrThrow();
    const stream = new OfflineProgramStream(
      false,
      new PlayerContext(
        createOfflineStreamLineupItem(30_000),
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
};
