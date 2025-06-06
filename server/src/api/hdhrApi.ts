import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod/v4';

const HdhrLineupSchema = z.object({
  GuideNumber: z.string(),
  GuideName: z.string(),
  URL: z.string().url(),
});

type HdhrLineupItem = z.infer<typeof HdhrLineupSchema>;

export class HdhrApiRouter {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: 'HdhrApi',
  });

  // eslint-disable-next-line @typescript-eslint/require-await
  router: FastifyPluginAsync = async (fastify) => {
    fastify
      .addHook('onError', (req, _, error, done) => {
        this.logger.error({ url: req.routeOptions.config.url, error });
        done();
      })
      .addHook('onRoute', (routeOpts) => {
        if (!routeOpts.config) {
          routeOpts.config = {};
        }
        routeOpts.config.disableRequestLogging = true;
        if (!routeOpts.schema) {
          routeOpts.schema = {};
        }
        routeOpts.schema.hide = true;
      });

    fastify.get('/device.xml', (req, res) => {
      const host = req.protocol + '://' + req.host;
      return res
        .type('application/xml')
        .send(req.serverCtx.hdhrService.getHdhrDeviceXml(host));
    });

    fastify.get(
      '/discover.json',
      {
        schema: {
          tags: ['HDHR'],
        },
      },
      (req, res) => {
        return res.send(
          req.serverCtx.hdhrService.getHdhrDevice(
            req.protocol + '://' + req.host,
          ),
        );
      },
    );

    fastify.get(
      '/lineup_status.json',
      {
        schema: {
          tags: ['HDHR'],
        },
      },
      (_, res) => {
        return res.send({
          ScanInProgress: 0,
          ScanPossible: 1,
          Source: 'Cable',
          SourceList: ['Cable'],
        });
      },
    );

    fastify.get(
      '/lineup.json',
      {
        schema: {
          tags: ['HDHR'],
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
            // Do not use query params here, because Plex doesn't handle them well (as they might append
            // query params themselves...)
            URL: `${req.protocol}://${req.host}/stream/channels/${channel.uuid}.ts`,
          });
        }
        if (lineup.length === 0)
          lineup.push({
            GuideNumber: '1',
            GuideName: 'Tunarr',
            URL: `${req.protocol}://${req.host}/setup`,
          });

        return res.send(lineup);
      },
    );
  };
}
