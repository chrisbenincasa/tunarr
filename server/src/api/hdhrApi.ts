import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { LoggerFactory } from '../util/logging/LoggerFactory';

const HdhrLineupSchema = z.object({
  GuideNumber: z.string(),
  GuideName: z.string(),
  URL: z.string().url(),
});

type HdhrLineupItem = z.infer<typeof HdhrLineupSchema>;

export class HdhrApiRouter {
  private logger = LoggerFactory.child({ caller: import.meta });

  // eslint-disable-next-line @typescript-eslint/require-await
  router: FastifyPluginAsync = async (fastify) => {
    fastify
      .addHook('onError', (req, _, error, done) => {
        this.logger.error({ url: req.routeOptions.config.url, error });
        done();
      })
      .addHook('onRequest', (req, _, done) => {
        req.disableRequestLogging = true;
        done();
      });

    fastify.get('/device.xml', (req, res) => {
      const host = req.protocol + '://' + req.hostname;
      return res
        .type('application/xml')
        .send(req.serverCtx.hdhrService.getHdhrDeviceXml(host));
    });

    fastify.get('/discover.json', (req, res) => {
      return res.send(
        req.serverCtx.hdhrService.getHdhrDevice(
          req.protocol + '://' + req.hostname,
        ),
      );
    });

    fastify.get('/lineup_status.json', (_, res) => {
      return res.send({
        ScanInProgress: 0,
        ScanPossible: 1,
        Source: 'Cable',
        SourceList: ['Cable'],
      });
    });

    fastify.get(
      '/lineup.json',
      {
        schema: {
          response: {
            200: z.array(HdhrLineupSchema),
          },
        },
      },
      async (req, res) => {
        const lineup: HdhrLineupItem[] = [];
        const channels = await req.serverCtx.channelDB.getAllChannels();
        for (const channel of channels) {
          if (channel.stealth) {
            continue;
          }

          lineup.push({
            GuideNumber: channel.number.toString(),
            GuideName: channel.name,
            URL: `${req.protocol}://${req.hostname}/channels/${channel.number}/video`,
          });
        }
        if (lineup.length === 0)
          lineup.push({
            GuideNumber: '1',
            GuideName: 'Tunarr',
            URL: `${req.protocol}://${req.hostname}/setup`,
          });

        return res.send(lineup);
      },
    );
  };
}
