import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import type { ProgramCanonicalIdLookupResult } from '@/db/interfaces/IProgramDB.js';
import type { MediaSourceOrm } from '@/db/schema/MediaSource.js';
import type { ExternalIdType } from '@tunarr/types/schemas';
import type { Maybe } from '@/types/util.js';
import { isNil } from 'lodash-es';
import {
  extractPlexGuid,
  isSyntheticLocalPlexGuid,
} from './plexProgramIdentityUtil.ts';

export type IncomingPlexItem = {
  externalId: string;
  canonicalId?: string;
  identifiers?: readonly { type: ExternalIdType; id: string }[];
};

export type ResolveExistingProgramRequest = {
  incoming: IncomingPlexItem;
  existingByRatingKey: Maybe<ProgramCanonicalIdLookupResult>;
  existingByCanonicalId: Maybe<ProgramCanonicalIdLookupResult>;
  mediaSource: MediaSourceOrm;
};

export type ResolveExistingProgramResult = {
  existing: ProgramCanonicalIdLookupResult;
  reason: 'rating_key' | 'plex_guid' | 'canonical_id';
  ratingKeyChanged: boolean;
};

export type PlexPathHints = {
  directFilePath?: string | null;
  externalFilePath?: string | null;
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

    const plexGuid = extractPlexGuid(req.incoming.identifiers);
    if (plexGuid && !isSyntheticLocalPlexGuid(plexGuid)) {
      const byGuid = await this.programDB.lookupProgramByPlexGuid(plexGuid);
      if (byGuid) {
        return {
          existing: byGuid,
          reason: 'plex_guid',
          ratingKeyChanged: byGuid.externalKey !== req.incoming.externalId,
        };
      }
    }

    if (req.existingByCanonicalId) {
      return {
        existing: req.existingByCanonicalId,
        reason: 'canonical_id',
        ratingKeyChanged:
          req.existingByCanonicalId.externalKey !== req.incoming.externalId,
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

  async reconcileRatingKeyIfChanged(
    resolved: ResolveExistingProgramResult,
    mediaSourceId: string,
    newRatingKey: string,
    paths?: PlexPathHints,
  ): Promise<string | undefined> {
    if (!resolved.ratingKeyChanged) {
      return resolved.existing.uuid;
    }

    await this.programDB.reconcilePlexRatingKeyChange({
      programUuid: resolved.existing.uuid,
      mediaSourceId: mediaSourceId as Parameters<
        IProgramDB['reconcilePlexRatingKeyChange']
      >[0]['mediaSourceId'],
      newRatingKey,
      directFilePath: paths?.directFilePath,
      externalFilePath: paths?.externalFilePath,
    });

    return resolved.existing.uuid;
  }
}
