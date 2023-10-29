import XMLWriter from 'xml-writer';
import fs from 'fs';
import { Channel } from './dao/db.js';

let isShutdown = false;
let isWorking = false;

export async function WriteXMLTV(
  json,
  xmlSettings,
  throttle,
  cacheImageService,
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
    await writePromise(json, xmlSettings, throttle, cacheImageService);
  } catch (err) {
    console.error('Error writing xmltv', err);
  }
  isWorking = false;
}

function writePromise(json, xmlSettings, throttle, cacheImageService) {
  return new Promise((resolve, reject) => {
    let ws = fs.createWriteStream(xmlSettings.file);
    let xw = new XMLWriter(true, (str, enc) => ws.write(str, enc));
    ws.on('close', () => {
      resolve(void 0);
    });
    ws.on('error', (err) => {
      reject(err);
    });
    _writeDocStart(xw);
    async function middle() {
      let channelNumbers: any[] = [];
      Object.keys(json).forEach((key) => channelNumbers.push(key));
      let channels = channelNumbers.map((number) => json[number].channel);
      _writeChannels(xw, channels);
      for (let i = 0; i < channelNumbers.length; i++) {
        let number = channelNumbers[i];
        await _writePrograms(
          xw,
          json[number].channel,
          json[number].programs,
          throttle,
          xmlSettings,
          cacheImageService,
        );
      }
    }
    middle()
      .then(() => {
        _writeDocEnd(xw, ws);
      })
      .catch((err) => {
        console.error('Error', err);
      })
      .then(() => ws.end());
  });
}

function _writeDocStart(xw) {
  xw.startDocument();
  xw.startElement('tv');
  xw.writeAttribute('generator-info-name', 'psuedotv-plex');
}
function _writeDocEnd(xw, _) {
  xw.endElement();
  xw.endDocument();
}

function _writeChannels(xw, channels: Channel[]) {
  for (let i = 0; i < channels.length; i++) {
    xw.startElement('channel');
    xw.writeAttribute('id', channels[i].number);
    xw.startElement('display-name');
    xw.writeAttribute('lang', 'en');
    xw.text(channels[i].name);
    xw.endElement();
    if (channels[i].icon) {
      xw.startElement('icon');
      xw.writeAttribute('src', channels[i].icon.path);
      xw.endElement();
    }
    xw.endElement();
  }
}

async function _writePrograms(
  xw,
  channel,
  programs,
  throttle,
  xmlSettings,
  cacheImageService,
) {
  for (let i = 0; i < programs.length; i++) {
    if (!isShutdown) {
      await throttle();
    }
    await _writeProgramme(
      channel,
      programs[i],
      xw,
      xmlSettings,
      cacheImageService,
    );
  }
}

async function _writeProgramme(
  channel,
  program,
  xw,
  xmlSettings,
  cacheImageService,
) {
  // Programme
  xw.startElement('programme');
  xw.writeAttribute('start', _createXMLTVDate(program.start));
  xw.writeAttribute('stop', _createXMLTVDate(program.stop));
  xw.writeAttribute('channel', channel.number);
  // Title
  xw.startElement('title');
  xw.writeAttribute('lang', 'en');
  xw.text(program.title);
  xw.endElement();
  xw.writeRaw('\n        <previously-shown/>');

  //sub-title
  if (typeof program.sub !== 'undefined') {
    xw.startElement('sub-title');
    xw.writeAttribute('lang', 'en');
    xw.text(program.sub.title);
    xw.endElement();

    xw.startElement('episode-num');
    xw.writeAttribute('system', 'onscreen');
    xw.text('S' + program.sub.season + ' E' + program.sub.episode);
    xw.endElement();

    xw.startElement('episode-num');
    xw.writeAttribute('system', 'xmltv_ns');
    xw.text(program.sub.season - 1 + '.' + (program.sub.episode - 1) + '.0/1');
    xw.endElement();
  }
  // Icon
  if (typeof program.icon !== 'undefined') {
    xw.startElement('icon');
    let icon = program.icon;
    if (xmlSettings.enableImageCache === true) {
      const imgUrl = cacheImageService.registerImageOnDatabase(icon);
      icon = `{{host}}/cache/images/${imgUrl}`;
    }
    xw.writeAttribute('src', icon);
    xw.endElement();
  }
  // Desc
  xw.startElement('desc');
  xw.writeAttribute('lang', 'en');
  if (typeof program.summary !== 'undefined' && program.summary.length > 0) {
    xw.text(program.summary);
  } else {
    xw.text(channel.name);
  }
  xw.endElement();
  // Rating
  if (program.rating != null && typeof program.rating !== 'undefined') {
    xw.startElement('rating');
    xw.writeAttribute('system', 'MPAA');
    xw.writeElement('value', program.rating);
    xw.endElement();
  }
  // End of Programme
  xw.endElement();
}
function _createXMLTVDate(d) {
  return d.substring(0, 19).replace(/[-T:]/g, '') + ' +0000';
}
function wait(x) {
  return new Promise((resolve) => {
    setTimeout(resolve, x);
  });
}

export async function shutdown() {
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
