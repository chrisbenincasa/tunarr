import type { Canonicalizer } from '@/services/Canonicalizer.js';
import { seq } from '@tunarr/shared/util';
import type {
  PlexEpisode,
  PlexLibraryCollection,
  PlexMedia,
  PlexMovie,
  PlexMusicAlbum,
  PlexMusicArtist,
  PlexMusicTrack,
  PlexTvSeason,
  PlexTvShow,
} from '@tunarr/types/plex';
import { compact, flatten } from 'lodash-es';
import crypto from 'node:crypto';
import { isNonEmptyString } from '../util/index.ts';

export class PlexMediaCanonicalizer implements Canonicalizer<PlexMedia> {
  getCanonicalId(t: PlexMedia): string {
    switch (t.type) {
      case 'movie':
        return this.canonicalizePlexMovie(t);
      case 'show':
        return this.canonicalizePlexShow(t);
      case 'collection':
        return this.canonicalizePlexCollection(t);
      case 'season':
        return this.canonicalizePlexSeason(t);
      case 'episode':
        return this.canonicalizePlexEpisode(t);
      case 'artist':
        return this.canonicalizePlexMusicArtist(t);
      case 'album':
        return this.canonicalizePlexMusicAlbum(t);
      case 'track':
        return this.canonicalizePlexTrack(t);
      case 'playlist':
        return '';
    }
  }

  private canonicalizePlexMovie(plexMovie: PlexMovie): string {
    const hash = crypto.createHash('sha1');
    hash.update(plexMovie.key);
    hash.update(plexMovie.addedAt?.toString() ?? '');
    hash.update(plexMovie.updatedAt?.toString() ?? '');
    for (const media of plexMovie.Media ?? []) {
      hash.update(media.id.toString());
      for (const part of media.Part) {
        hash.update(part.id.toString());
        hash.update(part.key);
        hash.update(part.file);
        hash.update(part.duration?.toString() ?? '');
        hash.update(part.size?.toString() ?? '');
        hash.update(part.container ?? '');
        hash.update(part.videoProfile ?? '');
        hash.update(part.audioProfile ?? '');
      }
    }

    return hash.digest('base64');
  }

  private canonicalizePlexShow(plexShow: PlexTvShow): string {
    const hash = crypto.createHash('sha1');
    hash.update(plexShow.key);
    hash.update(plexShow.addedAt?.toString() ?? '');
    hash.update(plexShow.updatedAt?.toString() ?? '');
    for (const role of plexShow.Role ?? []) {
      hash.update('role');
      hash.update(role.tag);
    }

    for (const collection of plexShow.Collection ?? []) {
      hash.update('collection');
      hash.update(collection.tag);
    }

    return hash.digest('base64');
  }

  private canonicalizePlexCollection(
    plexCollection: PlexLibraryCollection,
  ): string {
    const hash = crypto.createHash('sha1');
    hash.update(plexCollection.key);
    hash.update(plexCollection.addedAt?.toString() ?? '');
    hash.update(plexCollection.updatedAt?.toString() ?? '');
    hash.update(plexCollection.childCount.toFixed());
    hash.update(plexCollection.smart ? '1' : '0');
    return hash.digest('base64');
  }

  private canonicalizePlexSeason(plexSeason: PlexTvSeason): string {
    const hash = crypto.createHash('sha1');
    hash.update(plexSeason.key);
    hash.update(plexSeason.addedAt?.toString() ?? '');
    hash.update(plexSeason.updatedAt?.toString() ?? '');

    if (isNonEmptyString(plexSeason.thumb)) {
      hash.update(plexSeason.thumb);
    }

    return hash.digest('base64');
  }

