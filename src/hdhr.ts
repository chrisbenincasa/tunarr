import express from 'express';
import { Server as SSDP } from 'node-ssdp';
import { ChannelDB } from './dao/channel-db';

export function hdhr(db: any, channelDB: ChannelDB) {
  const server = new SSDP({
    location: {
      port: process.env.PORT,
      path: '/device.xml',
    },
    udn: `uuid:2020-03-S3LA-BG3LIA:2`,
    allowWildcards: true,
    ssdpSig: 'PsuedoTV/0.1 UPnP/1.0',
  });

  server.addUSN('upnp:rootdevice');
  server.addUSN('urn:schemas-upnp-org:device:MediaServer:1');

  var router = express.Router();

  router.get('/device.xml', (req, res) => {
    var device = getDevice(db, req.protocol + '://' + req.get('host'));
    res.header('Content-Type', 'application/xml');
    var data = device.getXml();
    res.send(data);
  });

  router.get('/discover.json', (req, res) => {
    var device = getDevice(db, req.protocol + '://' + req.get('host'));
    res.header('Content-Type', 'application/json');
    res.send(JSON.stringify(device));
  });

  router.get('/lineup_status.json', (_, res) => {
    res.header('Content-Type', 'application/json');
    var data = {
      ScanInProgress: 0,
      ScanPossible: 1,
      Source: 'Cable',
      SourceList: ['Cable'],
    };
    res.send(JSON.stringify(data));
  });
  router.get('/lineup.json', async (req, res) => {
    res.header('Content-Type', 'application/json');
    var lineup = [];
    var channels = await channelDB.getAllChannels();
    for (let i = 0, l = channels.length; i < l; i++) {
      if (channels[i].stealth !== true) {
        lineup.push({
          GuideNumber: channels[i].number.toString(),
          GuideName: channels[i].name,
          URL: `${req.protocol}://${req.get('host')}/video?channel=${
            channels[i].number
          }`,
        });
      }
    }
    if (lineup.length === 0)
      lineup.push({
        GuideNumber: '1',
        GuideName: 'dizqueTV',
        URL: `${req.protocol}://${req.get('host')}/setup`,
      });
    res.send(JSON.stringify(lineup));
  });

  return { router: router, ssdp: server };
}

function getDevice(db, host) {
  let hdhrSettings = db['hdhr-settings'].find()[0];
  var device = {
    FriendlyName: 'dizqueTV',
    Manufacturer: 'dizqueTV - Silicondust',
    ManufacturerURL: 'https://github.com/vexorian/dizquetv',
    ModelNumber: 'HDTC-2US',
    FirmwareName: 'hdhomeruntc_atsc',
    TunerCount: hdhrSettings.tunerCount,
    FirmwareVersion: '20170930',
    DeviceID: 'dizqueTV',
    DeviceAuth: '',
    BaseURL: `${host}`,
    LineupURL: `${host}/lineup.json`,
    getXml: () => {
      return `<root xmlns="urn:schemas-upnp-org:device-1-0">
        <URLBase>${device.BaseURL}</URLBase>
        <specVersion>
        <major>1</major>
        <minor>0</minor>
        </specVersion>
        <device>
        <deviceType>urn:schemas-upnp-org:device:MediaServer:1</deviceType>
        <friendlyName>dizqueTV</friendlyName>
        <manufacturer>Silicondust</manufacturer>
        <modelName>HDTC-2US</modelName>
        <modelNumber>HDTC-2US</modelNumber>
        <serialNumber/>
        <UDN>uuid:2020-03-S3LA-BG3LIA:2</UDN>
        </device>
        </root>`;
    },
  };
  return device;
}
