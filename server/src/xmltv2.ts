import { TvGuideProgram } from '@tunarr/types';
import { getSettings } from './dao/settings';
import { Mutex } from 'async-mutex';
import {
  type XmltvProgramme,
  writeXmltv,
  type XmltvChannel,
} from '@iptv/xmltv';
import { ChannelPrograms, TvGuideChannel } from './services/tvGuideService';

const lock = new Mutex();

export class XmlTvWriter2 {
  async write(channels: ChannelPrograms[]) {
    return await lock.runExclusive(async () => {});
  }

  private async writeInternal(channels: ChannelPrograms[]) {
    const xmlTvSettings = (await getSettings()).xmlTvSettings();
    writeXmltv();
  }

  private async buildXmlTvEntry({ channel, programs }: ChannelPrograms) {
    const xmlChannel = this.makeXmlTvChannel(channel);
  }

  private makeXmlTvChannel(channel: TvGuideChannel): XmltvChannel {
    const partial: XmltvChannel = {
      id: channel.number.toString(),
      displayName: [
        {
          _value: channel.name,
          lang: 'en',
        },
      ],
    };

    if (channel.icon) {
      partial.icon = [
        {
          src: channel.icon.path,
          width: channel.icon.width,
        },
      ];
    }

    return partial;
  }

  private makeXmlTvProgram(program: TvGuideProgram): XmltvProgramme;

  isWriting() {
    return lock.isLocked();
  }
}
