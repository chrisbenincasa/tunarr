import {
  writeXmltv,
  type XmltvChannel,
  type XmltvProgramme,
} from '@iptv/xmltv';
import { TvGuideProgram, isContentProgram } from '@tunarr/types';
import { Mutex } from 'async-mutex';
import { writeFile } from 'fs/promises';
import { escape, flatMap, isNil, map, round } from 'lodash-es';
import { match } from 'ts-pattern';
import { SettingsDB, getSettings } from '../db/SettingsDB.ts';
import { Channel } from '../db/schema/Channel.ts';
import { getChannelId } from '../util/channels.js';
import { isNonEmptyString } from '../util/index.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';

const lock = new Mutex();

const channelIdCache: Record<string, string> = {};

type MaterializedChannelPrograms = {
  channel: Channel;
  programs: TvGuideProgram[];
};

export class XmlTvWriter {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  constructor(private settingsDB: SettingsDB = getSettings()) {}

  async write(channels: MaterializedChannelPrograms[]) {
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

  private async writeInternal(channels: MaterializedChannelPrograms[]) {
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
    const title = match(program)
      .with({ type: 'content' }, (c) => c.title)
      .with({ type: 'custom' }, (c) => c.program?.title ?? 'Custom Program')
      .with({ type: 'flex' }, (c) => c.title)
      .with({ type: 'redirect' }, (c) => `Redirect to Channel ${c.channel}`)
      .exhaustive();

    const partial: XmltvProgramme = {
      start: new Date(program.start),
      stop: new Date(program.stop),
      title: [{ _value: escape(title) }],
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
        ];
        // Simply drop the xmltv notation system for specials (seasonn == 0)
        // or for any epipsode number that would lead to invalid syntax
        if (program.seasonNumber > 0 && program.episodeNumber > 0) {
          partial.episodeNum.push({
            system: 'xmltv_ns',
            _value: `${program.seasonNumber - 1}.${
              program.episodeNumber - 1
            }.0/1`,
          });
        }
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

    return (channelIdCache[channel.uuid] = getChannelId(channel.number));
  }

  // private static titleExtractor = forProgramType({
  //   custom: (program) => program.program?.title ?? 'Custom Program',
  //   content: (program) => program.title,
  //   redirect: (program) => `Redirect to Channel ${program.channel}`,
  //   flex: program => ,
  // });

  isWriting() {
    return lock.isLocked();
  }
}
