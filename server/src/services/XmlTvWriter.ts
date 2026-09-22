import type { SettingsDB } from '@/db/SettingsDB.js';
import type { ChannelOrm } from '@/db/schema/Channel.js';
import { KEYS } from '@/types/inject.js';
import { getChannelId } from '@/util/channels.js';
import { resolveIconUrl } from '@/util/iconUtil.js';
import { firstDefined, groupByFunc, isNonEmptyString } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import type { Xmltv } from '@iptv/xmltv';
import {
  writeXmltv,
  type XmltvChannel,
  type XmltvCreditImage,
  type XmltvPerson,
  type XmltvProgramme,
} from '@iptv/xmltv';
import { Mutex } from 'async-mutex';
import { inject, injectable } from 'inversify';
import { compact, escape, flatMap, isNil, map, round } from 'lodash-es';
import { writeFile } from 'node:fs/promises';
import { match } from 'ts-pattern';
import { type ArtworkType } from '../db/schema/Artwork.ts';
import type { ProgramWithRelationsOrm } from '../db/schema/derivedTypes.ts';
import type { MaterializedGuideItem } from '../types/guide.ts';
import { parseAirDate } from '../util/airDate.ts';
import { loggingDef } from '../util/logging/loggingDef.ts';

const lock = new Mutex();

/**
 * The fields `ArtworkService` needs to build a remote artwork URL for an item
 * that has no stored `artwork` row. Both `Program` and `ProgramGrouping` carry
 * them, so a program, its show and its album are all checked the same way.
 */
type ArtworkSourceRef = {
  sourceType?: string | null;
  externalKey?: string | null;
  mediaSourceId?: string | null;
};

// The source types `buildArtworkSourcePath` knows how to build a URL for.
// Anything else (`local`, or a source type added later) derives to nothing.
const DERIVABLE_SOURCE_TYPES: readonly string[] = ['plex', 'jellyfin', 'emby'];

/**
 * Mirrors the guard in `ArtworkService.deriveArtworkFromSource`. If these are
 * present the endpoint can build the URL, so emitting one here is safe; if they
 * are not, the endpoint would 404 and dropping the <icon> is honest.
 */
function isDerivableArtworkSource(
  source: ArtworkSourceRef | null | undefined,
): boolean {
  return (
    !isNil(source) &&
    isNonEmptyString(source.sourceType) &&
    DERIVABLE_SOURCE_TYPES.includes(source.sourceType) &&
    isNonEmptyString(source.externalKey) &&
    isNonEmptyString(source.mediaSourceId)
  );
}

export type MaterializedChannelPrograms = {
  channel: ChannelOrm;
  programs: MaterializedGuideItem[];
};

