import { SettingsDB } from '@/db/SettingsDB.js';
import { ChannelOrm } from '@/db/schema/Channel.js';
import { KEYS } from '@/types/inject.js';
import { getChannelId } from '@/util/channels.js';
import { firstDefined, groupByFunc, isNonEmptyString } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import {
  writeXmltv,
  Xmltv,
  type XmltvChannel,
  type XmltvProgramme,
} from '@iptv/xmltv';
import { Mutex } from 'async-mutex';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { compact, escape, flatMap, isNil, map, round } from 'lodash-es';
import { writeFile } from 'node:fs/promises';
import { match } from 'ts-pattern';
import { MaterializedGuideItem } from '../types/guide.ts';

const lock = new Mutex();

export type MaterializedChannelPrograms = {
  channel: ChannelOrm;
  programs: MaterializedGuideItem[];
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
    const content = writeXmltv(this.generateXmltv(channels));

    return await writeFile(this.settingsDB.xmlTvSettings().outputPath, content);
  }

  generateXmltv(channels: MaterializedChannelPrograms[]) {
    const xmlChannelIdById = groupByFunc(
      channels,
      ({ channel }) => channel.uuid,
      ({ channel }) => getChannelId(channel.number),
    );
    return {
      generatorInfoName: 'tunarr',
      date: new Date(),
      channels: map(channels, ({ channel }) =>
        this.makeXmlTvChannel(channel, xmlChannelIdById[channel.uuid]!),
      ),
      programmes: flatMap(channels, ({ channel, programs }) =>
        map(programs, (p) =>
          this.makeXmlTvProgram(p, xmlChannelIdById[channel.uuid]!),
        ),
      ),
    } satisfies Xmltv;
  }

  private makeXmlTvChannel(
    channel: ChannelOrm,
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
    guideItem: MaterializedGuideItem,
    xmlChannelId: string,
  ): XmltvProgramme {
    const title = match(guideItem)
      .with(
        { programming: { type: 'program' } },
        ({ title, programming: { program } }) => {
          switch (program.type) {
            case 'movie':
            case 'music_video':
            case 'other_video':
              return title ?? program.title;
            case 'episode':
              return program.show?.title ?? program.showTitle ?? program.title;
            case 'track':
              return (
                program.album?.title ?? program.artistName ?? program.title
              );
          }
        },
      )
      // .with({ type: 'custom' }, (c) => c.program?.title ?? 'Custom Program')
      .with({ programming: { type: 'flex' } }, (c) => c.title)
      .with(
        { programming: { type: 'redirect' } },
        (c) => `Redirect to Channel ${c.programming.channelNumber}`,
      )
      .exhaustive();

    const subTitle = match(guideItem.programming)
      .with({ type: 'program', program: { type: 'episode' } }, ({ program }) =>
        program.title === title ? undefined : program.title,
      )
      .with(
        { type: 'program', program: { type: 'track' } },
        ({ program }) =>
          `${program.album?.title ? `${program.album.title} - ` : ''}${program.title}`,
      )
      // .with(
      //   { type: 'custom', program: { subtype: P.union('track', 'episode') } },
      //   (p) => p.program?.title,
      // )
      .otherwise(() => undefined);

    const partial: XmltvProgramme = {
      start: new Date(guideItem.start),
      stop: new Date(guideItem.stop),
      title: [{ _value: escape(title) }],
      previouslyShown: {},
      channel: xmlChannelId,
    };

    if (subTitle) {
      partial.subTitle = [{ _value: escape(subTitle) }];
    }

    if (guideItem.programming.type === 'program') {
      const program = guideItem.programming.program;
      if (program.type !== 'movie' && title !== guideItem.title) {
        partial.subTitle ??= [
          {
            _value: escape(guideItem.title),
          },
        ];
      }

      const desc = compact([program.summary, program.plot]).find(
        isNonEmptyString,
      );

      if (desc) {
        partial.desc ??= [
          {
            _value: escape(desc),
          },
        ];
      }

      const rating = firstDefined(program.rating, program.show?.rating);
      if (rating) {
        partial.rating ??= [
          {
            system: 'MPAA',
            value: rating,
          },
        ];
      }

      if (program.originalAirDate) {
        const parsed = dayjs(
          program.originalAirDate,
          [`YYYY-MM-DDTHH:mm:ssZ`, `YYYY-MM-DD`],
          true,
        );
        if (parsed.isValid()) {
          partial.date ??= parsed.toDate();
        }
      }

      const [seasonNumber, episodeNumber] = match(program)
        .with({ type: 'episode' }, (ep) => {
          return [ep.season?.index ?? ep.seasonNumber, ep.episode];
        })
        .with({ type: 'track' }, (track) => [track.album?.index, track.episode])
        .otherwise(() => [null, null]);
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

      const useShowPoster =
        this.settingsDB.xmlTvSettings().useShowPoster ?? false;

      let url: string;
      if (
        useShowPoster &&
        program.type === 'episode' &&
        program.show?.artwork?.some((art) => art.artworkType === 'poster')
      ) {
        const showId = program.show?.uuid ?? program.tvShowUuid;
        url = `{{host}}/api/programs/${showId}/artwork/poster`;
      } else if (
        program.type === 'episode' &&
        program.artwork?.some((art) => art.artworkType === 'poster')
      ) {
        url = `{{host}}/api/programs/${program.uuid}/artwork/poster`;
      } else if (
        program.type === 'track' &&
        program.album?.artwork?.some((art) => art.artworkType === 'poster')
      ) {
        url = `{{host}}/api/programs/${program.album?.uuid ?? program.albumUuid}/artwork/poster`;
      } else if (program.artwork?.some((art) => art.artworkType === 'poster')) {
        url = `{{host}}/api/programs/${program.uuid}/artwork/poster`;
      } else {
        // TODO: Remove this case when we consolidate all API endppoints for posters / thumbs
        const query: string[] = [];
        if (program.type === 'episode' && useShowPoster) {
          query.push(`useShowPoster=${useShowPoster}`);
        }
        let idToUse = program.uuid;
        if (program.type === 'track' && isNonEmptyString(program.album?.uuid)) {
          idToUse = program.album.uuid;
        }

        url = `{{host}}/api/programs/${idToUse}/thumb?${query.join('&amp;')}`;
      }

      partial.image = [{ _value: url, size: 3 }];
      partial.icon = [{ src: url }];
    }

    return partial;
  }

  isWriting() {
    return lock.isLocked();
  }
}
