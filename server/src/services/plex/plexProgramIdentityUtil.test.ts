import { describe, expect, it } from 'vitest';
import {
  extractPlexGuid,
  isSyntheticLocalPlexGuid,
} from './plexProgramIdentityUtil.ts';

describe('plexProgramIdentityUtil', () => {
  it('extractPlexGuid returns plex-guid identifier', () => {
    expect(
      extractPlexGuid([
        { type: 'plex', id: '12345' },
        { type: 'plex-guid', id: 'plex://movie/guid-here' },
      ]),
    ).toBe('plex://movie/guid-here');
  });

  it('isSyntheticLocalPlexGuid detects local:// guids', () => {
    expect(isSyntheticLocalPlexGuid('local://239598')).toBe(true);
    expect(isSyntheticLocalPlexGuid('plex://movie/abc')).toBe(false);
  });
});
