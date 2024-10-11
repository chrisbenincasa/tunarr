import {
  writeXmltv,
  type XmltvChannel,
  type XmltvProgramme,
} from '@iptv/xmltv';
import { forProgramType } from '@tunarr/shared/util';
import { TvGuideProgram, isContentProgram } from '@tunarr/types';
import { Mutex } from 'async-mutex';
import { writeFile } from 'fs/promises';
import { escape, flatMap, isNil, map, round } from 'lodash-es';
import { Channel } from './dao/direct/schema/Channel';
import { SettingsDB, getSettings } from './dao/settings';
import { ChannelPrograms } from './services/tvGuideService';
import { isNonEmptyString } from './util';
import { LoggerFactory } from './util/logging/LoggerFactory';

const lock = new Mutex();

const channelIdCache: Record<string, string> = {};

export class XmlTvWriter {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  constructor(private settingsDB: SettingsDB = getSettings()) {}

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
    const content = writeXmltv({
      generatorInfoName: 'tunarr',
      date: new Date(),
      channels: map(channels, ({ channel }) => this.makeXmlTvChannel(channel)),
      programmes: flatMap(channels, ({ channel, programs }) =>
        map(programs, (p) => this.makeXmlTvProgram(p, channel)),
      ),
    });

    return await writeFile(this.settingsDB.xmlTvSettings().outputPath, content);
  }

  private makeXmlTvChannel(channel: Channel): XmltvChannel {
    const partial: XmltvChannel = {
      id: this.getChannelId(channel),
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
          width: channel.icon.width <= 0 ? 250 : channel.icon.width,
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
      channel: this.getChannelId(channel),
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
        const query = ['proxy=true'];
        const useShowPoster =
          this.settingsDB.xmlTvSettings().useShowPoster ?? false;
        if (
          program.type === 'content' &&
          program.subtype === 'episode' &&
          useShowPoster
        ) {
          query.push(`useShowPoster=${useShowPoster}`);
        }
        partial.icon = [
          {
            src: `{{host}}/api/programs/${program.id}/thumb?${query.join(
              '&amp;',
            )}`,
          },
        ];
      }
    }

    return partial;
  }

  private getChannelId(channel: Channel): string {
    const existing = channelIdCache[channel.uuid];
    if (existing) {
      return existing;
    }

    // Generates a short but unique ID for this channel
    // in addition to the number. This helps differentiate channels
    // for some players whose guides can get confused.
    let num = channel.number;
    let id = 0;
    while (num !== 0) {
      id += (num % 10) + 48;
      num = Math.floor(num / 10);
    }

    return (channelIdCache[
      channel.uuid
    ] = `C${channel.number}.${id}.tunarr.com`);
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
