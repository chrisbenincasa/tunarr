import type { NewSingleOrMultiExternalId } from '@/db/schema/ProgramExternalId.js';
import { seq } from '@tunarr/shared/util';
import {
  Actor,
  Episode,
  isTerminalItemType,
  MediaArtwork,
  NamedEntity,
  ProgramLike,
  Resolution,
  TerminalProgram,
} from '@tunarr/types';
import {
  isValidMultiExternalIdType,
  isValidSingleExternalIdType,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { injectable } from 'inversify';
import { compact, find } from 'lodash-es';
import { match, P } from 'ts-pattern';
import { v4 } from 'uuid';
import {
  HasMediaSourceInfo,
  MediaSourceMovie,
  MediaSourceMusicTrack,
  MediaSourceMusicVideo,
  MediaSourceOtherVideo,
} from '../../types/Media.ts';
import { Nilable } from '../../types/util.ts';
import { isNonEmptyString } from '../../util/index.ts';
import { NewArtwork } from '../schema/Artwork.ts';
import { CreditType, NewCredit } from '../schema/Credit.ts';
import { MediaSourceOrm } from '../schema/MediaSource.ts';
import { MediaSourceLibrary } from '../schema/MediaSourceLibrary.ts';
import { ProgramType } from '../schema/Program.ts';
import { NewProgramMediaFile } from '../schema/ProgramMediaFile.ts';
import { NewProgramMediaStream } from '../schema/ProgramMediaStream.ts';
import { NewProgramSubtitles } from '../schema/ProgramSubtitles.ts';
import {
  NewCreditWithArtwork,
  NewEpisodeProgram,
  NewMovieProgram,
  NewMusicTrack,
  NewMusicVideoProgram,
  NewOtherVideoProgram,
  NewProgramVersion,
  NewProgramWithRelations,
} from '../schema/derivedTypes.js';
import { CommonDaoMinter } from './CommonDaoMinter.ts';

/**
 * Generates Program DB entities for Plex media
 */
@injectable()
export class ProgramDaoMinter {
  constructor() {}

  mint(
    mediaSource: MediaSourceOrm,
    mediaLibrary: MediaSourceLibrary,
    program: TerminalProgram & HasMediaSourceInfo,
    localFolderId?: string,
    now: number = +dayjs(),
  ): NewProgramWithRelations {
    return match(program)
      .with({ type: 'movie' }, (movie) =>
        this.mintMovie(mediaSource, mediaLibrary, movie, localFolderId, now),
      )
      .with({ type: 'episode' }, (episode) =>
        this.mintEpisode(
          mediaSource,
          mediaLibrary,
          episode,
          localFolderId,
          now,
        ),
      )
      .with({ type: 'track' }, (track) =>
        this.mintMusicTrack(
          mediaSource,
          mediaLibrary,
          track,
          localFolderId,
          now,
        ),
      )
      .with({ type: 'music_video' }, (mv) =>
        this.mintMusicVideo(mediaSource, mediaLibrary, mv, localFolderId, now),
      )
      .with({ type: 'other_video' }, (ov) =>
        this.mintOtherVideo(mediaSource, mediaLibrary, ov, localFolderId, now),
      )
      .exhaustive();
  }

  mintMovie(
    mediaSource: MediaSourceOrm,
    mediaLibrary: MediaSourceLibrary,
    movie: MediaSourceMovie,
    localFolderId?: string,
    now: number = +dayjs(),
    programUuid?: string,
  ): NewProgramWithRelations<'movie'> {
    const programId = programUuid ?? v4();
    const newMovie = {
      uuid: programId,
      sourceType: movie.sourceType,
      externalKey: movie.externalId,
      originalAirDate: movie.releaseDate
        ? dayjs(movie.releaseDate)?.format()
        : null,
      duration: movie.duration ?? 0,
      externalSourceId: mediaSource.name,
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      plot: movie.plot,
      tagline: movie.tagline,
      rating: movie.rating,
      summary: movie.summary,
      title: movie.title,
      type: ProgramType.Movie,
      year: movie.year,
      createdAt: now,
      updatedAt: now,
      canonicalId: movie.canonicalId,
      state: 'ok',
    } satisfies NewMovieProgram;

    return {
      program: newMovie,
      externalIds: this.mintExternalIdsNew(programId, movie, mediaSource, now),
      versions: this.mintVersions(programId, movie, localFolderId, now),
      subtitles: this.mintSubtitles(programId, movie),
      artwork: movie.artwork.map((art) =>
        this.mintArtwork(art, programId, now),
      ),
      credits: seq
        .collect(movie.actors, (actor) =>
          this.mintCreditForActor(actor, programId, now),
        )
        .concat(
          seq.collect(movie.directors, (dir) =>
            this.mintCredit(dir, 'director', programId, now),
          ),
        )
        .concat(
          seq.collect(movie.writers, (dir) =>
            this.mintCredit(dir, 'writer', programId, now),
          ),
        ),
      genres: seq.collect(movie.genres, (genre) =>
        CommonDaoMinter.mintGenre(genre.name),
      ),
      studios: seq.collect(movie.studios, (studio) =>
        CommonDaoMinter.mintStudio(studio.name),
      ),
      tags: seq.collect(movie.tags, (tag) => CommonDaoMinter.mintTag(tag)),
    };
  }

  mintVersions(
    programId: string,
    item: TerminalProgram,
    localFolderId?: string,
    now: number = +dayjs(),
  ): NewProgramVersion[] {
    const versions: NewProgramVersion[] = [];
    if (item.mediaItem) {
      const versionId = v4();
      const streams = item.mediaItem.streams.map((stream) => {
        return {
          codec: stream.codec,
          index: stream.index,
          profile: stream.profile,
          programVersionId: versionId,
          streamKind: stream.streamType,
          uuid: v4(),
          bitsPerSample: stream.bitDepth,
          channels: stream.channels,
          colorRange: stream.colorRange ?? null,
          colorSpace: stream.colorSpace ?? null,
          colorTransfer: stream.colorTransfer ?? null,
          colorPrimaries: stream.colorPrimaries ?? null,
          default: stream.default ?? false,
          //TODO: forced: stream.forced
          language: stream.languageCodeISO6392,
          pixelFormat: stream.pixelFormat,
          title: stream.title,
        } satisfies NewProgramMediaStream;
      });

      const files = item.mediaItem.locations.map((loc) => {
        return {
          path: loc.path,
          programVersionId: versionId,
          localMediaFolderId: localFolderId,
          uuid: v4(),
        } satisfies NewProgramMediaFile;
      });

      let resolution: Nilable<Resolution> = item.mediaItem.resolution;
      if (item.type === 'track') {
        // Tracks will not have a resolution ever
        resolution = { heightPx: 0, widthPx: 0 };
      }

      if (resolution) {
        const version: NewProgramVersion = {
          uuid: versionId,
          createdAt: new Date(now),
          updatedAt: new Date(now),
          programId,
          displayAspectRatio: item.mediaItem.displayAspectRatio,
          duration: item.mediaItem.duration,
          frameRate: match(item.mediaItem.frameRate)
            .with(P.string, (str) => str)
            .with(P.number, (num) => num.toString())
            .with(P.nullish, (nil) => nil)
            .exhaustive(),
          sampleAspectRatio: item.mediaItem.sampleAspectRatio,
          height: resolution.heightPx,
          width: resolution.widthPx,
          mediaStreams: streams,
          mediaFiles: files,
          chapters: item.mediaItem.chapters?.map((chapter) => {
            return {
              index: chapter.index,
              programVersionId: versionId,
              chapterType: chapter.chapterType,
              uuid: v4(),
              title: chapter.title,
              startTime: chapter.startTime,
              endTime: chapter.endTime,
            };
          }),
          scanKind: item.mediaItem.scanKind ?? 'unknown',
        };

        versions.push(version);
      }
    }

    return versions;
  }

  mintExternalIdsNew(
    programId: string,
    item: ProgramLike,
    mediaSource: MediaSourceOrm,
    now: number = +dayjs(),
  ): NewSingleOrMultiExternalId[] {
    return seq.collect(item.identifiers, (id) => {
      if (isNonEmptyString(id.id) && isValidSingleExternalIdType(id.type)) {
        return {
          type: 'single',
          externalKey: id.id,
          programUuid: programId,
          sourceType: id.type,
          uuid: v4(),
          createdAt: now,
          updatedAt: now,
        } satisfies NewSingleOrMultiExternalId;
      } else if (isValidMultiExternalIdType(id.type)) {
        const isMediaSourceId = id.type === mediaSource.type;
        // This stinks
        const location =
          isMediaSourceId && isTerminalItemType(item)
            ? find(item.mediaItem?.locations, { sourceType: mediaSource.type })
            : null;
        return {
          type: 'multi',
          externalKey: id.id,
          programUuid: programId,
          sourceType: id.type,
          uuid: v4(),
          createdAt: now,
          updatedAt: now,
          externalSourceId: mediaSource.name, // legacy
          mediaSourceId: mediaSource.uuid, // new
          // TODO
          directFilePath: location?.path,
          externalFilePath:
            location?.type === 'remote' ? location.externalKey : null,
          // externalFilePath
        } satisfies NewSingleOrMultiExternalId;
      }

      return;
    });
  }

  mintSubtitles(
    programId: string,
    item: TerminalProgram,
  ): NewProgramSubtitles[] {
    const subtitleStreams =
      item.mediaItem?.streams.filter(
        (s) =>
          s.streamType === 'subtitles' || s.streamType === 'external_subtitles',
      ) ?? [];
    const additionalSubtitles = item.externalSubtitles ?? [];

    const now = dayjs().toDate();
    const mappedStreams = subtitleStreams.map((subtitle) => {
      return {
        uuid: v4(),
        programId,
        createdAt: now,
        updatedAt: now, // Do we need to use mtime?
        language: subtitle.languageCodeISO6392 ?? 'unknown',
        subtitleType:
          subtitle.streamType === 'subtitles' ? 'embedded' : 'sidecar',
        default: subtitle.default ?? false,
        forced: subtitle.forced ?? false,
        path: subtitle.fileName,
        sdh: subtitle.sdh ?? false,
        streamIndex:
          subtitle.streamType === 'external_subtitles' ? null : subtitle.index,
        codec: subtitle.codec,
      } satisfies NewProgramSubtitles;
    });

    const mappedAdditional = additionalSubtitles.map((subtitle) => {
      return {
        codec: subtitle.codec,
        createdAt: now,
        updatedAt: now, // Do we need to use mtime?
        language: subtitle.language,
        subtitleType: subtitle.subtitleType,
        default: subtitle.default ?? false,
        forced: subtitle.forced ?? false,
        path: subtitle.path,
        sdh: subtitle.sdh ?? false,
        streamIndex: subtitle.streamIndex,
        uuid: v4(),
        programId,
      } satisfies NewProgramSubtitles;
    });

    return [...mappedStreams, ...mappedAdditional];
  }

  mintEpisode(
    mediaSource: MediaSourceOrm,
    mediaLibrary: MediaSourceLibrary,
    episode: Episode,
    localFolderId?: string,
    now: number = +dayjs(),
  ): NewProgramWithRelations<'episode'> {
    const programId = v4();

    const newEpisode = {
      uuid: programId,
      sourceType: episode.sourceType,
      externalKey: episode.externalId,
      originalAirDate: episode.releaseDate
        ? dayjs(episode.releaseDate).format()
        : null,
      duration: episode.duration ?? 0,
      // filePath: file?.file ?? null,
      externalSourceId: mediaSource.name,
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      rating: null,
      summary: episode.summary,
      title: episode.title,
      type: ProgramType.Episode,
      year: episode.year,
      createdAt: now,
      updatedAt: now,
      canonicalId: episode.canonicalId,
      seasonNumber: episode.season?.index,
      episode: episode.episodeNumber,
      state: 'ok',
    } satisfies NewEpisodeProgram;

    return {
      program: newEpisode,
      externalIds: this.mintExternalIdsNew(
        programId,
        episode,
        mediaSource,
        now,
      ),
      versions: this.mintVersions(programId, episode, localFolderId, now),
      artwork: episode.artwork.map((art) =>
        this.mintArtwork(art, programId, now),
      ),
      credits: compact([
        ...seq.collect(episode.actors, (actor) =>
          this.mintCreditForActor(actor, programId, now),
        ),
        ...(episode.writers?.map((writer) =>
          this.mintCredit(writer, 'writer', programId, now),
        ) ?? []),
        ...(episode.directors?.map((director) =>
          this.mintCredit(director, 'director', programId, now),
        ) ?? []),
      ]),
      subtitles: this.mintSubtitles(programId, episode),
      genres: seq.collect(episode.genres, (genre) =>
        CommonDaoMinter.mintGenre(genre.name),
      ),
      studios: seq.collect(episode.studios, (studio) =>
        CommonDaoMinter.mintStudio(studio.name),
      ),
      tags: seq.collect(episode.tags, (tag) => CommonDaoMinter.mintTag(tag)),
    };
  }

  mintMusicTrack(
    mediaSource: MediaSourceOrm,
    mediaLibrary: MediaSourceLibrary,
    track: MediaSourceMusicTrack,
    localFolderId?: string,
    now: number = +dayjs(),
  ): NewProgramWithRelations<'track'> {
    const programId = v4();

    const newTrack = {
      uuid: programId,
      sourceType: track.sourceType,
      externalKey: track.externalId,
      originalAirDate: track.releaseDate
        ? dayjs(track.releaseDate)?.format()
        : null,
      duration: track.duration ?? 0,
      // filePath: file?.file ?? null,
      externalSourceId: mediaSource.name,
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      // plexRatingKey: plexMovie.ratingKey,
      // plexFilePath: file?.key ?? null,
      rating: null,
      summary: null,
      title: track.title,
      type: ProgramType.Track,
      year: track.year,
      createdAt: now,
      updatedAt: now,
      canonicalId: track.canonicalId,
      state: 'ok',
      // TODO: change this field name! jeez!
      episode: track.trackNumber,
    } satisfies NewMusicTrack;

    return {
      program: newTrack,
      externalIds: this.mintExternalIdsNew(programId, track, mediaSource, now),
      versions: this.mintVersions(programId, track, localFolderId, now),
      artwork: track.artwork.map((art) =>
        this.mintArtwork(art, programId, now),
      ),
      credits: [],
      subtitles: [],
      genres: seq.collect(track.genres, (genre) =>
        CommonDaoMinter.mintGenre(genre.name),
      ),
      studios: seq.collect(track.studios, (studio) =>
        CommonDaoMinter.mintStudio(studio.name),
      ),
      tags: seq.collect(track.tags, (tag) => CommonDaoMinter.mintTag(tag)),
    };
  }

  mintOtherVideo(
    mediaSource: MediaSourceOrm,
    mediaLibrary: MediaSourceLibrary,
    video: MediaSourceOtherVideo,
    localFolderId?: string,
    now: number = +dayjs(),
  ): NewProgramWithRelations<'other_video'> {
    const programId = v4();
    const newVideo = {
      uuid: programId,
      sourceType: video.sourceType,
      externalKey: video.externalId,
      originalAirDate: video.releaseDate
        ? dayjs(video.releaseDate)?.format()
        : null,
      duration: video.duration ?? 0,
      externalSourceId: mediaSource.name,
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      title: video.title,
      type: ProgramType.OtherVideo,
      year: video.year,
      createdAt: now,
      updatedAt: now,
      canonicalId: video.canonicalId,
      state: 'ok',
    } satisfies NewOtherVideoProgram;

    return {
      program: newVideo,
      externalIds: this.mintExternalIdsNew(programId, video, mediaSource, now),
      versions: this.mintVersions(programId, video, localFolderId, now),
      artwork: video.artwork.map((art) =>
        this.mintArtwork(art, programId, now),
      ),
      credits: compact([
        ...seq.collect(video.actors, (actor) =>
          this.mintCreditForActor(actor, programId, now),
        ),
        ...(video.writers?.map((writer) =>
          this.mintCredit(writer, 'writer', programId, now),
        ) ?? []),
        ...(video.directors?.map((director) =>
          this.mintCredit(director, 'director', programId, now),
        ) ?? []),
      ]),
      subtitles: this.mintSubtitles(programId, video),
      genres: seq.collect(video.genres, (genre) =>
        CommonDaoMinter.mintGenre(genre.name),
      ),
      studios: seq.collect(video.studios, (studio) =>
        CommonDaoMinter.mintStudio(studio.name),
      ),
      tags: seq.collect(video.tags, (tag) => CommonDaoMinter.mintTag(tag)),
    };
  }

  mintMusicVideo(
    mediaSource: MediaSourceOrm,
    mediaLibrary: MediaSourceLibrary,
    video: MediaSourceMusicVideo,
    localFolderId?: string,
    now: number = +dayjs(),
  ): NewProgramWithRelations<'music_video'> {
    const programId = v4();
    const newVideo = {
      uuid: programId,
      sourceType: video.sourceType,
      externalKey: video.externalId,
      originalAirDate: video.releaseDate
        ? dayjs(video.releaseDate)?.format()
        : null,
      duration: video.duration ?? 0,
      externalSourceId: mediaSource.name,
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      title: video.title,
      type: ProgramType.MusicVideo,
      year: video.year,
      createdAt: now,
      updatedAt: now,
      canonicalId: video.canonicalId,
      state: 'ok',
    } satisfies NewMusicVideoProgram;

    return {
      program: newVideo,
      externalIds: this.mintExternalIdsNew(programId, video, mediaSource, now),
      versions: this.mintVersions(programId, video, localFolderId, now),
      artwork: video.artwork.map((art) =>
        this.mintArtwork(art, programId, now),
      ),
      credits: compact([
        ...seq.collect(video.actors, (actor) =>
          this.mintCreditForActor(actor, programId, now),
        ),
        ...(video.writers?.map((writer) =>
          this.mintCredit(writer, 'writer', programId, now),
        ) ?? []),
        ...(video.directors?.map((director) =>
          this.mintCredit(director, 'director', programId, now),
        ) ?? []),
      ]),
      subtitles: this.mintSubtitles(programId, video),
      genres: seq.collect(video.genres, (genre) =>
        CommonDaoMinter.mintGenre(genre.name),
      ),
      studios: seq.collect(video.studios, (studio) =>
        CommonDaoMinter.mintStudio(studio.name),
      ),
      tags: seq.collect(video.tags, (tag) => CommonDaoMinter.mintTag(tag)),
    };
  }

  mintCreditForActor(
    actor: Actor,
    programId: string,
    createdAt: number = +dayjs(),
    updatedAt: number = createdAt,
  ): NewCreditWithArtwork {
    const credit = {
      type: 'cast',
      name: actor.name,
      uuid: v4(),
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      programId,
      index: actor.order,
      role: actor.role,
    } satisfies NewCredit;

    const artwork: NewArtwork[] = [];
    if (isNonEmptyString(actor.thumb)) {
      artwork.push({
        artworkType: 'thumbnail',
        sourcePath: actor.thumb,
        uuid: v4(),
        creditId: credit.uuid,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
      });
    }

    return {
      credit,
      artwork,
    };
  }

  mintCredit(
    entity: NamedEntity & { thumb?: Nilable<string> },
    type: CreditType,
    programId: string,
    createdAt: number = +dayjs(),
    updatedAt: number = createdAt,
  ): NewCreditWithArtwork {
    const credit = {
      type,
      name: entity.name,
      uuid: v4(),
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      programId,
    } satisfies NewCredit;

    const artwork: NewArtwork[] = [];
    if (isNonEmptyString(entity.thumb)) {
      artwork.push({
        artworkType: 'thumbnail',
        sourcePath: entity.thumb,
        uuid: v4(),
        creditId: credit.uuid,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
      });
    }

    return {
      credit,
      artwork,
    };
  }

  private mintArtwork(
    artwork: MediaArtwork,
    programId: string,
    now: number,
  ): NewArtwork {
    return {
      uuid: v4(),
      programId,
      artworkType: artwork.type,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      sourcePath: artwork.path!,
    };
  }
}
