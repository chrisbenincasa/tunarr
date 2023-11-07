import { FastifyPluginCallback } from 'fastify';
import * as helperFuncs from '../helperFuncs.js';
import { PlexPlayer } from '../plexPlayer.js';
import { ContextChannel, LineupItem, Maybe, PlayerContext } from '../types.js';

export const debugRouter: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.get<{ Querystring: { channel: number } }>(
    '/api/v1/debug/plex',
    async (req, res) => {
      const t0 = new Date().getTime();
      const channel = req.serverCtx.channelCache.getChannelConfig(
        req.query.channel,
      );

      if (!channel) {
        return res.status(404).send('No channel found');
      }

      const lineupItem: Maybe<LineupItem> =
        req.serverCtx.channelCache.getCurrentLineupItem(channel.number, t0);

      console.log(lineupItem);

      const combinedChannel: ContextChannel = {
        ...helperFuncs.generateChannelContext(channel),
        transcoding: channel?.transcoding,
      };

      console.log(combinedChannel);

      const playerContext: PlayerContext = {
        lineupItem: lineupItem!,
        ffmpegSettings: req.serverCtx.dbAccess.ffmpegSettings(),
        channel: combinedChannel,
        m3u8: false,
        audioOnly: false,
        dbAccess: req.serverCtx.dbAccess,
      };

      const plex = new PlexPlayer(playerContext);

      void res.header('Content-Type', 'video/mp2t');
      await plex.play(res.raw);
    },
  );
  done();
};
