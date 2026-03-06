import type {
  MusicAlbum,
  MusicArtist,
  MusicTrack,
  OtherVideo,
} from '@tunarr/types';
import {
  isTerminalItemType,
  type Episode,
  type ProgramGrouping,
  type ProgramLike,
  type Season,
  type Show,
  type TerminalProgram,
} from '@tunarr/types';
import { orderBy } from 'lodash-es';
import crypto from 'node:crypto';
import type { Movie } from '../types/Media.ts';
import { isDefined } from '../util/index.ts';
import type { Canonicalizer } from './Canonicalizer.ts';

export class LocalMediaCanonicalizer implements Canonicalizer<ProgramLike> {
  getCanonicalId(input: ProgramLike): string {
    switch (input.type) {
      case 'movie':
        return this.getMovieCanonicalId(input);
      case 'show':
        return this.getShowCanonicalId(input);
      case 'season':
        return this.getSeasonCanonicalId(input);
      case 'episode':
        return this.getEpisodeCanonicalId(input);
      case 'other_video':
        return this.getOtherVideoCanonicalId(input);
      case 'artist':
        return this.getMusicArtistCanonicalId(input);
      case 'album':
        return this.getMusicAlbumCanonicalId(input);
      case 'track':
        return this.getMusicTrackCanonicalId(input);
      case 'music_video':
        throw new Error('Unsupported');
    }
  }

  private getMovieCanonicalId(movie: Movie): string {
    const hash = crypto.createHash('sha1');
    this.updateHashForBaseItem(movie, hash);
    hash.update(movie.plot ?? '');
    hash.update(movie.rating ?? '');
    hash.update(movie.summary ?? '');
    hash.update(movie.tagline ?? '');
    // TODO: External subs???
    return hash.digest('hex');
  }

  private getShowCanonicalId(show: Show): string {
    const hash = crypto.createHash('sha1');
    this.updateHashForBaseItem(show, hash);
    // FIXME: updateHashForBaseItem already calls updateHashForGrouping for non-terminal
    // types, so plot/tagline are hashed twice here. Removing this call is a breaking
    // change (all Show canonical IDs will change).
    this.updateHashForGrouping(show, hash);
    orderBy(show.actors, (a) => a.name).forEach((a) => {
      hash.update(a.name);
      hash.update(a.order?.toString() ?? '');
      hash.update(a.role ?? '');
    });
    orderBy(show.studios, (s) => s.name).forEach((s) => hash.update(s.name));
    hash.update(show.releaseDate?.toString() ?? '');
    hash.update(show.releaseDateString ?? '');
    hash.update(show.year?.toString() ?? '');
    return hash.digest('hex');
  }

  private getSeasonCanonicalId(season: Season): string {
    const hash = crypto.createHash('sha1');
    this.updateHashForBaseItem(season, hash);
    // FIXME: same double-hash bug as getShowCanonicalId — plot/tagline hashed twice.
    this.updateHashForGrouping(season, hash);
    hash.update(season.index?.toString() ?? '');
    orderBy(season.studios, (s) => s.name).forEach((s) => hash.update(s.name));
    hash.update(season.releaseDate?.toString() ?? '');
    hash.update(season.releaseDateString ?? '');
    hash.update(season.year?.toString() ?? '');
    return hash.digest('hex');
  }

  private getEpisodeCanonicalId(episode: Episode): string {
    const hash = crypto.createHash('sha1');
    this.updateHashForBaseItem(episode, hash);
    hash.update(episode.episodeNumber?.toString() ?? '');
    hash.update(episode.year?.toString() ?? '');
    hash.update(episode.summary ?? '');
    return hash.digest('hex');
  }

  private getOtherVideoCanonicalId(otherVideo: OtherVideo): string {
    const hash = crypto.createHash('sha1');
    this.updateHashForBaseItem(otherVideo, hash);
    return hash.digest('hex');
  }

  private getMusicArtistCanonicalId(musicArtist: MusicArtist): string {
    const hash = crypto.createHash('sha1');
    this.updateHashForBaseItem(musicArtist, hash);
    // FIXME: same double-hash bug as getShowCanonicalId — plot/tagline hashed twice.
    this.updateHashForGrouping(musicArtist, hash);
    return hash.digest('hex');
  }

  private getMusicAlbumCanonicalId(musicAlbum: MusicAlbum): string {
    const hash = crypto.createHash('sha1');
    this.updateHashForBaseItem(musicAlbum, hash);
    // FIXME: same double-hash bug as getShowCanonicalId — plot/tagline hashed twice.
    this.updateHashForGrouping(musicAlbum, hash);
    hash.update(musicAlbum.index?.toString() ?? '');
    orderBy(musicAlbum.studios, (s) => s.name).forEach((s) =>
      hash.update(s.name),
    );
    hash.update(musicAlbum.releaseDate?.toString() ?? '');
    hash.update(musicAlbum.releaseDateString ?? '');
    hash.update(musicAlbum.year?.toString() ?? '');
    return hash.digest('hex');
  }

