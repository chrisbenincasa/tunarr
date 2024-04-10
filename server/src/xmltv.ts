/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { EntityDTO, Loaded } from '@mikro-orm/core';
import {
  Channel,
  TvGuideProgram,
  XmlTvSettings,
  isContentGuideProgram,
} from '@tunarr/types';
import fs from 'fs';
import { isNil, isUndefined, keys, map } from 'lodash-es';
import XMLWriter from 'xml-writer';
import { ChannelPrograms } from './services/tvGuideServiceLegacy.js';
import { wait } from './util.js';
import createLogger from './logger.js';

const logger = createLogger(import.meta);

let isWorking = false;

export class XmlTvWriter {
  async writeXMLTv(
    json: Record<number, ChannelPrograms>,
    xmlSettings: XmlTvSettings,
  ) {
    if (isWorking) {
      logger.debug('Concurrent xmltv write attempt detected, skipping');
      return;
    }
    isWorking = true;
    try {
      await this.writePromise(json, xmlSettings);
    } catch (err) {
      logger.error('Error writing xmltv: %O', err);
    }
    isWorking = false;
  }

  private writePromise(
    json: Record<string | number, ChannelPrograms>,
    xmlSettings: XmlTvSettings,
    // cacheImageService: CacheImageService,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const ws = fs.createWriteStream(xmlSettings.outputPath);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
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
          await this.writePrograms(
            xw,
            json[number].channel,
            json[number].programs,
          );
        }
      };
      await middle()
        .then(() => {
          this._writeDocEnd(xw);
        })
        .catch((err) => {
          logger.error('Error writing XMLTV: %O', err);
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

  private async writePrograms(
    xw: unknown,
    channel: Partial<Channel>,
    programs: TvGuideProgram[],
  ) {
    for (let i = 0; i < programs.length; i++) {
      await wait();
      this.writeProgramme(channel, programs[i], xw);
    }
  }

  private writeProgramme(
    channel: Partial<Channel>,
    program: TvGuideProgram,
    xw,
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
    // The persisted and id portions of this should always be true
    // but we take the extra precaution
    if (
      isContentGuideProgram(program) &&
      program.persisted &&
      !isNil(program.id)
    ) {
      xw.startElement('icon');
      // Disable this for now...
      // if (xmlSettings.enableImageCache === true) {
      //   const imgUrl = await cacheImageService.registerImageOnDatabase(icon);
      //   icon = `{{host}}/cache/images/${imgUrl}`;
      // }
      xw.writeAttribute(
        'src',
        `{{host}}/api/programs/${program.id}/thumb?proxy=true`,
      );
      xw.endElement();
    }

    // Desc
    xw.startElement('desc');
    xw.writeAttribute('lang', 'en');
    if (
      isContentGuideProgram(program) &&
      !isNil(program.summary) &&
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
}
