import { describe, expect, it } from 'vitest';
import { HttpStreamSource } from './types.ts';

describe('HttpStreamSource.redact', () => {
  it('redacts credential headers and query-string tokens', () => {
    const source = new HttpStreamSource(
      'http://plex:32400/photo?X-Plex-Token=abc123',
      {
        'X-Plex-Token': 'abc123',
        Authorization: 'Bearer abc123',
        Accept: 'image/*',
      },
    );

    source.redact();

    expect(source.path).toBe('http://plex:32400/photo?X-Plex-Token=REDACTED');
    expect(source.extraHeaders).toEqual({
      'X-Plex-Token': 'REDACTED',
      Authorization: 'REDACTED',
      Accept: 'image/*',
    });
  });
});