  private getMusicTrackCanonicalId(musicTrack: MusicTrack): string {
    const hash = crypto.createHash('sha1');
    this.updateHashForBaseItem(musicTrack, hash);
    // FIXME: updateHashForBaseItem already calls updateHashForTerminalProgram for
    // terminal types, so all terminal fields (actors, directors, duration, mediaItem,
    // etc.) are hashed twice, and year is hashed a third time below. Removing this
    // call is a breaking change (all MusicTrack canonical IDs will change).
    this.updateHashForTerminalProgram(musicTrack, hash);
    hash.update(musicTrack.trackNumber?.toString() ?? '');
    hash.update(musicTrack.year?.toString() ?? '');
    return hash.digest('hex');
  }

  private updateHashForBaseItem(base: ProgramLike, hash: crypto.Hash) {
    hash.update(base.externalId);
    orderBy(base.genres ?? [], (g) => g.name).forEach((g) => {
      hash.update(g.name);
    });
    orderBy(
      base.identifiers,
      (i) => `${i.type}|${i.id}|${i.sourceId ?? ''}`,
    ).forEach((i) => {
      hash.update(`${i.id}|${i.sourceId ?? ''}|${i.type}`);
    });
    hash.update(base.libraryId);
    hash.update(base.mediaSourceId);
    hash.update(base.sourceType);
    orderBy(base.tags).forEach((t) => hash.update(t));
    hash.update(base.title);
    hash.update(base.type);
    if (isTerminalItemType(base)) {
      this.updateHashForTerminalProgram(base, hash);
    } else {
      this.updateHashForGrouping(base, hash);
    }
  }

  private updateHashForTerminalProgram(
    base: TerminalProgram,
    hash: crypto.Hash,
  ) {
    // FIXME: actors and directors are not prefixed with a type marker before hashing.
    // Because hash.update('') is a no-op, an actor with no order/role is
    // hash-indistinguishable from a director with the same name. Fix by adding a
    // type prefix (e.g. hash.update('actor') / hash.update('director')) — but this
    // is a breaking change for any item that has actors or directors.
    orderBy(base.actors, (a) => a.name).forEach((a) => {
      hash.update(a.name);
      hash.update(a.order?.toString() ?? '');
      hash.update(a.role ?? '');
    });

    orderBy(base.directors, (d) => d.name).forEach((d) => {
      hash.update(d.name);
    });

    if (base.duration) {
      hash.update(base.duration?.toFixed());
    }

    if (base.mediaItem) {
      orderBy(base.mediaItem.chapters, (c) => c.index, 'asc').forEach((c) => {
        hash.update(c.chapterType);
        hash.update(c.endTime.toFixed());
        hash.update(c.startTime.toFixed());
        hash.update(c.index.toFixed());
        hash.update(c.title ?? '');
      });

      hash.update(base.mediaItem.displayAspectRatio ?? '');
      hash.update(base.mediaItem.frameRate?.toString() ?? '');
      orderBy(base.mediaItem.locations, (l) => l.path, 'asc').forEach((l) => {
        hash.update(l.type + l.path);
      });
      hash.update(
        `${base.mediaItem.resolution?.widthPx ?? ''}x${base.mediaItem.resolution?.heightPx ?? ''}`,
      );
      hash.update(base.mediaItem.sampleAspectRatio ?? '');
      hash.update(base.mediaItem.scanKind ?? '');
      orderBy(base.mediaItem.streams, (s) => s.index, 'asc').forEach((s) => {
        hash.update(s.bitDepth?.toFixed() ?? '');
        hash.update(s.channels?.toFixed() ?? '');
        hash.update(s.codec);
        hash.update(s.colorPrimaries ?? '');
        hash.update(s.colorRange ?? '');
        hash.update(s.colorSpace ?? '');
        hash.update(s.colorTransfer ?? '');
        hash.update(isDefined(s.default) ? (s.default ? 'true' : 'false') : '');
        hash.update(s.fileName ?? '');
        hash.update(s.frameRate?.toString() ?? '');
        hash.update(s.hasAttachedPicture ? 'true' : 'false');
        hash.update(s.index.toString());
        hash.update(s.languageCodeISO6392 ?? '');
        hash.update(s.mimeType ?? '');
        hash.update(s.pixelFormat ?? '');
        hash.update(s.profile ?? '');
        hash.update(s.selected ? 'true' : 'false');
        hash.update(s.streamType);
        hash.update(s.title ?? '');
      });
    }

    hash.update(base.originalTitle ?? '');
    hash.update(base.releaseDate?.toString() ?? '');
    hash.update(base.releaseDateString ?? '');
    orderBy(base.studios, (s) => s.name).forEach((s) => hash.update(s.name));
    orderBy(base.writers, (w) => w.name).forEach((w) => hash.update(w.name));
    hash.update(base.year?.toString() ?? '');
  }

  private updateHashForGrouping(base: ProgramGrouping, hash: crypto.Hash) {
    hash.update(base.plot ?? '');
    hash.update(base.tagline ?? '');
  }
}
