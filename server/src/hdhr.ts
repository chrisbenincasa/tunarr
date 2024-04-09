import { FastifyPluginAsync } from 'fastify';
import { Server as SSDP } from 'node-ssdp';
import { ChannelDB } from './dao/channelDb.js';
import { Settings } from './dao/settings.js';
import { serverOptions } from './globals.js';

export class HdhrService {
  private db: Settings;
  private channelDB: ChannelDB;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private server: any;

  constructor(db: Settings, channelDB: ChannelDB) {
    this.db = db;
    this.channelDB = channelDB;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    this.server = new SSDP({
      location: {
        port: serverOptions().port,
        path: '/device.xml',
      },
      udn: `uuid:2020-03-S3LA-BG3LIA:2`,
      allowWildcards: true,
      ssdpSig: 'PsuedoTV/0.1 UPnP/1.0',
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    this.server.addUSN('upnp:rootdevice');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    this.server.addUSN('urn:schemas-upnp-org:device:MediaServer:1');
  }

  get ssdp(): unknown {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.server;
  }

  createRouter(): FastifyPluginAsync {
    // eslint-disable-next-line @typescript-eslint/require-await
    return async (fastify) => {
      fastify.get('/device.xml', (req, res) => {
        const device = getDevice(this.db, req.protocol + '://' + req.hostname);
        const data = device.getXml();
        return res.header('Content-Type', 'application/xml').send(data);
      });

      fastify.get('/discover.json', (req, res) => {
        const device = getDevice(this.db, req.protocol + '://' + req.hostname);
        return res.send(device);
      });

      fastify.get('/lineup_status.json', (_, res) => {
        return res.send({
          ScanInProgress: 0,
          ScanPossible: 1,
          Source: 'Cable',
          SourceList: ['Cable'],
        });
      });

      fastify.get('/lineup.json', async (req, res) => {
        const lineup: {
          GuideNumber: string;
          GuideName: string;
          URL: string;
        }[] = [];
        const channels = await this.channelDB.getAllChannels();
        for (let i = 0, l = channels.length; i < l; i++) {
          if (!channels[i].stealth) {
            lineup.push({
              GuideNumber: channels[i].number.toString(),
              GuideName: channels[i].name,
              URL: `${req.protocol}://${req.hostname}/video?channel=${channels[i].number}`,
            });
          }
        }
        if (lineup.length === 0)
          lineup.push({
            GuideNumber: '1',
            GuideName: 'Tunarr',
            URL: `${req.protocol}://${req.hostname}/setup`,
          });

        return res.send(lineup);
      });
    };
  }
}

function getDevice(db: Settings, host: string) {
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
        <UDN>uuid:2020-03-S3LA-BG3LIA:2</UDN>
        </device>
        </root>`;
    },
  };
}