  private canonicalizePlexEpisode(plexEpisode: PlexEpisode): string {
    const hash = crypto.createHash('sha1');
    hash.update(plexEpisode.key);
    hash.update(plexEpisode.addedAt?.toString() ?? '');
    hash.update(plexEpisode.updatedAt?.toString() ?? '');

    if (isNonEmptyString(plexEpisode.thumb)) {
      hash.update(plexEpisode.thumb);
    }

    for (const media of plexEpisode.Media ?? []) {
      hash.update(media.id.toString());
      for (const part of media.Part) {
        hash.update(part.id.toString());
        hash.update(part.key);
        hash.update(part.file);
        hash.update(part.duration?.toString() ?? '');
        hash.update(part.size?.toString() ?? '');
        hash.update(part.container ?? '');
        hash.update(part.videoProfile ?? '');
        hash.update(part.audioProfile ?? '');

        for (const stream of part.Stream ?? []) {
          if (stream.id) {
            hash.update(stream.id.toFixed());
          }
        }
      }
    }

    seq.collect(
      compact(
        flatten([plexEpisode.Director, plexEpisode.Writer, plexEpisode.Role]),
      ),
      (keyVal) => {
        hash.update(keyVal.tag);
      },
    );

    return hash.digest('base64');
  }

  private canonicalizePlexMusicArtist(plexArtist: PlexMusicArtist): string {
    const hash = crypto.createHash('sha1');
    hash.update(plexArtist.key);
    hash.update(plexArtist.addedAt?.toString() ?? '');
    hash.update(plexArtist.updatedAt?.toString() ?? '');

    if (isNonEmptyString(plexArtist.thumb)) {
      hash.update(plexArtist.thumb);
    }

    // for (const collection of plexArtist.Collection ?? []) {
    //       hash.update('collection');
    //       hash.update(collection.tag);
    //     }

    // seq.collect(
    //   compact(
    //     flatten([plexArtist.Director, plexArtist.Writer, plexArtist.Role]),
    //   ),
    //   (keyVal) => {
    //     hash.update(keyVal.tag);
    //   },
    // );
    plexArtist.Genre?.sort()
      .map((g) => g.tag)
      .forEach((genre) => hash.update(genre));

    return hash.digest('base64');
  }

  private canonicalizePlexMusicAlbum(plexAlbum: PlexMusicAlbum): string {
    const hash = crypto.createHash('sha1');
    hash.update(plexAlbum.key);
    hash.update(plexAlbum.addedAt?.toString() ?? '');
    hash.update(plexAlbum.updatedAt?.toString() ?? '');
    hash.update(plexAlbum.year?.toFixed() ?? '');

    if (isNonEmptyString(plexAlbum.thumb)) {
      hash.update(plexAlbum.thumb);
    }

    if (isNonEmptyString(plexAlbum.studio)) {
      hash.update(plexAlbum.studio);
    }

    plexAlbum.Genre?.sort()
      .map((g) => g.tag)
      .forEach((genre) => hash.update(genre));

    return hash.digest('base64');
  }

  private canonicalizePlexTrack(plexMusicTrack: PlexMusicTrack): string {
    const hash = crypto.createHash('sha1');
    hash.update(plexMusicTrack.key);
    hash.update(plexMusicTrack.addedAt?.toString() ?? '');
    hash.update(plexMusicTrack.updatedAt?.toString() ?? '');
    hash.update(plexMusicTrack.duration?.toFixed() ?? '');

    if (isNonEmptyString(plexMusicTrack.thumb)) {
      hash.update(plexMusicTrack.thumb);
    }

    for (const media of plexMusicTrack.Media ?? []) {
      hash.update(media.id.toString());
      for (const part of media.Part) {
        hash.update(part.id.toString());
        hash.update(part.key);
        hash.update(part.file);
        hash.update(part.duration?.toString() ?? '');
        hash.update(part.size?.toString() ?? '');
        hash.update(part.container ?? '');
        hash.update(part.videoProfile ?? '');
        hash.update(part.audioProfile ?? '');

        for (const stream of part.Stream ?? []) {
          if (stream.id) {
            hash.update(stream.id.toFixed());
          }
        }
      }
    }

    seq.collect(compact(flatten([plexMusicTrack.Guid])), (keyVal) => {
      hash.update(keyVal.id);
    });

    return hash.digest('base64');
  }
}
