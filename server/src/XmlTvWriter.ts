import { TvGuideProgram, isContentProgram } from '@tunarr/types';
import { getSettings } from './dao/settings';
import { Mutex } from 'async-mutex';
import {
  type XmltvProgramme,
  writeXmltv,
  type XmltvChannel,
} from '@iptv/xmltv';
import { ChannelPrograms, TvGuideChannel } from './services/tvGuideService';
import { forProgramType } from '@tunarr/shared/util';
import { flatMap, isNil, map, round } from 'lodash-es';
import { isNonEmptyString } from './util';
import { writeFile } from 'fs/promises';
import createLogger from './logger';

const lock = new Mutex();
const logger = createLogger(import.meta);

export class XmlTvWriter {
  async write(channels: ChannelPrograms[]) {
    const start = performance.now();
    return await lock.runExclusive(async () => {
      return await this.writeInternal(channels).finally(() => {
        const end = performance.now();
        logger.debug(
          `Generated and wrote xmltv file in ${round(end - start, 3)}ms`,
        );
      });
    });
  }

  private async writeInternal(channels: ChannelPrograms[]) {
    const xmlTvSettings = (await getSettings()).xmlTvSettings();
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

  private makeXmlTvProgram(
    program: TvGuideProgram,
    channel: TvGuideChannel,
  ): XmltvProgramme {
    const partial: XmltvProgramme = {
      start: new Date(program.start),
      stop: new Date(program.stop),
      title: [{ _value: XmlTvWriter.titleExtractor(program) }],
      previouslyShown: {},
      channel: channel.number.toString(),
    };

    if (isContentProgram(program)) {
      // TODO: Use grouping mappings here.
      if (isNonEmptyString(program.episodeTitle)) {
        partial.subTitle ??= [
          {
            _value: program.episodeTitle,
          },
        ];
      }

      if (isNonEmptyString(program.summary)) {
        partial.desc ??= [
          {
            _value: program.summary,
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
