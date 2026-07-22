import { describe, expect, it, vi } from 'vitest';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { PlexProgramIdentityService } from './PlexProgramIdentityService.ts';

describe('PlexProgramIdentityService', () => {
  const programDB = {
    lookupProgramByPlexGuid: vi.fn(),
  } as unknown as IProgramDB;

  const service = new PlexProgramIdentityService(programDB);

  it('resolves by rating key when present', async () => {
    const existing = {
      uuid: 'keep-uuid',
      canonicalId: 'canon-1',
      libraryId: 'lib-1',
      externalKey: '111',
    };

    const result = await service.resolveExistingProgram({
      incomingMovie: {
        externalId: '111',
        canonicalId: 'canon-1',
        identifiers: [{ type: 'plex-guid', id: 'plex://movie/x' }],
      },
      existingByRatingKey: existing,
      existingByCanonicalId: undefined,
      mediaSource: { uuid: 'ms-1' } as never,
    });

    expect(result).toEqual({
      existing,
      reason: 'rating_key',
      ratingKeyChanged: false,
    });
  });

  it('resolves by plex-guid when rating key rotated', async () => {
    vi.mocked(programDB.lookupProgramByPlexGuid).mockResolvedValue({
      uuid: 'keep-uuid',
      canonicalId: 'canon-1',
      libraryId: 'lib-1',
      externalKey: '111',
    });

    const result = await service.resolveExistingProgram({
      incomingMovie: {
        externalId: '999',
        canonicalId: 'canon-1',
        identifiers: [{ type: 'plex-guid', id: 'plex://movie/x' }],
      },
      existingByRatingKey: undefined,
      existingByCanonicalId: undefined,
      mediaSource: { uuid: 'ms-1' } as never,
    });

    expect(result?.reason).toBe('plex_guid');
    expect(result?.ratingKeyChanged).toBe(true);
  });

  it('does not skip scan when rating key changed', () => {
    expect(
      service.shouldSkipScanUpdate(
        false,
        {
          existing: {
            uuid: 'u',
            canonicalId: 'c',
            libraryId: 'l',
            externalKey: 'old',
          },
          reason: 'plex_guid',
          ratingKeyChanged: true,
        },
        'c',
      ),
    ).toBe(false);
  });

  it('skips scan when canonical id unchanged and rating key matches', () => {
    expect(
      service.shouldSkipScanUpdate(
        false,
        {
          existing: {
            uuid: 'u',
            canonicalId: 'c',
            libraryId: 'l',
            externalKey: '111',
          },
          reason: 'rating_key',
          ratingKeyChanged: false,
        },
        'c',
      ),
    ).toBe(true);
  });
});
