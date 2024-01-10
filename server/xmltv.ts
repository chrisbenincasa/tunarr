/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { EntityDTO, Loaded } from '@mikro-orm/core';
import { Channel, TvGuideProgram, isContentGuideProgram } from 'dizquetv-types';
import fs from 'fs';
import { isUndefined, keys, map } from 'lodash-es';
import XMLWriter from 'xml-writer';
import { XmlTvSettings } from './dao/settings.js';
import { CacheImageService } from './services/cacheImageService.js';
import { ChannelPrograms } from './services/tvGuideService.js';

let isShutdown = false;
let isWorking = false;

export class XmlTvWriter {
  async WriteXMLTV(
    json: Record<number, ChannelPrograms>,
    xmlSettings: XmlTvSettings,
    throttle: () => Promise<void>,
    cacheImageService: CacheImageService,
  ) {
    if (isShutdown) {
      return;
    }
    if (isWorking) {
      console.log('Concurrent xmltv write attempt detected, skipping');
      return;
    }
    isWorking = true;
    try {
      await this.writePromise(json, xmlSettings, throttle, cacheImageService);
    } catch (err) {
      console.error('Error writing xmltv', err);
    }
    isWorking = false;
  }

  private writePromise(
    json: Record<string | number, ChannelPrograms>,
    xmlSettings: XmlTvSettings,
    throttle: () => Promise<void>,
    cacheImageService: CacheImageService,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return new Promise(async (resolve, reject) => {
      const ws = fs.createWriteStream(xmlSettings.outputPath);
      const xw = new XMLWriter(true, (str, enc) => ws.write(str, enc));
      ws.on('close', () => {
        resolve(void 0);
      });
      ws.on('error', (err) => {
        reject(err);
      });
      this._writeDocStart(xw);
      const middle = async () => {
        const channelNumbers: string[] = keys(json);
        this._writeChannels(
          xw,
          map(json, (obj) => obj.channel),
        );
        for (let i = 0; i < channelNumbers.length; i++) {
          const number = channelNumbers[i];
          await this._writePrograms(
            xw,
            json[number].channel,
            json[number].programs,
            throttle,
            xmlSettings,
            cacheImageService,
          );
        }
      };
      await middle()
        .then(() => {
          this._writeDocEnd(xw);
        })
        .catch((err) => {
          console.error('Error', err);
        })
        .then(() => ws.end());
    });
  }

  private _writeDocStart(xw) {
    xw.startDocument();
    xw.startElement('tv');
    xw.writeAttribute('generator-info-name', 'psuedotv-plex');
  }

  private _writeDocEnd(xw) {
    xw.endElement();
    xw.endDocument();
  }

  private _writeChannels(
    xw,
    channels: Partial<EntityDTO<Loaded<Channel, 'programs'>>>[],
  ) {
    for (let i = 0; i < channels.length; i++) {
      xw.startElement('channel');
      xw.writeAttribute('id', channels[i].number);
      xw.startElement('display-name');
      xw.writeAttribute('lang', 'en');
      xw.text(channels[i].name);
      xw.endElement();
      if (channels[i].icon) {
        xw.startElement('icon');
        xw.writeAttribute('src', channels[i].icon?.path);
        xw.endElement();
      }
      xw.endElement();
    }
  }

  async _writePrograms(
    xw: unknown,
    channel: Partial<Channel>,
    programs: TvGuideProgram[],
    throttle: () => Promise<void>,
    xmlSettings: XmlTvSettings,
    cacheImageService: CacheImageService,
  ) {
    for (let i = 0; i < programs.length; i++) {
      if (!isShutdown) {
        await throttle();
      }
      await this._writeProgramme(
        channel,
        programs[i],
        xw,
        xmlSettings,
        cacheImageService,
      );
    }
  }

  async _writeProgramme(
    channel: Partial<Channel>,
    program: TvGuideProgram,
    xw,
    xmlSettings,
    cacheImageService: CacheImageService,
  ) {
    let title: string;
    switch (program.type) {
      case 'custom':
        title = program.program?.title ?? 'Custom Program';
        break;
      case 'content':
        title = program.title;
        break;
      case 'redirect':
        title = `Redirect to Channel ${program.channel}`;
        break;
      case 'flex':
        title = 'Flex';
        break;
    }
    // Programme
    xw.startElement('programme');
    xw.writeAttribute('start', this._createXMLTVDate(program.start));
    xw.writeAttribute('stop', this._createXMLTVDate(program.stop));
    xw.writeAttribute('channel', channel.number);
    // Title
    xw.startElement('title');
    xw.writeAttribute('lang', 'en');
    xw.text(title);
    xw.endElement();
    xw.writeRaw('\n        <previously-shown/>');

    //sub-title
    if (isContentGuideProgram(program) && !isUndefined(program.seasonNumber)) {
      xw.startElement('sub-title');
      xw.writeAttribute('lang', 'en');
      xw.text(program.episodeTitle);
      xw.endElement();

      xw.startElement('episode-num');
      xw.writeAttribute('system', 'onscreen');
      xw.text('S' + program.seasonNumber + ' E' + program.episodeNumber);
      xw.endElement();

      xw.startElement('episode-num');
      xw.writeAttribute('system', 'xmltv_ns');
      xw.text(
        (program.seasonNumber ?? 1) -
          1 +
          '.' +
          ((program.episodeNumber ?? 1) - 1) +
          '.0/1',
      );
      xw.endElement();
    }
    // Icon
    if (isContentGuideProgram(program) && typeof program.icon !== 'undefined') {
      xw.startElement('icon');
      let icon = program.icon;
      if (xmlSettings.enableImageCache === true) {
        const imgUrl = await cacheImageService.registerImageOnDatabase(icon);
        icon = `{{host}}/cache/images/${imgUrl}`;
      }
      xw.writeAttribute('src', icon);
      xw.endElement();
    }
    // Desc
    xw.startElement('desc');
    xw.writeAttribute('lang', 'en');
    if (
      isContentGuideProgram(program) &&
      typeof program.summary !== 'undefined' &&
      program.summary.length > 0
    ) {
      xw.text(program.summary);
    } else {
      xw.text(channel.name);
    }
    xw.endElement();
    // Rating
    if (
      isContentGuideProgram(program) &&
      program.rating != null &&
      typeof program.rating !== 'undefined'
    ) {
      xw.startElement('rating');
      xw.writeAttribute('system', 'MPAA');
      xw.writeElement('value', program.rating);
      xw.endElement();
    }
    // End of Programme
    xw.endElement();
  }

  private _createXMLTVDate(d: number) {
    return (
      new Date(d).toISOString().substring(0, 19).replace(/[-T:]/g, '') +
      ' +0000'
    );
  }

  async shutdown() {
    isShutdown = true;
    console.log('Shutting down xmltv writer.');
    if (isWorking) {
      let s = 'Wait for xmltv writer...';
      while (isWorking) {
        console.log(s);
        await wait(100);
        s = 'Still waiting for xmltv writer...';
      }
      console.log('Write finished.');
    } else {
      console.log('xmltv writer had no pending jobs.');
    }
  }
}

function wait(x: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, x);
  });
}
