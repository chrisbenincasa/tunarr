import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import type { ProgramCanonicalIdLookupResult } from '@/db/interfaces/IProgramDB.js';
import type { MediaSourceOrm } from '@/db/schema/MediaSource.js';
import type { Movie } from '@/types/Media.js';
import type { Maybe } from '@/types/util.js';
import { isNil } from 'lodash-es';
import {
  extractPlexGuid,
  isSyntheticLocalPlexGuid,
} from './plexProgramIdentityUtil.ts';

export type ResolveExistingProgramRequest = {
  incomingMovie: Pick<Movie, 'externalId' | 'canonicalId' | 'identifiers'>;
  existingByRatingKey: Maybe<ProgramCanonicalIdLookupResult>;
  existingByCanonicalId: Maybe<ProgramCanonicalIdLookupResult>;
  mediaSource: MediaSourceOrm;
};

export type ResolveExistingProgramResult = {
  existing: ProgramCanonicalIdLookupResult;
  reason: 'rating_key' | 'plex_guid' | 'canonical_id';
  ratingKeyChanged: boolean;
};

export class PlexProgramIdentityService {
  constructor(private readonly programDB: IProgramDB) {}

  async resolveExistingProgram(
    req: ResolveExistingProgramRequest,
  ): Promise<Maybe<ResolveExistingProgramResult>> {
    if (req.existingByRatingKey) {
      return {
        existing: req.existingByRatingKey,
        reason: 'rating_key',
        ratingKeyChanged: false,
      };
    }

    const plexGuid = extractPlexGuid(req.incomingMovie.identifiers);
    if (plexGuid && !isSyntheticLocalPlexGuid(plexGuid)) {
      const byGuid = await this.programDB.lookupProgramByPlexGuid(plexGuid);
      if (byGuid) {
        return {
          existing: byGuid,
          reason: 'plex_guid',
          ratingKeyChanged: byGuid.externalKey !== req.incomingMovie.externalId,
        };
      }
    }

    if (req.existingByCanonicalId) {
      return {
        existing: req.existingByCanonicalId,
        reason: 'canonical_id',
        ratingKeyChanged:
          req.existingByCanonicalId.externalKey !== req.incomingMovie.externalId,
      };
    }

    return undefined;
  }

  shouldSkipScanUpdate(
    force: boolean,
    resolved: Maybe<ResolveExistingProgramResult>,
    incomingCanonicalId: string | undefined,
  ): boolean {
    if (force || isNil(resolved)) {
      return false;
    }
    if (resolved.ratingKeyChanged) {
      return false;
    }
    return (
      !!resolved.existing.canonicalId &&
      !!incomingCanonicalId &&
      resolved.existing.canonicalId === incomingCanonicalId
    );
  }
}
