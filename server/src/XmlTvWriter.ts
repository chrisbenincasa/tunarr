import { TvGuideProgram, isContentProgram } from '@tunarr/types';
import { getSettings } from './dao/settings';
import { Mutex } from 'async-mutex';
import {
  type XmltvProgramme,
  writeXmltv,
  type XmltvChannel,
} from '@iptv/xmltv';
import { ChannelPrograms } from './services/tvGuideService';
import { forProgramType } from '@tunarr/shared/util';
import { flatMap, isNil, map, round, escape } from 'lodash-es';
import { isNonEmptyString } from './util';
import { writeFile } from 'fs/promises';
import { Channel } from './dao/entities/Channel.js';
import { LoggerFactory } from './util/logging/LoggerFactory';

const lock = new Mutex();

export class XmlTvWriter {
  private logger = LoggerFactory.child({ caller: import.meta });

  async write(channels: ChannelPrograms[]) {
    const start = performance.now();
    return await lock.runExclusive(async () => {
      return await this.writeInternal(channels).finally(() => {
        const end = performance.now();
        this.logger.debug(
          `Generated and wrote xmltv file in ${round(end - start, 3)}ms`,
        );
      });
    });
  }

  private async writeInternal(channels: ChannelPrograms[]) {
    const xmlTvSettings = getSettings().xmlTvSettings();
    const content = writeXmltv({
      generatorInfoName: 'tunarr',
      date: new Date(),
      channels: map(channels, ({ channel }) => this.makeXmlTvChannel(channel)),
      programmes: flatMap(channels, ({ channel, programs }) =>
        map(programs, (p) => this.makeXmlTvProgram(p, channel)),
      ),
    });

    return await writeFile(xmlTvSettings.outputPath, content);
  }

  private makeXmlTvChannel(channel: Channel): XmltvChannel {
    const partial: XmltvChannel = {
      id: `${channel.number}.tunarr`,
      displayName: [
        {
          _value: escape(channel.name),
          lang: 'en',
        },
      ],
    };

    if (channel.icon) {
      partial.icon = [
        {
          src: isNonEmptyString(channel.icon.path)
            ? escape(channel.icon.path)
            : '{{host}}/images/tunarr.png',
          width: channel.icon.width,
        },
      ];
    }

    return partial;
  }

  private makeXmlTvProgram(
    program: TvGuideProgram,
    channel: Channel,
  ): XmltvProgramme {
    const partial: XmltvProgramme = {
      start: new Date(program.start),
      stop: new Date(program.stop),
      title: [{ _value: escape(XmlTvWriter.titleExtractor(program)) }],
      previouslyShown: {},
      channel: `${channel.number}.tunarr`,
    };

    if (isContentProgram(program)) {
      // TODO: Use grouping mappings here.
      if (isNonEmptyString(program.episodeTitle)) {
        partial.subTitle ??= [
          {
            _value: escape(program.episodeTitle),
          },
        ];
      }

      if (isNonEmptyString(program.summary)) {
        partial.desc ??= [
          {
            _value: escape(program.summary),
          },
        ];
      }

      if (!isNil(program.rating)) {
        partial.rating ??= [
          {
            system: 'MPAA',
            value: program.rating,
          },
        ];
      }

      if (!isNil(program.seasonNumber) && !isNil(program.episodeNumber)) {
        partial.episodeNum = [
          {
            system: 'onscreen',
            _value: `S${program.seasonNumber}E${program.episodeNumber}`,
          },
          {
            system: 'xmltv_ns',
            _value: `${program.seasonNumber - 1}.${
              program.episodeNumber - 1
            }.0/1`,
          },
        ];
      }

      if (isNonEmptyString(program.id)) {
        // Disable this for now...
        // if (xmlSettings.enableImageCache === true) {
        //   const imgUrl = await cacheImageService.registerImageOnDatabase(icon);
        //   icon = `{{host}}/cache/images/${imgUrl}`;
        // }
        partial.icon = [
          {
            src: `{{host}}/api/programs/${program.id}/thumb?proxy=true`,
          },
        ];
      }
    }

    return partial;
  }

  private static titleExtractor = forProgramType({
    custom: (program) => program.program?.title ?? 'Custom Program',
    content: (program) => program.title,
    redirect: (program) => `Redirect to Channel ${program.channel}`,
    flex: 'Flex',
  });

  isWriting() {
    return lock.isLocked();
  }
}
