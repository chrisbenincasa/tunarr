import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import { ProgramSourceType } from '@/db/custom_types/ProgramSourceType.js';
import type {
  NewProgramExternalId,
  NewSingleOrMultiExternalId,
} from '@/db/schema/ProgramExternalId.js';
import { seq } from '@tunarr/shared/util';
import {
  Actor,
  Episode,
  isTerminalItemType,
  MediaArtwork,
  NamedEntity,
  ProgramLike,
  tag,
  TerminalProgram,
  type ContentProgram,
} from '@tunarr/types';
import type { JellyfinItem } from '@tunarr/types/jellyfin';
import type {
  PlexMovie as ApiPlexMovie,
  PlexEpisode,
  PlexMedia,
  PlexMusicTrack,
  PlexTerminalMedia,
} from '@tunarr/types/plex';
import {
  isValidMultiExternalIdType,
  isValidSingleExternalIdType,
  type ContentProgramOriginalProgram,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { compact, find, first, head, isError } from 'lodash-es';
import { match, P } from 'ts-pattern';
import { v4 } from 'uuid';
import { Canonicalizer } from '../../services/Canonicalizer.ts';
import {
  MediaSourceMovie,
  MediaSourceMusicTrack,
  MediaSourceOtherVideo,
} from '../../types/Media.ts';
import { KEYS } from '../../types/inject.ts';
import { Maybe, Nilable } from '../../types/util.ts';
import { parsePlexGuid } from '../../util/externalIds.ts';
import { isNonEmptyString } from '../../util/index.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { booleanToNumber } from '../../util/sqliteUtil.ts';
import { NewArtwork } from '../schema/Artwork.ts';
import { CreditType, NewCredit } from '../schema/Credit.ts';
import { NewGenre } from '../schema/Genre.ts';
import { MediaSourceOrm } from '../schema/MediaSource.ts';
import { MediaSourceLibraryOrm } from '../schema/MediaSourceLibrary.ts';
import type { NewProgramDao } from '../schema/Program.ts';
import { ProgramType } from '../schema/Program.ts';
import { NewProgramMediaFile } from '../schema/ProgramMediaFile.ts';
import { NewProgramMediaStream } from '../schema/ProgramMediaStream.ts';
import { NewProgramSubtitles } from '../schema/ProgramSubtitles.ts';
import { NewStudio } from '../schema/Studio.ts';
import { MediaSourceId, MediaSourceName } from '../schema/base.js';
import {
  NewCreditWithArtwork,
  NewEpisodeProgram,
  NewMovieProgram,
  NewMusicTrack,
  NewOtherVideoProgram,
  NewProgramVersion,
  NewProgramWithExternalIds,
  NewProgramWithRelations,
} from '../schema/derivedTypes.js';

/**
 * Generates Program DB entities for Plex media
 */
@injectable()
export class ProgramDaoMinter {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.PlexCanonicalizer)
    private plexProgramCanonicalizer: Canonicalizer<PlexMedia>,
    @inject(KEYS.JellyfinCanonicalizer)
    private jellyfinCanonicalizer: Canonicalizer<JellyfinItem>,
  ) {}

  contentProgramDtoToDao(program: ContentProgram): Maybe<NewProgramDao> {
    if (!isNonEmptyString(program.canonicalId)) {
      this.logger.warn('Program missing canonical ID on upsert: %O', program);
      return;
    } else if (!isNonEmptyString(program.libraryId)) {
      this.logger.warn('Program missing library ID on upsert: %O', program);
      return;
    }

    const now = +dayjs();
    return {
      uuid: v4(),
      sourceType: program.externalSourceType,
      // Deprecated
      externalSourceId: tag(program.externalSourceName),
      mediaSourceId: tag(program.externalSourceId),
      externalKey: program.externalKey,
      originalAirDate: program.date ?? null,
      duration: program.duration,
      filePath: program.serverFilePath,
      plexRatingKey: program.externalKey,
      plexFilePath: program.serverFileKey,
      rating: program.rating ?? null,
      summary: program.summary ?? null,
      title: program.title,
      type: program.subtype,
      year: program.year ?? null,
      showTitle: program.grandparent?.title,
      seasonNumber: program.parent?.index,
      episode: program.index,
      parentExternalKey: program.parent?.externalKey,
      grandparentExternalKey: program.grandparent?.externalKey,
      createdAt: now,
      updatedAt: now,
      canonicalId: program.canonicalId,
      libraryId: program.libraryId,
      state: 'ok',
    };
  }

  mint(
    mediaSource: MediaSourceOrm,
    library: MediaSourceLibraryOrm,
    program: ContentProgramOriginalProgram,
  ): NewProgramWithExternalIds {
    const ret = match(program)
      .with({ sourceType: 'plex' }, ({ program }) => {
        const dao = match(program)
          .with({ type: 'movie' }, (movie) =>
            this.mintProgramForPlexMovie(mediaSource, library, movie),
          )
          .with({ type: 'episode' }, (ep) =>
            this.mintProgramForPlexEpisode(mediaSource, library, ep),
          )
          .with({ type: 'track' }, (track) =>
            this.mintProgramForPlexTrack(mediaSource, library, track),
          )
          .exhaustive();
        const externalIds = this.mintPlexExternalIdsFromApiItem(
          mediaSource.name,
          mediaSource.uuid,
          dao,
          program,
        );
        return {
          ...dao,
          externalIds,
        } satisfies NewProgramWithExternalIds;
      })
      .with(
        {
          sourceType: 'jellyfin',
          program: {
            Type: P.union(
              'Movie',
              'Audio',
              'Episode',
              'MusicVideo',
              'Video',
              'Trailer',
            ),
          },
        },
        ({ program }) => this.mintProgramForJellyfinItem(mediaSource, program),
      )
      .otherwise(() => new Error('Unexpected program type'));
    if (isError(ret)) {
      throw ret;
    }
    return ret;
  }

  mintMovie(
    mediaSource: MediaSourceOrm,
    mediaLibrary: MediaSourceLibraryOrm,
    movie: MediaSourceMovie,
    localFolderId?: string,
    now: number = +dayjs(),
  ): NewProgramWithRelations<'movie'> {
    const programId = v4();
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
      genres: seq.collect(movie.genres, (genre) => this.mintGenre(genre.name)),
      studios: seq.collect(movie.studios, (studio) =>
        this.mintStudio(studio.name),
      ),
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
          // TODO: color
          default: booleanToNumber(stream.default ?? false),
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

      if (item.mediaItem.resolution) {
        const version: NewProgramVersion = {
          uuid: versionId,
          createdAt: now,
          updatedAt: now,
          programId,
          displayAspectRatio: item.mediaItem.displayAspectRatio,
          duration: item.mediaItem.duration,
          frameRate: match(item.mediaItem.frameRate)
            .with(P.string, (str) => str)
            .with(P.number, (num) => num.toString())
            .with(P.nullish, (nil) => nil)
            .exhaustive(),
          sampleAspectRatio: item.mediaItem.sampleAspectRatio,
          height: item.mediaItem.resolution?.heightPx,
          width: item.mediaItem.resolution?.widthPx,
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
    mediaLibrary: MediaSourceLibraryOrm,
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
        this.mintGenre(genre.name),
      ),
      studios: seq.collect(episode.studios, (studio) =>
        this.mintStudio(studio.name),
      ),
    };
  }

  mintMusicTrack(
    mediaSource: MediaSourceOrm,
    mediaLibrary: MediaSourceLibraryOrm,
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
      genres: seq.collect(track.genres, (genre) => this.mintGenre(genre.name)),
      studios: seq.collect(track.studios, (studio) =>
        this.mintStudio(studio.name),
      ),
    };
  }

  mintOtherVideo(
    mediaSource: MediaSourceOrm,
    mediaLibrary: MediaSourceLibraryOrm,
    video: MediaSourceOtherVideo,
    localFolderId?: string,
  ): NewProgramWithRelations<'other_video'> {
    const programId = v4();
    const now = +dayjs();
    const newVideo = {
      uuid: programId,
      sourceType: video.sourceType,
      externalKey: video.externalId,
      originalAirDate: video.releaseDate
        ? dayjs(video.releaseDate)?.format()
        : null,
      duration: video.duration ?? 0,
      // filePath: file?.file ?? null,
      externalSourceId: mediaSource.name,
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      // plexRatingKey: plexMovie.ratingKey,
      // plexFilePath: file?.key ?? null,
      // rating: movie.rating,
      // summary: movie.summary,
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
      genres: seq.collect(video.genres, (genre) => this.mintGenre(genre.name)),
      studios: seq.collect(video.studios, (studio) =>
        this.mintStudio(studio.name),
      ),
    };
  }

  private mintProgramForPlexMovie(
    mediaSource: MediaSourceOrm,
    mediaLibrary: MediaSourceLibraryOrm,
    plexMovie: ApiPlexMovie,
  ): NewProgramDao {
    const file = first(first(plexMovie.Media)?.Part ?? []);
    return {
      uuid: v4(),
      sourceType: ProgramSourceType.PLEX,
      originalAirDate: plexMovie.originallyAvailableAt ?? null,
      duration: plexMovie.duration ?? 0,
      filePath: file?.file ?? null,
      externalSourceId: mediaSource.name,
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      externalKey: plexMovie.ratingKey,
      plexRatingKey: plexMovie.ratingKey,
      plexFilePath: file?.key ?? null,
      rating: plexMovie.contentRating ?? null,
      summary: plexMovie.summary ?? null,
      title: plexMovie.title,
      type: ProgramType.Movie,
      year: plexMovie.year ?? null,
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      canonicalId: this.plexProgramCanonicalizer.getCanonicalId(plexMovie),
      state: 'ok',
    };
  }

  private mintProgramForJellyfinItem(
    mediaSource: MediaSourceOrm,
    item: Omit<JellyfinItem, 'Type'> & {
      Type: 'Movie' | 'Episode' | 'Audio' | 'Video' | 'MusicVideo' | 'Trailer';
    },
  ): NewProgramWithExternalIds {
    const id = v4();
    const dao: NewProgramDao = {
      uuid: id,
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      sourceType: ProgramSourceType.JELLYFIN,
      originalAirDate: item.PremiereDate,
      duration: Math.ceil((item.RunTimeTicks ?? 0) / 10_000),
      externalSourceId: mediaSource.name,
      mediaSourceId: mediaSource.uuid,
      externalKey: item.Id,
      rating: item.OfficialRating,
      summary: item.Overview,
      title: item.Name ?? '',
      type: match(item.Type)
        .with('Movie', () => ProgramType.Movie)
        .with(P.union('Trailer', 'Video'), () => ProgramType.OtherVideo)
        .with('MusicVideo', () => ProgramType.MusicVideo)
        .with('Episode', () => ProgramType.Episode)
        .with('Audio', () => ProgramType.Track)
        .exhaustive(),
      year: item.ProductionYear,
      showTitle: item.SeriesName,
      showIcon: item.SeriesThumbImageTag,
      seasonNumber: item.ParentIndexNumber,
      episode: item.IndexNumber,
      parentExternalKey: item.ParentId ?? item.SeasonId ?? item.AlbumId,
      grandparentExternalKey:
        item.SeriesId ??
        find(item.AlbumArtists, { Name: item.AlbumArtist })?.Id,
      canonicalId: this.jellyfinCanonicalizer.getCanonicalId(item),
      state: 'ok',
    };

    const externalIds = this.mintAllJellyfinExternalIdForApiItem(
      mediaSource.name,
      mediaSource.uuid,
      dao,
      item,
    );

    return {
      ...dao,
      externalIds,
    } satisfies NewProgramWithExternalIds;
  }

  private mintProgramForPlexEpisode(
    mediaSource: MediaSourceOrm,
    mediaLibrary: MediaSourceLibraryOrm,
    plexEpisode: PlexEpisode,
  ): NewProgramDao {
    const file = first(first(plexEpisode.Media)?.Part ?? []);
    return {
      uuid: v4(),
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      sourceType: ProgramSourceType.PLEX,
      originalAirDate: plexEpisode.originallyAvailableAt,
      duration: plexEpisode.duration ?? 0,
      filePath: file?.file,
      externalSourceId: mediaSource.name,
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      externalKey: plexEpisode.ratingKey,
      plexRatingKey: plexEpisode.ratingKey,
      plexFilePath: file?.key,
      rating: plexEpisode.contentRating,
      summary: plexEpisode.summary,
      title: plexEpisode.title,
      type: ProgramType.Episode,
      year: plexEpisode.year,
      showTitle: plexEpisode.grandparentTitle,
      showIcon: plexEpisode.grandparentThumb,
      seasonNumber: plexEpisode.parentIndex,
      episode: plexEpisode.index,
      parentExternalKey: plexEpisode.parentRatingKey,
      grandparentExternalKey: plexEpisode.grandparentRatingKey,
      canonicalId: this.plexProgramCanonicalizer.getCanonicalId(plexEpisode),
      state: 'ok',
    };
  }

  private mintProgramForPlexTrack(
    mediaSource: MediaSourceOrm,
    mediaLibrary: MediaSourceLibraryOrm,
    plexTrack: PlexMusicTrack,
  ): NewProgramDao {
    const file = first(first(plexTrack.Media)?.Part ?? []);
    return {
      uuid: v4(),
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      sourceType: ProgramSourceType.PLEX,
      duration: plexTrack.duration ?? 0,
      filePath: file?.file,
      externalSourceId: mediaSource.name,
      mediaSourceId: mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      externalKey: plexTrack.ratingKey,
      plexRatingKey: plexTrack.ratingKey,
      plexFilePath: file?.key,
      summary: plexTrack.summary,
      title: plexTrack.title,
      type: ProgramType.Track,
      year: plexTrack.parentYear,
      showTitle: plexTrack.grandparentTitle,
      showIcon: plexTrack.grandparentThumb,
      seasonNumber: plexTrack.parentIndex,
      episode: plexTrack.index,
      parentExternalKey: plexTrack.parentRatingKey,
      grandparentExternalKey: plexTrack.grandparentRatingKey,
      albumName: plexTrack.parentTitle,
      artistName: plexTrack.grandparentTitle,
      canonicalId: this.plexProgramCanonicalizer.getCanonicalId(plexTrack),
      state: 'ok',
    };
  }

  mintExternalIds(
    serverName: MediaSourceName,
    serverId: MediaSourceId,
    programId: string,
    program: ContentProgram,
  ): NewSingleOrMultiExternalId[] {
    return match(program)
      .with({ externalSourceType: 'plex' }, () =>
        this.mintPlexExternalIds(serverName, serverId, programId, program),
      )
      .with({ externalSourceType: 'jellyfin' }, () =>
        this.mintJellyfinExternalIds(serverName, serverId, programId, program),
      )
      .with({ externalSourceType: 'emby' }, () =>
        this.mintEmbyExternalIds(serverName, serverId, programId, program),
      )
      .with({ externalSourceType: 'local' }, () => [])
      .exhaustive();
  }

  mintPlexExternalIds(
    serverName: MediaSourceName,
    serverId: MediaSourceId,
    programId: string,
    program: ContentProgram,
  ): NewSingleOrMultiExternalId[] {
    const now = +dayjs();

    const ids: NewSingleOrMultiExternalId[] = [
      {
        type: 'multi',
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalKey: program.externalKey,
        sourceType: ProgramExternalIdType.PLEX,
        programUuid: programId,
        externalSourceId: serverName,
        mediaSourceId: serverId,
        externalFilePath: program.serverFileKey,
        directFilePath: program.serverFilePath,
      },
    ];

    const plexGuid = find(program.externalIds, { source: 'plex-guid' });
    if (plexGuid) {
      ids.push({
        type: 'single',
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalKey: plexGuid.id,
        sourceType: ProgramExternalIdType.PLEX_GUID,
        programUuid: programId,
      });
    }

    ids.push(
      ...seq.collect(program.externalIds, (eid) => {
        switch (eid.source) {
          case 'tmdb':
          case 'imdb':
          case 'tvdb':
            return {
              type: 'single',
              uuid: v4(),
              createdAt: now,
              updatedAt: now,
              externalKey: eid.id,
              sourceType: eid.source,
              programUuid: programId,
            } satisfies NewSingleOrMultiExternalId;
          default:
            return null;
        }
      }),
    );

    return ids;
  }

  mintPlexExternalIdsFromApiItem(
    serverName: MediaSourceName,
    serverId: MediaSourceId,
    program: NewProgramDao,
    plexEntity: PlexTerminalMedia,
  ): NewSingleOrMultiExternalId[] {
    const now = +dayjs();
    const file = first(first(plexEntity.Media)?.Part ?? []);

    const ids: NewSingleOrMultiExternalId[] = [
      {
        type: 'multi',
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalKey: program.externalKey,
        sourceType: ProgramExternalIdType.PLEX,
        programUuid: program.uuid,
        externalSourceId: serverName,
        mediaSourceId: serverId,
        externalFilePath: file?.key,
        directFilePath: file?.file,
      } satisfies NewSingleOrMultiExternalId,
    ];

    if (plexEntity.guid) {
      ids.push({
        type: 'single',
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalKey: plexEntity.guid,
        sourceType: ProgramExternalIdType.PLEX_GUID,
        programUuid: program.uuid,
      });
    }

    ids.push(
      ...seq
        .collect(plexEntity.Guid, ({ id }) => parsePlexGuid(id))
        .map(
          (eid) =>
            ({
              type: 'single',
              uuid: v4(),
              createdAt: now,
              updatedAt: now,
              externalKey: eid.externalKey,
              sourceType: eid.sourceType,
              programUuid: program.uuid,
            }) satisfies NewSingleOrMultiExternalId,
        ),
    );

    return ids;
  }

  mintJellyfinExternalIds(
    serverName: MediaSourceName,
    serverId: MediaSourceId,
    programId: string,
    program: ContentProgram,
  ) {
    const now = +dayjs();
    const ids: NewSingleOrMultiExternalId[] = [
      {
        type: 'multi',
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalKey: program.externalKey,
        sourceType: ProgramExternalIdType.JELLYFIN,
        programUuid: programId,
        externalSourceId: serverName,
        mediaSourceId: serverId,
        externalFilePath: program.serverFileKey,
        directFilePath: program.serverFilePath,
      },
    ];

    ids.push(
      ...seq.collect(program.externalIds, (eid) => {
        switch (eid.source) {
          case 'tmdb':
          case 'imdb':
          case 'tvdb':
            return {
              type: 'single',
              uuid: v4(),
              createdAt: now,
              updatedAt: now,
              externalKey: eid.id,
              sourceType: eid.source,
              programUuid: programId,
            } satisfies NewSingleOrMultiExternalId;
          default:
            return null;
        }
      }),
    );

    return ids;
  }

  mintJellyfinExternalIdForApiItem(
    serverName: MediaSourceName,
    programId: string,
    media: JellyfinItem,
  ) {
    return {
      uuid: v4(),
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      externalKey: media.Id,
      sourceType: ProgramExternalIdType.JELLYFIN,
      programUuid: programId,
      externalSourceId: serverName,
    } satisfies NewProgramExternalId;
  }

  mintAllJellyfinExternalIdForApiItem(
    serverName: MediaSourceName,
    serverId: MediaSourceId,
    program: NewProgramDao,
    entity: JellyfinItem,
  ) {
    const now = +dayjs();
    const ids: NewSingleOrMultiExternalId[] = [
      {
        type: 'multi',
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalKey: program.externalKey,
        sourceType: ProgramExternalIdType.JELLYFIN,
        programUuid: program.uuid,
        externalSourceId: serverName,
        mediaSourceId: serverId,
        directFilePath: head(entity.MediaSources)?.Path,
      },
    ];

    ids.push(
      ...seq.collectMapValues(entity.ProviderIds, (value, source) => {
        if (!value) {
          return;
        }

        switch (source) {
          case 'tmdb':
          case 'imdb':
          case 'tvdb':
            return {
              type: 'single',
              uuid: v4(),
              createdAt: now,
              updatedAt: now,
              externalKey: value,
              sourceType: source,
              programUuid: program.uuid,
            } satisfies NewSingleOrMultiExternalId;
          default:
            return null;
        }
      }),
    );

    return ids;
  }

  mintEmbyExternalIds(
    serverName: MediaSourceName,
    serverId: MediaSourceId,
    programId: string,
    program: ContentProgram,
  ) {
    const now = +dayjs();
    const ids: NewSingleOrMultiExternalId[] = [
      {
        type: 'multi',
        uuid: v4(),
        createdAt: now,
        updatedAt: now,
        externalKey: program.externalKey,
        sourceType: ProgramExternalIdType.EMBY,
        programUuid: programId,
        externalSourceId: serverName,
        mediaSourceId: serverId,
        externalFilePath: program.serverFileKey,
        directFilePath: program.serverFilePath,
      },
    ];

    ids.push(
      ...seq.collect(program.externalIds, (eid) => {
        switch (eid.source) {
          case 'tmdb':
          case 'imdb':
          case 'tvdb':
            return {
              type: 'single',
              uuid: v4(),
              createdAt: now,
              updatedAt: now,
              externalKey: eid.id,
              sourceType: eid.source,
              programUuid: programId,
            } satisfies NewSingleOrMultiExternalId;
          default:
            return null;
        }
      }),
    );

    return ids;
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

  private mintGenre(genreName: string): NewGenre {
    return {
      uuid: v4(),
      name: genreName,
    };
  }

  private mintStudio(studioName: string): NewStudio {
    return {
      uuid: v4(),
      name: studioName,
    };
  }
}
