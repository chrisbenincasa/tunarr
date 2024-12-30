import { Canonicalizer } from '@/services/Canonicalizer.ts';
import {
  PlexLibraryCollection,
  PlexMedia,
  PlexMovie,
  PlexTvShow,
} from '@tunarr/types/plex';
import crypto from 'node:crypto';

const VERSION = 1;

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
      case 'episode':
      case 'artist':
      case 'album':
      case 'track':
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
    for (const role of plexShow.Role) {
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
    hash.update(plexCollection.childCount);
    hash.update(plexCollection.smart);
    return hash.digest('base64');
  }
}
