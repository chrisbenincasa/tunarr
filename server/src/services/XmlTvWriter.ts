import { SettingsDB } from '@/db/SettingsDB.js';
import { Channel } from '@/db/schema/Channel.js';
import { KEYS } from '@/types/inject.js';
import { getChannelId } from '@/util/channels.js';
import { groupByFunc, isNonEmptyString } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import {
  writeXmltv,
  type XmltvChannel,
  type XmltvProgramme,
} from '@iptv/xmltv';
import { isContentProgram, TvGuideProgram } from '@tunarr/types';
import { Mutex } from 'async-mutex';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { escape, flatMap, isNil, map, round } from 'lodash-es';
import { writeFile } from 'node:fs/promises';
import { match, P } from 'ts-pattern';

const lock = new Mutex();

type MaterializedChannelPrograms = {
  channel: Channel;
  programs: TvGuideProgram[];
};

@injectable()
export class XmlTvWriter {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  constructor(@inject(KEYS.SettingsDB) private settingsDB: SettingsDB) {}

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
    const xmlChannelIdById = groupByFunc(
      channels,
      ({ channel }) => channel.uuid,
      ({ channel }) => getChannelId(channel.number),
    );
    const content = writeXmltv({
      generatorInfoName: 'tunarr',
      date: new Date(),
      channels: map(channels, ({ channel }) =>
        this.makeXmlTvChannel(channel, xmlChannelIdById[channel.uuid]),
      ),
      programmes: flatMap(channels, ({ channel, programs }) =>
        map(programs, (p) =>
          this.makeXmlTvProgram(p, xmlChannelIdById[channel.uuid]),
        ),
      ),
    });

    return await writeFile(this.settingsDB.xmlTvSettings().outputPath, content);
  }

  private makeXmlTvChannel(
    channel: Channel,
    xmlChannelId: string,
  ): XmltvChannel {
    const partial: XmltvChannel = {
      id: xmlChannelId,
      displayName: [
        {
          _value: `${channel.number} ${escape(channel.name)}`,
        },
        {
          _value: `${channel.number}`,
        },
        {
          _value: escape(channel.name),
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
    xmlChannelId: string,
  ): XmltvProgramme {
    const title = match(program)
      .with({ type: 'content' }, (c) => {
        switch (c.subtype) {
          case 'movie':
          case 'music_video':
          case 'other_video':
            return c.title;
          case 'episode':
          case 'track':
            return c.grandparent?.title ?? c.title;
        }
      })
      .with({ type: 'custom' }, (c) => c.program?.title ?? 'Custom Program')
      .with({ type: 'flex' }, (c) => c.title)
      .with({ type: 'redirect' }, (c) => `Redirect to Channel ${c.channel}`)
      .exhaustive();

    const subTitle = match(program)
      .with(
        { type: 'content', subtype: P.union('track', 'episode') },
        (p) => p.title,
      )
      .with(
        { type: 'custom', program: { subtype: P.union('track', 'episode') } },
        (p) => p.program?.title,
      )
      .otherwise(() => undefined);

    const partial: XmltvProgramme = {
      start: new Date(program.start),
      stop: new Date(program.stop),
      title: [{ _value: escape(title) }],
      previouslyShown: {},
      channel: xmlChannelId,
    };

    if (subTitle) {
      partial.subTitle = [{ _value: escape(subTitle) }];
    }

    if (program.type === 'content' && isNonEmptyString(program.summary)) {
      partial.desc = [{ _value: program.summary }];
    } else if (
      program.type === 'custom' &&
      isNonEmptyString(program.program?.summary)
    ) {
      partial.desc = [{ _value: program.program.summary }];
    }

    if (isContentProgram(program)) {
      // TODO: Use grouping mappings here.
      if (program.subtype !== 'movie' && title !== program.title) {
        partial.subTitle ??= [
          {
            _value: escape(program.title),
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

      if (program.date) {
        partial.date ??= dayjs(program.date).toDate();
      }

      const seasonNumber = program.parent?.index ?? program.seasonNumber;
      const episodeNumber = program.index ?? program.episodeNumber;
      if (!isNil(seasonNumber) && !isNil(episodeNumber)) {
        partial.episodeNum = [
          {
            system: 'onscreen',
            _value: `S${seasonNumber}E${episodeNumber}`,
          },
        ];
        // Simply drop the xmltv notation system for specials (seasonn == 0)
        // or for any epipsode number that would lead to invalid syntax
        if (seasonNumber > 0 && episodeNumber > 0) {
          partial.episodeNum.push({
            system: 'xmltv_ns',
            _value: `${seasonNumber - 1}.${episodeNumber - 1}.0/1`,
          });
        }
      }

      if (isNonEmptyString(program.id)) {
        const query: string[] = [];
        const useShowPoster =
          this.settingsDB.xmlTvSettings().useShowPoster ?? false;
        if (
          program.type === 'content' &&
          program.subtype === 'episode' &&
          useShowPoster
        ) {
          query.push(`useShowPoster=${useShowPoster}`);
        }

        let idToUse = program.id;
        if (
          program.subtype === 'track' &&
          isNonEmptyString(program.parent?.id)
        ) {
          idToUse = program.parent?.id;
        }

        partial.image = [
          {
            _value: `{{host}}/api/programs/${idToUse}/thumb?${query.join(
              '&amp;',
            )}`,
            size: 3,
          },
        ];
        partial.icon = [
          {
            src: `{{host}}/api/programs/${idToUse}/thumb?${query.join(
              '&amp;',
            )}`,
          },
        ];
      }
    }

    return partial;
  }

  isWriting() {
    return lock.isLocked();
  }
}
