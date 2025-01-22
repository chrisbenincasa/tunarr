import { SettingsDB } from '@/db/SettingsDB.js';
import { serverOptions } from '@/globals.js';
import { KEYS } from '@/types/inject.js';
import { inject, injectable } from 'inversify';
import { Server as SSDP } from 'node-ssdp';

@injectable()
export class HdhrService {
  private db: SettingsDB;
  private server: SSDP;

  constructor(@inject(KEYS.SettingsDB) db: SettingsDB) {
    this.db = db;
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

  getHdhrDevice(host: string) {
    return {
      FriendlyName: 'Tunarr',
      Manufacturer: 'Tunarr - Silicondust',
      ManufacturerURL: 'https://github.com/chrisbenincasa/tunarr',
      ModelNumber: 'HDTC-2US',
      FirmwareName: 'hdhomeruntc_atsc',
      TunerCount: this.db.hdhrSettings().tunerCount,
      FirmwareVersion: '20170930',
      DeviceID: 'Tunarr',
      DeviceAuth: '',
      BaseURL: `${host}`,
      LineupURL: `${host}/lineup.json`,
    };
  }

  getHdhrDeviceXml(host: string) {
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
  }
}
