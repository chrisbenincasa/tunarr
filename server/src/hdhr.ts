import { FastifyPluginAsync } from 'fastify';
import { Server as SSDP } from 'node-ssdp';
import { z } from 'zod';
import { ChannelDB } from './dao/channelDb.js';
import { SettingsDB } from './dao/settings.js';
import { serverOptions } from './globals.js';
import { LoggerFactory } from './util/logging/LoggerFactory.js';

const LineupSchema = z.object({
  GuideNumber: z.string(),
  GuideName: z.string(),
  URL: z.string().url(),
});

type LineupItem = z.infer<typeof LineupSchema>;

export class HdhrService {
  private logger = LoggerFactory.child({ caller: import.meta });
  private db: SettingsDB;
  private channelDB: ChannelDB;
  private server: SSDP;

  constructor(db: SettingsDB, channelDB: ChannelDB) {
    this.db = db;
    this.channelDB = channelDB;
    this.server = new SSDP({
      location: {
        port: serverOptions().port,
        path: '/device.xml',
      },
      udn: `uuid:d936e232-6671-4cd7-a8ab-34b5956ff4d6`,
      allowWildcards: true,
      ssdpSig: 'Tunarr/0.1 UPnP/1.0',
      customLogger: process.env['ENABLE_SSDP_DEBUG_LOGGING']
        ? console.debug
        : undefined,
    });

    this.server.addUSN('upnp:rootdevice');
    this.server.addUSN('urn:schemas-upnp-org:device:MediaServer:1');
    this.server.addUSN('urn:schemas-upnp-org:device:SatIPServer:1');
  }

  get ssdp(): SSDP {
    return this.server;
  }

  createRouter(): FastifyPluginAsync {
    // eslint-disable-next-line @typescript-eslint/require-await
    return async (fastify) => {
      fastify.addHook('onError', (req, _, error, done) => {
        this.logger.error({ url: req.routeOptions.config.url, error });
        done();
      });

      fastify.get('/device.xml', (req, res) => {
        req.disableRequestLogging = true;
        const device = getDevice(this.db, req.protocol + '://' + req.hostname);
        const data = device.getXml();
        return res.header('Content-Type', 'application/xml').send(data);
      });

      fastify.get('/discover.json', (req, res) => {
        req.disableRequestLogging = true;
        const device = getDevice(this.db, req.protocol + '://' + req.hostname);
        return res.send(device);
      });

      fastify.get('/lineup_status.json', (req, res) => {
        req.disableRequestLogging = true;
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
          onRequest(req, _, done) {
            req.disableRequestLogging = true;
            done();
          },
          schema: {
            response: {
              200: z.array(LineupSchema),
            },
          },
        },
        async (req, res) => {
          const lineup: LineupItem[] = [];
          const channels = await this.channelDB.getAllChannels();
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
}

function getDevice(db: SettingsDB, host: string) {
  const hdhrSettings = db.hdhrSettings();
  return {
    FriendlyName: 'Tunarr',
    Manufacturer: 'Tunarr - Silicondust',
    ManufacturerURL: 'https://github.com/chrisbenincasa/tunarr',
    ModelNumber: 'HDTC-2US',
    FirmwareName: 'hdhomeruntc_atsc',
    TunerCount: hdhrSettings.tunerCount,
    FirmwareVersion: '20170930',
    DeviceID: 'Tunarr',
    DeviceAuth: '',
    BaseURL: `${host}`,
    LineupURL: `${host}/lineup.json`,
    getXml: () => {
      return `<root xmlns="urn:schemas-upnp-org:device-1-0">
        <URLBase>${host}</URLBase>
        <specVersion>
          <major>1</major>
          <minor>0</minor>
        </specVersion>
        <device>
          <deviceType>urn:schemas-upnp-org:device:MediaServer:1</deviceType>
          <friendlyName>Tunarr</friendlyName>
          <manufacturer>Silicondust</manufacturer>
          <modelName>HDTC-2US</modelName>
          <modelNumber>HDTC-2US</modelNumber>
          <serialNumber/>
          <UDN>uuid:d936e232-6671-4cd7-a8ab-34b5956ff4d6</UDN>
        </device>
        </root>`;
    },
  };
}