@injectable()
@loggingDef({ category: 'scheduling' })
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
      generatorInfoUrl: 'https://tunarr.com',
      sourceInfoName: 'tunarr',
      sourceInfoUrl: `{{host}}/web`,
      sourceDataUrl: `{{host}}/api/xmltv.xml`,
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

    const iconSrc = resolveIconUrl(channel.icon, '{{host}}/images/tunarr.png');
    if (iconSrc) {
      partial.icon = [
        {
          src: escape(iconSrc),
          width:
            channel.icon?.width && channel.icon.width > 0
              ? channel.icon.width
              : 250,
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
      .with(
        { type: 'program', program: { type: 'movie' } },
        ({ program }) => program.tagline,
      )
      // .with(
      //   { type: 'custom', program: { subtype: P.union('track', 'episode') } },
      //   (p) => p.program?.title,
      // )
      .otherwise(() => undefined);

    // @iptv/xmltv emits children in property insertion order. Keep direct
    // program children in DTD order: icon before episode-num, image last.
    const partial: XmltvProgramme = {
      start: new Date(guideItem.start),
      stop: new Date(guideItem.stop),
      title: [{ _value: escape(title) }],
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

      const credits = program.credits?.length
        ? program.credits
        : program.show?.credits;

      for (const credit of credits ?? []) {
        partial.credits ??= {};
        let xmlCreditList: XmltvPerson[] | undefined;
        switch (credit.type) {
          case 'cast':
            xmlCreditList = partial.credits.actor ??= [];
            break;
          case 'director':
            xmlCreditList = partial.credits.director ??= [];
            break;
          case 'writer':
            xmlCreditList = partial.credits.writer ??= [];
            break;
          case 'producer':
            xmlCreditList = partial.credits.producer ??= [];
            break;
        }

        xmlCreditList.push({
          _value: escape(credit.name),
          ...(credit.role?.length && { role: credit.role }),
          ...(this.settingsDB.featureFlags().xmltvCreditImagesEnabled &&
            credit.artwork?.length && {
              image: credit.artwork.map(
                (a) =>
                  ({
                    _value: `{{host}}/api/credits/${credit.uuid}/artwork/${a.artworkType}`,
                    type: 'person',
                  }) as XmltvCreditImage,
              ),
            }),
        });
      }

      const airDate = parseAirDate(program.originalAirDate);
      if (airDate) {
        partial.date ??= airDate.toDate();
      }

      const genres = [
        ...(program.genres ?? []),
        ...(program.show?.genres ?? []),
      ];
      const uniqueCategories: Set<string> = new Set();
      for (const { genre } of genres ?? []) {
        uniqueCategories.add(genre.name);
      }

      partial.category = Array.from(uniqueCategories).map((c) => ({
        _value: escape(c),
      }));

      const tags = [...(program.tags ?? []), ...(program.show?.tags ?? [])];
      const uniqueKeywords: Set<string> = new Set();
      for (const { tag } of tags ?? []) {
        uniqueKeywords.add(tag.tag);
      }
      partial.keyword = Array.from(uniqueKeywords).map((k) => ({
        _value: escape(k),
      }));

      if (program.duration > 0) {
        // length only supports seconds minutes or hours so convert duration from ms to seconds
        partial.length = { _value: program.duration * 0.001, units: 'seconds' };
      }

      const useShowPoster =
        this.settingsDB.xmlTvSettings().useShowPoster ?? false;
      const url = XmlTvWriter.resolveArtworkUrl(program, {
        useShowPoster,
      });

      if (url) {
        partial.icon = [{ src: url }];
      }

      const [seasonNumber, episodeNumber] = match(program)
        .with({ type: 'episode' }, (ep) => {
          return [ep.season?.index ?? ep.seasonNumber, ep.episode];
        })
        .with({ type: 'track' }, (track) => [track.album?.index, track.episode])
        .otherwise(() => [null, null]);

      partial.episodeNum = [];
      if (!isNil(episodeNumber)) {
        const seasonString = isNil(seasonNumber)
          ? ''
          : `S${seasonNumber.toString().padStart(2, '0')}`;
        partial.episodeNum = [
          {
            system: 'onscreen',
            _value: `${seasonString}E${episodeNumber.toString().padStart(2, '0')}`,
          },
        ];
      }

      // xmltv_ns string is of the format SeasonIndex.EpisodeIndex.PartIndex/PartCount
      // where indexes are 0-based and each portion is optional if unknown
      // we don't have part information right now so we always omit it
      // we also omit the season number for season 0 as that is used for specials which don't have a valid representation in this format
      if (episodeNumber || seasonNumber) {
        partial.episodeNum.push({
          system: 'xmltv_ns',
          _value: `${seasonNumber ? seasonNumber - 1 : ''}.${episodeNumber ? episodeNumber - 1 : ''}.`,
        });
      }

      if (program.type === 'track') {
        partial.video = { present: false };
      }

      const rating = firstDefined(program.rating, program.show?.rating);
      if (rating) {
        partial.rating ??= [
          {
            system:
              program.type === 'movie'
                ? 'MPAA'
                : program.type === 'track'
                  ? 'RIAA'
                  : 'VCHIP',
            value: escape(rating),
          },
        ];
      }

      if (url) {
        partial.image = [{ _value: url, size: 3, type: 'poster' }];
      }
    }

    return partial;
  }

  static resolveArtworkUrl(
    program: ProgramWithRelationsOrm,
    opts: { useShowPoster: boolean },
  ): string | undefined {
    type ArtworkCandidate = {
      id: string | null | undefined;
      artwork: { artworkType: ArtworkType | null }[] | undefined;
      types: ArtworkType[];
      // The item the id points at, so a candidate with no stored artwork row
      // can still be checked for a derivable one.
      source: ArtworkSourceRef | null | undefined;
    };

    const candidates: ArtworkCandidate[] = [];

    if (program.type === 'episode') {
      if (opts.useShowPoster) {
        candidates.push({
          id: program.show?.uuid ?? program.tvShowUuid,
          artwork: program.show?.artwork ?? undefined,
          types: ['poster'],
          source: program.show,
        });
      }
      candidates.push({
        id: program.uuid,
        artwork: program.artwork,
        types: ['poster', 'thumbnail'],
        source: program,
      });
    }

    if (program.type === 'track') {
      candidates.push({
        id: program.album?.uuid ?? program.albumUuid,
        artwork: program.album?.artwork ?? undefined,
        types: ['poster'],
        source: program.album,
      });
    }

    // Generic fallback: program's own poster
    candidates.push({
      id: program.uuid,
      artwork: program.artwork,
      types: ['poster'],
      source: program,
    });

    for (const candidate of candidates) {
      if (!candidate.id) continue;
      const art = candidate.artwork?.find(
        (a) => a.artworkType && candidate.types.includes(a.artworkType),
      );
      if (art?.artworkType) {
        return `{{host}}/api/programs/${candidate.id}/artwork/${art.artworkType}`;
      }
    }

    // Nothing stored yet. `BackfillProgramArtworkFixer` may not have reached
    // this item, and it never reaches one whose artwork was never scanned at
    // all. The artwork endpoint derives the remote URL from the item's own
    // media source on request, so emit the URL it can answer rather than
    // dropping the <icon> — the same precedence, one layer later.
    for (const candidate of candidates) {
      if (!candidate.id || !isDerivableArtworkSource(candidate.source)) {
        continue;
      }
      return `{{host}}/api/programs/${candidate.id}/artwork/poster`;
    }

    return undefined;
  }

  isWriting() {
    return lock.isLocked();
  }
}
